# Rollover

A lightweight Obsidian plugin for date-stamped note workflows. One command **closes the previous dated note and opens today's** — renaming the old note to mark it done and creating a fresh, date-stamped note in the same folder.

It's fully configurable, so it adapts to any naming convention rather than a single hard-coded format.

## What it does

Running **Roll over to today's note**:

1. **Finds** the most recent open note in the target folder — a note whose name ends with your *pending marker*.
2. **Closes** it by replacing the pending marker with your *done marker*, using Obsidian's `FileManager.renameFile` so internal links to the note update automatically.
3. **Creates** a new note named with today's real date plus your label and pending marker, in the same folder.
4. **Fills** the new note — optionally carrying over a copy of the previous note's content, or applying a template with token substitution (otherwise it's empty).

Because the new note always uses today's actual date (never "previous + 1"), it works correctly even when you skip days — weekends, holidays, or any gap.

### Example (default settings)

A folder containing:

```
2026-06-16 ✓
2026-06-17 —     ← today's open note
```

Run **Roll over to today's note** on 18 June and you get:

```
2026-06-16 ✓
2026-06-17 ✓     ← closed
2026-06-18 —     ← created
```

## Commands

| Command | Description |
| --- | --- |
| **Roll over to today's note** | Close the most recent open note, then create today's note. |
| **Mark current note as done** | Close only the active note (pending → done). Appears only when the active note's name ends with the pending marker. |

Neither command sets a default hotkey — assign your own in **Settings → Hotkeys**.

## Settings

**Folder**
- **Folder mode** — *Active file's folder* (default) or *Fixed folder*.
- **Fixed folder path** — vault-relative path used in fixed mode (e.g. `Journal/2026`).

**File naming** (with live previews)
- **Date format** — Moment.js tokens, e.g. `YYYY-MM-DD`.
- **Note label** — optional text after the date, e.g. ` — Log`.
- **Pending marker** — marks an open note, e.g. ` —`.
- **Done marker** — replaces the pending marker when closed, e.g. ` ✓`.

**New note content**
- **Carry over previous content** — start today's note as a copy of the previous note's content, ready to edit (default off).
- **Template file** — optional vault-relative `.md` path (with file autocomplete).

**Behaviour**
- **Open note on create** — open the new note after creating it (default on).
- **Show notice when a note is closed** — confirm when the previous note is marked done (default on).

> Markers and labels become part of the file name, so avoid characters Obsidian disallows in note titles: `* " \ / < > : | ? # ^ [ ]`.

## Templating

If a template file is configured, its contents are copied into the new note with these tokens substituted:

| Token | Replaced with |
| --- | --- |
| `{{date}}` | Today's date in the configured date format |
| `{{label}}` | The configured note label |
| `{{day}}` | Full day name, e.g. `Wednesday` |
| `{{isoDate}}` | Full ISO date, e.g. `2026-06-17` |

**Content precedence:** if **Carry over previous content** is on, today's note is seeded with a copy of the previous note instead — the template is then used only on the first run, when there's no previous note to copy. With both off, the note is created empty.

## Works for many conventions

The pending/done markers, date format, and label are all configurable, so the same one-command workflow fits:

| Use case | Pending → Done |
| --- | --- |
| Daily log | `2026-06-17 —` → ` ✓` |
| Freelancer work log | `2026-06-17 Work Log [pending]` → `[done]` |
| Student lecture notes | `2026-06-17 — Lecture —` → ` ✓` |
| Researcher field notes | `2026.06.17 Field Note OPEN` → `DONE` |
| Weekly standup | `2026-W25 — Standup —` → ` ✓` |
| Personal check-ins | `26.06.17 — Check in —` → ` ✓` |

## Development

```bash
npm install      # install dev dependencies
npm run dev      # watch build → main.js
npm run build    # type-check + minified production build
```

To test in a vault, copy (or symlink) `manifest.json`, `styles.css`, and the built `main.js` into `<vault>/.obsidian/plugins/rollover/`, then enable the plugin in **Settings → Community plugins**.

### Releasing

Releases are produced by [`.github/workflows/release.yml`](.github/workflows/release.yml). Bump the version, tag it (the tag must equal the `manifest.json` version, with no `v` prefix), and push the tag:

```bash
npm version patch          # updates manifest.json + versions.json, commits, tags
git push && git push --tags
```

The workflow builds the plugin and attaches `main.js`, `manifest.json`, and `styles.css` to a **draft** release — review it, then publish.

## License

[MIT](LICENSE)
