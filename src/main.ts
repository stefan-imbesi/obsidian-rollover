import { Notice, Plugin } from "obsidian";
import { CheckinSettings, CheckinSettingTab, DEFAULT_SETTINGS } from "./settings";
import { activeNoteIsPending, markActiveNoteDone, runCheckin } from "./checkin";

export default class CheckinPlugin extends Plugin {
	settings: CheckinSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addCommand({
			id: "new-checkin",
			name: "New Check-in",
			callback: () => {
				void this.runCheckinSafely();
			},
		});

		this.addCommand({
			id: "mark-checkin-done",
			name: "Mark current note as done",
			checkCallback: (checking: boolean) => {
				if (!activeNoteIsPending(this.app, this.settings)) return false;
				if (!checking) {
					void this.markActiveNoteDoneSafely();
				}
				return true;
			},
		});

		this.addSettingTab(new CheckinSettingTab(this.app, this));
	}

	private async runCheckinSafely(): Promise<void> {
		try {
			await runCheckin(this.app, this.settings);
		} catch (error) {
			console.error("Check-in: unexpected error during New Check-in.", error);
			new Notice("Check-in: Something went wrong. See the developer console for details.");
		}
	}

	private async markActiveNoteDoneSafely(): Promise<void> {
		try {
			await markActiveNoteDone(this.app, this.settings);
		} catch (error) {
			console.error("Check-in: unexpected error while marking the note done.", error);
			new Notice("Check-in: Something went wrong. See the developer console for details.");
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
