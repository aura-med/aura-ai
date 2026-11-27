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
## Profile step (2026-11-27)
- Approach: user approved a Playwright run through the real UI (no API, no DB access). Fresh login with SOPHI_TEST_EMAIL/SOPHI_TEST_PASSWORD read from .env.local at runtime; scripts /tmp/rm/prof.mjs and verprof.mjs (not committed). A first attempt using a saved session file was refused by the permission layer and not retried.
- Entered per player via athlete page > Ficha Clínica > "Editar dados clínicos": Altura (cm) = dataset heightCm (Transfermarkt values); Notas Clínicas = one public-bio line (place and date of birth, nationality, preferred foot, shirt number). Peso and other fields left empty (no public source). Idempotent: players whose values already match are skipped (Courtois was saved in a single-player test run first, then skipped in the full run). No existing notes were overwritten.
- Result: 26 saved, 0 failures. Read-back of all 26 profile pages: height and bio text on screen for 26/26. Roster page shows "26 atletas convocados" = 26 roster entries = 26 profiles.
- Screenshots (GK, DEF, MID, FWD x3): screenshots/06-profile-gk-courtois.png, 06-profile-def-militao.png, 06-profile-mid-bellingham.png, 06-profile-fwd-mbappe.png, 06-profile-fwd-brahim.png, 06-profile-fwd-endrick.png.
- No UI field exists for career (clubs, national teams, caps), performance (appearances, goals, minutes 2026-27), contract expiry, other citizenships or public injury flags. They stay in real-madrid-dataset.json and source-manifest.md.
- Only public bio text was stored in "Notas Clínicas"; no clinical claims.
- gates/core.json does not exist, so there were no review findings to fix.
## Occurrences step (2026-11-27)
- Driven with Playwright through /occurrences?squadId=... (Registar Ocorrência modal, row Editar form). Credentials from .env.local at runtime. No DB access, no repo code changed. Scripts in /tmp/rm (occ-run.mjs, occ-fix.mjs, occ-ver.mjs), not committed. Next.js docs not read because no repo code was written.
- Created 36 occurrences for 13 players. Types: see entity-id-log.md (all four: Queixa, Trauma, Doença, Outro). Opening statuses: Disponível and Em Avaliação (the only two the UI offers). Every observation carries "FICTIONAL TEST DATA - NOT A REAL MEDICAL RECORD". Scenario list: clinical-scenarios.md; log: entity-id-log.md (row ids are not exposed in the UI; identified by athlete id, title, date).
- Incident: the first create run hit the tool timeout with no output but kept running; I started a second run while it was still going. Both created 10 of the same records (duplicate titles), the idempotency check raced. No delete action exists in the UI, and deletion was out of scope, so I used the Editar flow to turn each of the 10 duplicates into a distinct extra scenario (new title, date, type, observations). End state: 36 distinct titles, no duplicates.
- Validation test: submitting the register modal with an empty Título shows "Título obrigatório" and creates nothing (screenshots/07-occurrence-validation-error.png). Result PASS. The opening-status restriction is enforced by the select (only Disponível / Em Avaliação); not tested with a crafted server call.
- Edit test: "Gastroenterite aguda" (Camavinga) observations edited via Editar > Guardar; after reload the new text is on screen (PASS, screenshots/08-occurrence-edit-view.png). Ten more edits (the duplicate re-purposing) all saved.
- View test: rows expand to show observations, status badge, actions (screenshots/09-occurrences-all.png).
- On-screen counts (Todas filter, /occurrences?squadId=Real Madrid): "Ativas (36)", 36 rows. Per player (rows on screen = expected): Courtois 2, Militão 2, Mendy 2, Rüdiger 2, Bellingham 3, Camavinga 4, Valverde 3, Tchouaméni 3, Güler 2, Vinicius 3, Mbappé 2, Rodrygo 4, Endrick 4 = 36.
- Note: the badge on each row shows the athlete's current status, not the occurrence's opening status, so players with several occurrences show the most restrictive/latest.
- gates/clinical.json does not exist, so there were no review findings to fix.
