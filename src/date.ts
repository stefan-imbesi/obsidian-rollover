import { moment } from "obsidian";

/**
 * A Moment instance type, derived from Obsidian's bundled `moment` export so we
 * never need to add the standalone `moment` package as a dependency.
 */
export type MomentInstance = ReturnType<typeof moment>;

/**
 * Format a date with the given Moment.js format string.
 * Defaults to the current moment when no instance is supplied.
 */
export function formatDate(format: string, instance?: MomentInstance): string {
	return (instance ?? moment()).format(format);
}

/** Today as a Moment, always evaluated at call time (never at plugin load). */
export function now(): MomentInstance {
	return moment();
}

/**
 * Parse a date segment using the configured format in strict mode.
 * Callers must check `.isValid()` — strings that do not match the format
 * produce an invalid Moment rather than a guessed date.
 */
export function parseDate(dateString: string, format: string): MomentInstance {
	return moment(dateString, format, true);
}
