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

## Calendar step (2026-11-27)
- Driven with Playwright on /team-calendar?squadId=... (header "Adicionar" editor: date, type, opponent, venue, label). Credentials read from .env.local at runtime. No direct DB access, no repo code changed. Scripts in /tmp/rm (caladd.mjs, calver.mjs), not committed.
- Idempotency: before each month the script read existing chip titles and skipped matches. The calendar was empty, so 0 skipped. A first run timed out with no output; the second run found no duplicates (62 added, 62 on screen).
- On-screen read-back, Aug 2026 to May 2027: 62 chips = 47 official + 11 internal + 4 placeholder, matching the dataset. Per month: Aug 3, Sep 5, Oct 5, Nov 9, Dec 14, Jan 8, Feb 6, Mar 3, Apr and May together 9. By colour: match (amber) 51 = 47 official + 4 placeholder, training (blue) 5, rest (grey) 3, travel (purple) 3.
- Official matches carry opponent and venue (neutral for the Supercopa semi-final). The label is the dataset title. Placeholders have no opponent and are labelled "TEST PLACEHOLDER: ...".
- LIMITS: (1) Intensity cannot be set or verified. No calendar UI field or display exists for it (recon.md), so the dataset intensity values are not stored. Adding it would be an app feature, out of scope. (2) The editor forces a venue on matches, so the 4 placeholders were stored with the default venue "Casa". The label is the marker. (3) Kick-off times and results have no fields and are not stored. (4) The dataset has no recovery events.
- Screenshots: screenshots/05-calendar-2026-08.png to 05-calendar-2027-05.png.
- gates/core.json does not exist, so there were no review findings to fix.
