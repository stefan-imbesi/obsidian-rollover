/** Escape a string so it can be embedded literally inside a RegExp. */
export function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a pattern that matches a pending note name of the form
 * `<date><label><pendingMarker>` and captures the leading date segment.
 *
 * The date is captured lazily (`.+?`); because `label + pendingMarker` is a
 * fixed suffix anchored at the end of the string, only its final occurrence can
 * satisfy the match, leaving the date as the captured prefix. The date segment
 * itself is validated separately with Moment, so it is not encoded in the regex.
 */
export function buildPendingPattern(label: string, pendingMarker: string): RegExp {
	return new RegExp("^(.+?)" + escapeRegExp(label) + escapeRegExp(pendingMarker) + "$");
}

/** Join a folder path and a file name into a vault-relative path. */
export function joinPath(folderPath: string, name: string): string {
	return folderPath ? `${folderPath}/${name}` : name;
}
