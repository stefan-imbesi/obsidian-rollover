import { AbstractInputSuggest, App, PluginSettingTab, Setting, TFile, moment } from "obsidian";
import type CheckinPlugin from "./main";

export interface CheckinSettings {
	// — Folder targeting —
	folderMode: "active" | "fixed";
	fixedFolderPath: string;

	// — Naming —
	dateFormat: string; // moment.js tokens, e.g. "YY.MM.DD"
	noteLabel: string; // e.g. " — Check in"
	pendingMarker: string; // e.g. " —"
	doneMarker: string; // e.g. " ✓"

	// — Template —
	templatePath: string; // vault-relative path to a .md template file, or ""

	// — Behaviour —
	openOnCreate: boolean;
	showRenameNotice: boolean;
}

export const DEFAULT_SETTINGS: CheckinSettings = {
	folderMode: "active",
	fixedFolderPath: "",
	dateFormat: "YY.MM.DD",
	noteLabel: " — Check in",
	pendingMarker: " —",
	doneMarker: " ✓",
	templatePath: "",
	openOnCreate: true,
	showRenameNotice: true,
};

/** Autocomplete for picking a Markdown file by its vault-relative path. */
class FileSuggest extends AbstractInputSuggest<TFile> {
	constructor(
		private appRef: App,
		private inputEl: HTMLInputElement,
		private onSelectCb: (value: string) => void
	) {
		super(appRef, inputEl);
	}

	getSuggestions(query: string): TFile[] {
		const lower = query.toLowerCase();
		return this.appRef.vault
			.getMarkdownFiles()
			.filter((file) => file.path.toLowerCase().includes(lower))
			.slice(0, 50);
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

export class CheckinSettingTab extends PluginSettingTab {
	private plugin: CheckinPlugin;

	constructor(app: App, plugin: CheckinPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const s = this.plugin.settings;
		const save = () => this.plugin.saveSettings();

		// ── Group 1: Folder ──────────────────────────────────────────────
		containerEl.createEl("h3", { text: "Folder" });

		new Setting(containerEl)
			.setName("Folder mode")
			.setDesc("Where new check-in notes are created.")
			.addDropdown((dd) =>
				dd
					.addOption("active", "Active file's folder")
					.addOption("fixed", "Fixed folder")
					.setValue(s.folderMode)
					.onChange(async (value) => {
						s.folderMode = value === "fixed" ? "fixed" : "active";
						await save();
						this.display(); // re-render to show/hide the path field
					})
			);

		if (s.folderMode === "fixed") {
			new Setting(containerEl)
				.setName("Fixed folder path")
				.setDesc("Enter a vault-relative path. Leave blank to use the active file's folder.")
				.addText((text) =>
					text
						.setPlaceholder("e.g. 2026/Cycle/26.12")
						.setValue(s.fixedFolderPath)
						.onChange(async (value) => {
							s.fixedFolderPath = value;
							await save();
						})
				);
		}

		// ── Group 2: File naming ─────────────────────────────────────────
		containerEl.createEl("h3", { text: "File naming" });

		// Date format — with a live "today" preview and a token reference.
		const dateSetting = new Setting(containerEl).setName("Date format");
		dateSetting.descEl.empty();
		dateSetting.descEl.appendText("Uses Moment.js tokens. Today's preview: ");
		const datePreviewEl = dateSetting.descEl.createEl("span", {
			cls: "checkin-preview-inline",
		});
		const referenceEl = dateSetting.descEl.createEl("small", {
			cls: "checkin-format-reference",
		});
		referenceEl.setText(
			`YY = ${moment().format("YY")}    YYYY = ${moment().format("YYYY")}\n` +
				`MM = ${moment().format("MM")}    DD = ${moment().format("DD")}`
		);
		dateSetting.addText((text) =>
			text
				.setPlaceholder("YY.MM.DD")
				.setValue(s.dateFormat)
				.onChange(async (value) => {
					s.dateFormat = value;
					await save();
					refreshPreviews();
				})
		);

		new Setting(containerEl)
			.setName("Note label")
			.setDesc("Text that appears after the date in every note name.")
			.addText((text) =>
				text
					.setPlaceholder(" — Check in")
					.setValue(s.noteLabel)
					.onChange(async (value) => {
						s.noteLabel = value;
						await save();
						refreshPreviews();
					})
			);

		new Setting(containerEl)
			.setName("Pending marker")
			.setDesc("Appended to a note's name to indicate it is still open.")
			.addText((text) =>
				text
					.setPlaceholder(" —")
					.setValue(s.pendingMarker)
					.onChange(async (value) => {
						s.pendingMarker = value;
						await save();
						refreshPreviews();
					})
			);

		new Setting(containerEl)
			.setName("Done marker")
			.setDesc("Replaces the pending marker when a note is marked complete.")
			.addText((text) =>
				text
					.setPlaceholder(" ✓")
					.setValue(s.doneMarker)
					.onChange(async (value) => {
						s.doneMarker = value;
						await save();
						refreshPreviews();
					})
			);

		// Live note-name preview block (done = yesterday, pending = today).
		const previewBlock = containerEl.createDiv({ cls: "checkin-preview-block" });
		previewBlock.createDiv({ cls: "checkin-preview-title", text: "Preview:" });
		const doneLine = previewBlock.createDiv({ cls: "checkin-preview-line" });
		const pendingLine = previewBlock.createDiv({ cls: "checkin-preview-line" });

		const refreshPreviews = () => {
			const today = s.dateFormat ? moment().format(s.dateFormat) : "";
			const yesterday = s.dateFormat ? moment().subtract(1, "day").format(s.dateFormat) : "";
			datePreviewEl.setText(today || "(empty format)");
			doneLine.setText(`Done:    ${yesterday}${s.noteLabel}${s.doneMarker}`);
			pendingLine.setText(`Pending: ${today}${s.noteLabel}${s.pendingMarker}`);
		};
		refreshPreviews();

		// ── Group 3: Template ────────────────────────────────────────────
		containerEl.createEl("h3", { text: "Template" });

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
				.setPlaceholder("e.g. Templates/daily-checkin.md")
				.setValue(s.templatePath)
				.onChange(async (value) => {
					s.templatePath = value;
					await save();
				});
			new FileSuggest(this.app, text.inputEl, async (value) => {
				s.templatePath = value;
				await save();
			});
		});

		// ── Group 4: Behaviour ───────────────────────────────────────────
		containerEl.createEl("h3", { text: "Behaviour" });

		new Setting(containerEl)
			.setName("Open note on create")
			.setDesc("Open the new note after creating it.")
			.addToggle((toggle) =>
				toggle.setValue(s.openOnCreate).onChange(async (value) => {
					s.openOnCreate = value;
					await save();
				})
			);

		new Setting(containerEl)
			.setName("Show rename notice")
			.setDesc("Show a confirmation when the previous note is marked done.")
			.addToggle((toggle) =>
				toggle.setValue(s.showRenameNotice).onChange(async (value) => {
					s.showRenameNotice = value;
					await save();
				})
			);
	}
}
