# Phase Notes

## Core step: squad + roster (2026-11-27)
- Path B per recon.md user decision: squad created in the existing FPF org via the main app UI (testing preview URL, SOPHI_TEST_EMAIL login). No admin-portal writes, no direct DB access. No repo code changed.
- Driven with Playwright (scripts in /tmp, not committed; credentials read from .env.local at runtime, never logged).
- Idempotency: checked /settings/squads and the roster page before each create; the roster script skips names already present (rerun after a timeout skipped 17 existing players, no duplicates).
- Squad "Real Madrid", type Masculino; season set to "2026-2027" via the edit dialog.
- Added 26 players (position, shirt number, DOB, nationality, club "Real Madrid" typed per player because the dialog's club list is not persisted).
- On-screen verification: /settings/squads shows "Real Madrid, male · 26 atletas"; /squad?squadId=... shows "26 atletas convocados" (GK 2, DEF 10, MID 7, FWD 7); edit dialog shows season 2026-2027; Courtois detail page shows "GK · 34 anos · Real Madrid".
- Screenshots: screenshots/01-settings-squads.png, 02-squad-roster.png, 03-player-detail.png, 04-squad-season.png.
- Limits: DOB and nationality are not shown in the list views; they were entered from the dataset and not re-read on screen beyond the age on the detail page. gates/core.json does not exist, so no review findings to fix.
