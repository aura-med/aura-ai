# Recon: Real Madrid dataset (read-only; no data written)

Date seen in the apps: 27 Nov 2026. No secrets recorded here.

## ENVIRONMENT VERDICT
- Admin portal (aura-ai-admin.vercel.app), the testing preview deployment and the local `.env.local` all talk to the **same Supabase project, ref `snifyosgqylnrifjdhij`** (seen in browser network hosts for both sites; local `.env.local` and `apps/admin/.env.local` carry the same host).
- The preview is a Vercel branch preview of the same code but **not a separate database**. No evidence of a test/staging database.
- Admin portal lists 8 orgs, all active: Activemed (12 athletes), AD Oeiras (16), Estrela da Amadora (68), FPF (46), FC Porto (0), Benfica (41), SC Braga (0), Sporting CP (32). 167 athletes lack consent. Several are real club names with rosters, so this may be live or customer data.
- The main-app test login is an **owner of the FPF org (federation)**, user "Alexandre Cardoso". Squads there: National Sub-16 (22 athletes), National Sub-19 (0), Seleção A (23). Org has 2 users, both owners. Profiles have a single `org_id`, so this login cannot also belong to a new org.
- Verdict: writes land in the shared Supabase project, in whichever org is used. It is **not provably a test environment**. Names (SOPHI_TEST_*) suggest a dev account, but the DB is shared with the production admin portal. User confirmation needed before writing.

## (1) Creating a team
Admin portal `/organizations` -> "Create organization" (`apps/admin/lib/actions.ts` `createOrganization`):
- name (text, required), type (club | federation), plan (trial | standard | enterprise), module checkboxes readiness, rehab, performance, female_squad, passport (default all on). Inserts into `organizations` with status active.
- It creates an **organization only**. No squad, no owner user.
- Owner access needs `/users` -> invite form (`inviteUser`): email (required), full_name, org_id, role (owner, doctor, physio, ...). It calls `auth.admin.inviteUserByEmail`, which **sends a real email** and sets needs_password. So a new org needs a mailbox the user controls.
- Club orgs force athlete `club` to the org name. Federations take free text.

Main app squad creation (`lib/actions/squad.ts` `createSquad`, `lib/schemas/squad.ts`): `/settings/squads` -> "Novo Squad". Fields: name (1-100), type (male | female). Role must be owner or doctor. Org taken from the viewer. A later `updateSquad` can set `season` (<=40 chars).

Player creation (`lib/schemas/athlete.ts`, `app/(dashboard)/athletes/actions.ts` `createAthlete`): `/squad` ("Plantel") -> "Adicionar jogador". Fields: squad_id, name (required), shirt_number 0-99, position (GK|DEF|MID|FWD), date_of_birth (YYYY-MM-DD, not future), nationality (must be in `lib/nationalities.ts` list, e.g. "Spain", "Brazil", "England", "France"; "Türkiye" style names not allowed, use "Turkey"), club (free text for federations), menstrual fields only for female squads. Role: owner or rehab roles.

Decision needed from user: (A) new club org "Real Madrid" via admin + invite an owner email the user controls, then log in as that owner; or (B) create a "Real Madrid" squad inside the existing FPF org with the test login (club field "Real Madrid"). B works with current credentials but mixes a club into a federation org with real-looking data.

## (3) Calendar editor
- `calendar_events` columns: squad_id, event_date, event_type, intensity, label, is_match_day, opponent, venue (home|away|neutral) (009). Type check allows rest, training, match, travel, **recovery** (075). Intensity (low|medium|high|max) exists in the table but **no UI sets it**; it would stay null.
- Persisted editor: **`/team-calendar`** (`components/dashboard/MonthCalendar.tsx`, `EventEditor`): per-event date, type (Jogo, Treino, Recovery, Viagem, Folga), label, opponent, venue. Writes via browser Supabase client. Needs squad selected (`?squadId=`). RLS write: owner/coach.
- `/settings/calendar` (`app/(dashboard)/settings/calendar/page.tsx`) is also persisted, with "Adicionar Jogo" (date, opponent, venue) and "Adicionar Sessão" (date, type training|recovery|rest|travel, label). Faster for bulk fixtures; lists only the 60 latest events.
- `/calendar` ("Calendar Intelligence", `lib/data/calendar.ts`) is read-only and marked "Em dev."; not an editor.
- Note: FPF "Seleção A" already has 10 match days and 34 sessions, with a stray event dated 0006-06-30. Do not reuse that squad's calendar.
- No bulk import. 2026-27 fixtures must be entered one by one via UI (about 60 matches plus any test events).

