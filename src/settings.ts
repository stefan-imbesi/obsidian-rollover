import { AbstractInputSuggest, App, PluginSettingTab, Setting, TFile, debounce, moment } from "obsidian";
import type RolloverPlugin from "./main";

export interface RolloverSettings {
	// — Folder targeting —
	folderMode: "active" | "fixed";
	fixedFolderPath: string;

	// — Naming —
	dateFormat: string; // moment.js tokens, e.g. "YYYY-MM-DD"
	noteLabel: string; // text after the date, e.g. "" or " — Log"
	pendingMarker: string; // marks an open note, e.g. " —"
	doneMarker: string; // replaces the pending marker when closed, e.g. " ✓"

	// — Template —
	templatePath: string; // vault-relative path to a .md template file, or ""

	// — Behaviour —
	openOnCreate: boolean;
	showRenameNotice: boolean;
}

export const DEFAULT_SETTINGS: RolloverSettings = {
	folderMode: "active",
	fixedFolderPath: "",
	dateFormat: "YYYY-MM-DD",
	noteLabel: "",
	pendingMarker: " —",
	doneMarker: " ✓",
	templatePath: "",
	openOnCreate: true,
	showRenameNotice: true,
};

/** Autocomplete for picking a Markdown file by its vault-relative path. */
class FileSuggest extends AbstractInputSuggest<TFile> {
	private readonly files: TFile[];

	constructor(
		app: App,
		private inputEl: HTMLInputElement,
		private onSelectCb: (value: string) => void
	) {
		super(app, inputEl);
		// Snapshot the file list once per suggester rather than rebuilding it (and
		// lowercasing every path) on every keystroke.
		this.files = app.vault.getMarkdownFiles();
	}

	getSuggestions(query: string): TFile[] {
		const lower = query.toLowerCase();
		const matches: TFile[] = [];
		for (const file of this.files) {
			if (file.path.toLowerCase().includes(lower)) {
				matches.push(file);
				if (matches.length === 50) break; // cap results and stop scanning early
			}
		}
		return matches;
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}

	selectSuggestion(file: TFile): void {
		this.onSelectCb(file.path);
		this.inputEl.value = file.path;
		this.inputEl.trigger("input");
		this.close();
	}
}

export class RolloverSettingTab extends PluginSettingTab {
	private plugin: RolloverPlugin;
	private queueSave: () => void;

	constructor(app: App, plugin: RolloverPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		// Coalesce rapid text edits into a single disk write (trailing debounce).
		this.queueSave = debounce(() => void this.plugin.saveSettings(), 400, true);
	}

