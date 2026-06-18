import { App, Notice, TFile, TFolder, normalizePath } from "obsidian";
import { RolloverSettings } from "./settings";
import { MomentInstance, formatDate, now, parseDate } from "./date";
import { buildPendingPattern, joinPath } from "./utils";

interface PendingNote {
	file: TFile;
	date: MomentInstance;
}

/**
 * Primary command. Marks the most recent open note as done (if any), then
 * creates today's note in the same folder.
 */
export async function runRollover(app: App, settings: RolloverSettings): Promise<void> {
	const folder = resolveTargetFolder(app, settings);
	if (!folder) return; // resolveTargetFolder shows the relevant Notice

	const pending = findPendingNotes(app, folder, settings);
	let carriedContent: string | null = null;
	let previousDate: MomentInstance | null = null;
	if (pending.length > 0) {
		pending.sort((a, b) => b.date.valueOf() - a.date.valueOf());
		if (pending.length > 1) {
			new Notice(
				"Rollover: Multiple open notes found — closed the most recent. Check your folder for others."
			);
		}
		const target = pending[0].file;
		previousDate = pending[0].date;
		if (settings.carryOverContent) {
			// Copy the previous note's content forward before closing it.
			carriedContent = await app.vault.read(target);
		}
		await renameToDone(app, target, settings);
	}

	await createNextNote(app, folder, settings, carriedContent, previousDate);
}

/** Whether the active note's name ends with the configured pending marker. */
export function activeNoteIsPending(app: App, settings: RolloverSettings): boolean {
	if (!settings.pendingMarker) return false;
	const file = app.workspace.getActiveFile();
	if (!file || file.extension !== "md") return false;
	return file.basename.endsWith(settings.pendingMarker);
}

/** Secondary command. Renames only the active note from pending to done. */
export async function markActiveNoteDone(app: App, settings: RolloverSettings): Promise<void> {
	const file = app.workspace.getActiveFile();
	if (!file) return;
	await renameToDone(app, file, settings);
}

// ── Internals ───────────────────────────────────────────────────────────────

function resolveTargetFolder(app: App, settings: RolloverSettings): TFolder | null {
	if (settings.folderMode === "fixed") {
		const path = settings.fixedFolderPath.trim();
		if (!path) {
			new Notice("Rollover: No fixed folder path is set. Configure it in settings.");
			return null;
		}
		const folder = getFolder(app, normalizePath(path));
		if (!folder) {
			new Notice(`Rollover: Folder not found — ${path}.`);
			return null;
		}
		return folder;
	}

	const activeFile = app.workspace.getActiveFile();
	if (!activeFile) {
		new Notice("Rollover: No file is open. Open a note in the target folder first.");
		return null;
	}
	if (!activeFile.parent) {
		new Notice("Rollover: The active file has no parent folder.");
		return null;
	}
	return activeFile.parent;
}

/** Resolve a folder by its vault-relative path, or null if it isn't a folder. */
function getFolder(app: App, path: string): TFolder | null {
	const file = app.vault.getAbstractFileByPath(path);
	return file instanceof TFolder ? file : null;
}

function findPendingNotes(app: App, folder: TFolder, settings: RolloverSettings): PendingNote[] {
	const pattern = buildPendingPattern(settings.noteLabel, settings.pendingMarker);
	const found: PendingNote[] = [];

	for (const child of folder.children) {
		if (!(child instanceof TFile) || child.extension !== "md") continue;
		const match = pattern.exec(child.basename);
		if (!match) continue;
		const date = parseDate(match[1], settings.dateFormat);
		if (!date.isValid()) continue; // ignore names that don't parse for this format
		found.push({ file: child, date });
	}

	return found;
}

async function renameToDone(app: App, file: TFile, settings: RolloverSettings): Promise<void> {
	const oldBasename = file.basename;
	const stem = oldBasename.slice(0, oldBasename.length - settings.pendingMarker.length);
	const newBasename = stem + settings.doneMarker;
	const folderPath = file.parent ? file.parent.path : "";
	const newPath = normalizePath(joinPath(folderPath, `${newBasename}.${file.extension}`));

	// renameFile (not Vault.rename) so internal links across the vault are updated.
	await app.fileManager.renameFile(file, newPath);

	if (settings.showRenameNotice) {
		new Notice(`✓ ${oldBasename} closed.`);
	}
}

async function createNextNote(
	app: App,
	folder: TFolder,
	settings: RolloverSettings,
	carriedContent: string | null,
	previousDate: MomentInstance | null
): Promise<void> {
	// Advance the date: today normally; but if the note we just closed is dated
	// today or later, use the day after it — so the new note never collides with
	// the date we closed, while still jumping straight to today after skipped days.
	const today = now();
	const targetDate =
		previousDate && !today.isAfter(previousDate, "day")
			? previousDate.clone().add(1, "day")
			: today;
	const newBasename =
		formatDate(settings.dateFormat, targetDate) + settings.noteLabel + settings.pendingMarker;
	const newPath = normalizePath(joinPath(folder.path, `${newBasename}.md`));

	const existing = app.vault.getAbstractFileByPath(newPath);
	if (existing instanceof TFile) {
		new Notice("Rollover: A note for that date already exists.");
		if (settings.openOnCreate) {
			await app.workspace.getLeaf(false).openFile(existing);
		}
		return;
	}

	// Precedence: carried-forward content (including an empty note) > template > empty.
	const content = carriedContent ?? (await buildContent(app, settings));
	const created = await app.vault.create(newPath, content);
	new Notice(`→ ${newBasename} created.`);

	if (settings.openOnCreate) {
		await app.workspace.getLeaf(false).openFile(created);
	}
}

async function buildContent(app: App, settings: RolloverSettings): Promise<string> {
	const templatePath = settings.templatePath.trim();
	if (!templatePath) return "";

	const file = app.vault.getAbstractFileByPath(normalizePath(templatePath));
	if (!(file instanceof TFile)) {
		new Notice(`Rollover: Template not found at ${templatePath}. Creating empty note.`);
		return "";
	}

	const raw = await app.vault.read(file);
	return substituteTokens(raw, settings);
}

/**
 * Replace template tokens with values derived from today's date and settings,
 * in a single pass over the template.
 */
export function substituteTokens(
	template: string,
	settings: RolloverSettings,
	instance?: MomentInstance
): string {
	const m = instance ?? now();
	const values: Record<string, string> = {
		date: m.format(settings.dateFormat),
		label: settings.noteLabel,
		day: m.format("dddd"),
		isoDate: m.format("YYYY-MM-DD"),
	};
	return template.replace(/\{\{(date|label|day|isoDate)\}\}/g, (_match, key: string) => values[key]);
}