## (4) Player public profile data
- `athletes` has only name, shirt_number, position, date_of_birth, nationality, club (+ consent, status). No appearances/goals/minutes columns.
- `athletes_medical_history`: height_cm, weight_kg, blood_type, allergies, intolerances, notes (athlete page "Ficha Clínica"). `athlete_anamnesis` (per season, free text). `athlete_daily_weight` (Nutrição). `athlete_passport.passport_data` JSONB exists, but `/passport` is "Em dev." with no editor. `performance_data` is GPS-only.
- Can be stored in-app: name, number, position, DOB, nationality, club, height, weight (public values), notes (short bio in medical history notes).
- Needs a **source manifest file** (not in app): appearances, goals, assists, minutes, market data, contract, source URLs and retrieval dates.

## (5) Clinical flows (all UI, Portuguese labels)
- Occurrences: `/occurrences` (`OccurrencesClient`, `registerOccurrence`): athlete, title, date, type (complaint|trauma|disease|other), SOAP fields, availability. **Opens only as available or evaluation.** Reassessment via `addOccurrenceRecord`; Indisponível requires a diagnosis (`addOccurrenceRecordWithDiagnosis`, migration 098).
- Diagnoses: `createDiagnosis` (`lib/actions/clinical.ts`) via athlete page `/athletes/[id]` (tabs Overview, Ficha Clínica, Lesões, Tratamentos, Nutrição, Plano de Treino, Documentos, Recomendações) -> `DiagnosisModal`, or from an occurrence row. Fields: OSIICS code/description or custom, type injury|disease, availability (not `rtp`), restrictions, notes, occurrence link. **One active diagnosis per occurrence.** Injury characterization (only for type injury): diagnosisDate, context (training|match|outside_activity), matchMinute (match only), mechanism (traumatic|overuse), contactType (traumatic only), playerAction, foulInvolved, bodyRegion, bodySide, tissueType, isRecurrence + relatedDiagnosisId, claimFiled. Plan 20+ diagnoses means 20+ occurrences for 10+ players (some players with 2), and some recurrences.
- Rehab plans: `/rehab` (`RehabPlansClient`, `lib/actions/rehab-plan.ts`, migration 034): createRehabPlan (title, startDate, expectedEndDate, occurrenceId), phases, criteria, days. **Only one active plan per athlete** (unique index); close before a new one. RTP availability is reached only through an RTP-type phase.
- `/rehab-protocol` is a separate legacy feature (`rehab_sessions`, protocol templates, `lib/data/rehab.ts`); test it separately, not as the plan flow.
- Nutrition: `/nutrition` (`registerAthleteWeight`: athlete, date, weightKg, upsert per day; `nutrition_assessments`; `athlete_supplements` in athlete "Nutrição" tab).
- Medication: `/medication` and athlete "Tratamentos" tab -> `administerMedication` (name, dose, route, notes, administeredAt).
- Availability is recomputed after every write (`recompute_and_persist_athlete_availability`).

## (6) Idempotency
No Real Madrid organization in the admin list, and no Real Madrid squad in FPF (squads: National Sub-16, National Sub-19, Seleção A). Nothing exists yet. Before writing, re-check `/organizations` (or `/settings/squads`) and `/squad` for the name, and log every created ID in `entity-id-log.md`.

## (7) Execution plan (after user answers the environment question)
1. Source data: roster, DOBs, nationalities mapped to the allowed list, 2026-27 fixtures (LaLiga, Champions League, Copa del Rey, Supercopa), with source URLs in a manifest.
2. Org path A: admin `/organizations` create "Real Madrid" (club, plan trial, modules on); admin `/users` invite owner (user's mailbox); log in to main app. Path B: skip.
3. `/settings/squads` -> Novo Squad "Real Madrid" (male); optionally set season 2026-27.
4. `/squad` -> add each first-team player; add height/weight/notes on `/athletes/[id]` Ficha Clínica.
5. `/team-calendar` (or `/settings/calendar`) -> enter fixtures, plus clearly labelled test events (training, recovery, travel, rest).
6. Verify squad, roster and calendar render with `?squadId=`.
7. `/occurrences` -> 10+ players, 20+ occurrences, then diagnoses (with injury characterization and some recurrences) on `/athletes/[id]` or occurrence rows. Fictional clinical records, labelled as test.
8. `/rehab` -> rehab plans for several diagnosed players (one active per athlete); separately exercise `/rehab-protocol`.
9. `/nutrition` and `/medication` test plan: weights, supplements, medication administrations, profile data.
10. Record everything in `entity-id-log.md` and screenshots; no deletion without user approval.

## User decision (recorded)
Path B chosen: create a "Real Madrid" squad (male) inside the existing FPF org with the test login (SOPHI_TEST_EMAIL). No new org, no admin-portal writes, no invite email. Writing to the shared DB accepted by the user's choice. Player `club` field is free text for federations: set "Real Madrid". Label all clinical records as fictional test data. Do not touch existing FPF squads (National Sub-16, Sub-19, Seleção A).