	hide(): void {
		// Flush any pending debounced write when the settings pane closes.
		void this.plugin.saveSettings();
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const s = this.plugin.settings;
		const queueSave = this.queueSave; // debounced — for free-text inputs
		const saveNow = () => void this.plugin.saveSettings(); // immediate — for discrete controls

		// ── Folder (general settings, no heading) ─────────────────────────
		new Setting(containerEl)
			.setName("Folder mode")
			.setDesc("Where new notes are created.")
			.addDropdown((dd) =>
				dd
					.addOption("active", "Active file's folder")
					.addOption("fixed", "Fixed folder")
					.setValue(s.folderMode)
					.onChange((value) => {
						s.folderMode = value === "fixed" ? "fixed" : "active";
						saveNow();
						this.display(); // re-render to show/hide the path field
					})
			);

		if (s.folderMode === "fixed") {
			new Setting(containerEl)
				.setName("Fixed folder path")
				.setDesc("Enter a vault-relative path. Leave blank to use the active file's folder.")
				.addText((text) =>
					text
						.setPlaceholder("e.g. Journal/2026")
						.setValue(s.fixedFolderPath)
						.onChange((value) => {
							s.fixedFolderPath = value;
							queueSave();
						})
				);
		}

		// ── File naming ───────────────────────────────────────────────────
		new Setting(containerEl).setName("File naming").setHeading();

		// Date format — with a live "today" preview and a token reference.
		const dateSetting = new Setting(containerEl).setName("Date format");
		dateSetting.descEl.empty();
		dateSetting.descEl.appendText("Uses Moment.js tokens. Today's preview: ");
		const datePreviewEl = dateSetting.descEl.createEl("span", {
			cls: "rollover-preview-inline",
		});
		const referenceEl = dateSetting.descEl.createEl("small", {
			cls: "rollover-format-reference",
		});
		const ref = moment();
		referenceEl.setText(
			`YY = ${ref.format("YY")}    YYYY = ${ref.format("YYYY")}\n` +
				`MM = ${ref.format("MM")}    DD = ${ref.format("DD")}`
		);
		dateSetting.addText((text) =>
			text
				.setPlaceholder("YYYY-MM-DD")
				.setValue(s.dateFormat)
				.onChange((value) => {
					s.dateFormat = value;
					queueSave();
					refreshPreviews();
				})
		);

		new Setting(containerEl)
			.setName("Note label")
			.setDesc("Optional text after the date in every note name, e.g. \" — Log\".")
			.addText((text) =>
				text
					.setPlaceholder("(none)")
					.setValue(s.noteLabel)
					.onChange((value) => {
						s.noteLabel = value;
						queueSave();
						refreshPreviews();
					})
			);

		new Setting(containerEl)
			.setName("Pending marker")
			.setDesc("Appended to a note's name to mark it as still open.")
			.addText((text) =>
				text
					.setPlaceholder(" —")
					.setValue(s.pendingMarker)
					.onChange((value) => {
						s.pendingMarker = value;
						queueSave();
						refreshPreviews();
					})
			);

		new Setting(containerEl)
			.setName("Done marker")
			.setDesc("Replaces the pending marker when a note is closed.")
			.addText((text) =>
				text
					.setPlaceholder(" ✓")
					.setValue(s.doneMarker)
					.onChange((value) => {
						s.doneMarker = value;
						queueSave();
						refreshPreviews();
					})
			);

		// Live note-name preview block (done = yesterday, pending = today).
		const previewBlock = containerEl.createDiv({ cls: "rollover-preview-block" });
		previewBlock.createDiv({ cls: "rollover-preview-title", text: "Preview:" });
		const doneLine = previewBlock.createDiv({ cls: "rollover-preview-line" });
		const pendingLine = previewBlock.createDiv({ cls: "rollover-preview-line" });

		const refreshPreviews = () => {
			const m = moment();
			const today = s.dateFormat ? m.format(s.dateFormat) : "";
			const yesterday = s.dateFormat ? m.clone().subtract(1, "day").format(s.dateFormat) : "";
			datePreviewEl.setText(today || "(empty format)");
			doneLine.setText(`Done:    ${yesterday}${s.noteLabel}${s.doneMarker}`);
			pendingLine.setText(`Pending: ${today}${s.noteLabel}${s.pendingMarker}`);
		};
		refreshPreviews();

		// ── Template ──────────────────────────────────────────────────────
		new Setting(containerEl).setName("Template").setHeading();

		const templateSetting = new Setting(containerEl).setName("Template file");
		templateSetting.descEl.empty();
		templateSetting.descEl.appendText(
			"Optional. Vault-relative path to a Markdown file. Supports tokens: "
		);
		const tokenNames = ["{{date}}", "{{label}}", "{{day}}", "{{isoDate}}"];
		tokenNames.forEach((token, index) => {
			templateSetting.descEl.createEl("code", { text: token });
			if (index < tokenNames.length - 1) templateSetting.descEl.appendText(", ");
		});
		templateSetting.descEl.appendText(".");
		templateSetting.addText((text) => {
			text
				.setPlaceholder("e.g. Templates/daily.md")
				.setValue(s.templatePath)
				.onChange((value) => {
					s.templatePath = value;
					queueSave();
				});
			new FileSuggest(this.app, text.inputEl, (value) => {
				s.templatePath = value;
				saveNow();
			});
		});

		// ── Behaviour ─────────────────────────────────────────────────────
		new Setting(containerEl).setName("Behaviour").setHeading();

		new Setting(containerEl)
			.setName("Open note on create")
			.setDesc("Open the new note after creating it.")
			.addToggle((toggle) =>
				toggle.setValue(s.openOnCreate).onChange((value) => {
					s.openOnCreate = value;
					saveNow();
				})
			);

		new Setting(containerEl)
			.setName("Show notice when a note is closed")
			.setDesc("Show a confirmation when the previous note is marked done.")
			.addToggle((toggle) =>
				toggle.setValue(s.showRenameNotice).onChange((value) => {
					s.showRenameNotice = value;
					saveNow();
				})
			);
	}
}
