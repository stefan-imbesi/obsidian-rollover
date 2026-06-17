# Check-in

A lightweight Obsidian plugin that automates a date-stamped daily-note workflow. One command — **New Check-in** — marks your previous open note as done and creates today's note in the same folder.

It is fully configurable, so it adapts to any naming convention rather than a single hard-coded format.

## What it does

Running **New Check-in**:

1. **Finds** the most recent "open" note in the target folder (a note whose name ends with your *pending marker*).
2. **Renames** it by replacing the pending marker with your *done marker* — using Obsidian's `FileManager.renameFile`, so internal links pointing at the note are updated automatically.
3. **Creates** a new note named with today's real date plus your label and pending marker, in the same folder.
4. **Applies** an optional template, with token substitution, to the new note.

Because the new note always uses today's actual date (never "previous + 1"), it works correctly even when you skip days (weekends, holidays, etc.).

### Example

A folder containing:

```
26.06.16 — Check in ✓
26.06.17 — Check in —     ← today's open note
```

Run **New Check-in** on 18 June and you get:

```
26.06.16 — Check in ✓
26.06.17 — Check in ✓     ← renamed
26.06.18 — Check in —     ← created
```

## Commands

| Command | Description |
| --- | --- |
| **New Check-in** | Mark the most recent open note done, then create today's note. |
| **Mark current note as done** | Rename only the active note from pending → done. Only appears when the active note's name ends with the pending marker. |

Neither command sets a default hotkey — assign your own in **Settings → Hotkeys**.

## Settings

**Folder**
- **Folder mode** — `Active file's folder` (default) or `Fixed folder`.
- **Fixed folder path** — vault-relative path used in fixed mode (e.g. `2026/Cycle/26.12`).

**File naming** (with live previews)
- **Date format** — Moment.js tokens, e.g. `YY.MM.DD`.
- **Note label** — text after the date, e.g. ` — Check in`.
- **Pending marker** — marks an open note, e.g. ` —`.
- **Done marker** — replaces the pending marker when complete, e.g. ` ✓`.

**Template**
- **Template file** — optional vault-relative `.md` path (with file autocomplete).

**Behaviour**
- **Open note on create** — open the new note after creating it (default on).
- **Show rename notice** — confirm when the previous note is marked done (default on).

## Templating

If a template file is configured, its contents are copied into the new note with these tokens substituted:

| Token | Replaced with |
| --- | --- |
| `{{date}}` | Today's date in the configured date format |
| `{{label}}` | The configured note label |
| `{{day}}` | Full day name, e.g. `Wednesday` |
| `{{isoDate}}` | Full ISO date, e.g. `2026-06-17` |

## Works for many conventions

| Use case | Pending → Done |
| --- | --- |
| Cycle check-ins | `26.06.17 — Check in —` → ` ✓` |
| Freelancer daily log | `2025-06-17 Work Log [ ]` → `[x]` |
| Student lecture notes | `Jun 17 — Lecture —` → ` ✓` |
| Researcher field notes | `2025.06.17 Field Note OPEN` → `DONE` |
| Weekly standup | `W25 — Standup —` → ` ✓` |
| Habit tracker | `250617 [ ]` → `[x]` |

## Development

```bash
npm install      # install dev dependencies
npm run dev      # watch build → main.js
npm run build    # type-check + production build
```

To test in a vault, copy (or symlink) `manifest.json`, `styles.css`, and the built `main.js` into `<vault>/.obsidian/plugins/obsidian-checkin/`, then enable the plugin in **Settings → Community plugins**.

## License

[MIT](LICENSE)
