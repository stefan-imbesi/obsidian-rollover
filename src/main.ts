import { Notice, Plugin } from "obsidian";
import { RolloverSettings, RolloverSettingTab, DEFAULT_SETTINGS } from "./settings";
import { activeNoteIsPending, markActiveNoteDone, runRollover } from "./rollover";

export default class RolloverPlugin extends Plugin {
	settings: RolloverSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addCommand({
			id: "roll-over",
			name: "Roll over to today's note",
			callback: () => {
				void this.runRolloverSafely();
			},
		});

		this.addCommand({
			id: "mark-done",
			name: "Mark current note as done",
			checkCallback: (checking: boolean) => {
				if (!activeNoteIsPending(this.app, this.settings)) return false;
				if (!checking) {
					void this.markActiveNoteDoneSafely();
				}
				return true;
			},
		});

		this.addSettingTab(new RolloverSettingTab(this.app, this));
	}

	private async runRolloverSafely(): Promise<void> {
		try {
			await runRollover(this.app, this.settings);
		} catch (error) {
			console.error("Rollover: unexpected error during roll over.", error);
			new Notice("Rollover: Something went wrong. See the developer console for details.");
		}
	}

	private async markActiveNoteDoneSafely(): Promise<void> {
		try {
			await markActiveNoteDone(this.app, this.settings);
		} catch (error) {
			console.error("Rollover: unexpected error while marking the note done.", error);
			new Notice("Rollover: Something went wrong. See the developer console for details.");
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
