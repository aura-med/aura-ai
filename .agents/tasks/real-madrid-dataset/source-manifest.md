# Source manifest: Real Madrid dataset

Retrieval date for every source below: **2026-11-27**. Companion file: `real-madrid-dataset.json`. Public data only. No credentials or private contact data were used or stored.

## Sources

| # | Source | URL | Used for |
|---|---|---|---|
| S1 | Real Madrid official first-team page | https://www.realmadrid.com/en-US/football/first-team/players | Roster membership (26 players), shirt numbers, official position labels, technical staff. Controls membership. |
| S2 | Transfermarkt squad page (raw HTML) | https://www.transfermarkt.com/real-madrid/kader/verein/418 | Cross-check of the 26 names and numbers, player profile URLs, citizenships, contract expiry dates, public injury flags |
| S3 | Transfermarkt player profiles (26 pages, one per player; paths are in each roster entry as `transfermarktProfileUrl`) | https://www.transfermarkt.com/ + `/<slug>/profil/spieler/<id>` | Date of birth, place of birth, height, preferred foot |
| S4 | Transfermarkt squad statistics | https://www.transfermarkt.com/real-madrid/leistungsdaten/verein/418 | 2026-27 appearances, goals, minutes (LaLiga + Champions League, 18 team matches) |
| S5 | Transfermarkt schedule | https://www.transfermarkt.com/real-madrid/spielplan/verein/418 | 38 LaLiga and 8 Champions League league-phase fixtures, results, kick-off times |
| S6 | Wikipedia, 2026-27 Real Madrid CF season | https://en.wikipedia.org/wiki/2026%E2%80%9327_Real_Madrid_CF_season | Cross-check of fixtures and season stats (credited to FBref, as of 2026-11-24); Supercopa semi-final; Copa del Rey round of 32 window; president, captain, reschedule notes |
| S7 | Wikipedia player articles (26) | `https://en.wikipedia.org/wiki/<Player>`, titles listed in each roster entry's `career.source` | Career (youth and senior clubs, national teams), second DOB and height source |
| S8 | Wikipedia, List of Real Madrid CF players | https://en.wikipedia.org/wiki/List_of_Real_Madrid_CF_players | Captain (Valverde), club facts |
| S9 | FBref | not fetched | Returned HTTP 403 to automated fetch in the earlier run. Only reachable through Wikipedia's credit line in S6. |
| S10 | realmadrid.com calendar pages | `/en-US/football/calendar`, `/en-US/football/first-team/calendar-results` | Both returned HTTP 404. No official-site fixture confirmation was possible. |

Method note: Wikipedia text was read through its public API (wikitext); Transfermarkt through plain HTTP GET.

## Field sources

| Dataset field | Source | Cross-check |
|---|---|---|
| name (full), shirtNumber | S2 name, S1 number | S1 vs S2: all 26 numbers agree |
| officialPageLabel, position | S1 | S2 position group, S6 position. See Conflict 1 |
| dateOfBirth | S3 | S7 infobox: all 26 equal. S2 ages are consistent with the dates |
| nationality (form value) | S7 national team and S2 first citizenship (agree for all 26), mapped to `lib/nationalities.ts` | See normalizations |
| placeOfBirth, preferredFoot, contractExpires | S3 / S2 | none |
| heightCm | S3 | S7 height stored as `heightCmWikipedia`. See Conflicts 2-10 |
| career (clubs, national teams) | S7 | none; scope and as-of dates vary |
| performance (appearances, goals, minutes) | S4, season 2026-27, as of 2026-11-27 | S6 appearances and goals: all 26 agree. Minutes have no second source |
| calendar OFFICIAL LaLiga and Champions League | S5 | S6: dates, home/away and scores agree for all 46 |
| calendar OFFICIAL Supercopa semi-final | S6 only | none. See Conflict 15 |
| team facts | S1 staff, S6/S8 president, captain, stadium | none |

## Conflicts (nothing merged silently)

Each item lists the values and the value used in the dataset.

1. **Brahim Díaz position.** S1 page lists him under the "Midfielders" heading but labels him "Forward". S2 lists "Right Winger" (attack group). S6 squad table lists FW. Dataset uses **FWD** (three of four indications). Alternative: MID.
2. **Height, Thibaut Courtois.** S3 200 cm, S7 201 cm. Used: 200.
3. **Height, Dean Huijsen.** S3 195, S7 196. Used: 195.
4. **Height, Eduardo Camavinga.** S3 182, S7 185. Used: 182.
5. **Height, Endrick.** S3 172, S7 173. Used: 172.
6. **Height, Kylian Mbappé.** S3 180, S7 178. Used: 180.
7. **Height, Arda Güler.** S3 176, S7 175. Used: 176.
8. **Height, Marc Cucurella.** S3 174, S7 173. Used: 174.
9. **Height, Yan Diomande.** S3 180, S7 182. Used: 180.
10. **Height, Thiago Pitarch.** S3 179, S7 175. Used: 179. (Heights from S3 are used throughout for consistency; S7 values are kept in `heightCmWikipedia`.)
11. **Place of birth, Andriy Lunin.** S3 "Krasnograd, Kharkiv Oblast", S7 "Berestyn, Ukraine". Used: S3.
12. **Place of birth, Arda Güler.** S3 "Ankara", S7 "Altındağ, Turkey" (a district of Ankara). Used: S3.
13. **LaLiga matchday numbers, opening fixtures.** S5 numbers the 26 Aug Real Sociedad match as matchday 1 and the 22 Aug Espanyol match as matchday 2. S6 numbers them 2 and 1. Dates agree. S6 notes the Real Sociedad match "was pushed back" because of the World Cup. Calendar titles carry no matchday number. Both numbers are in `transfermarktMatchday` and `wikipediaRound`.
14. **LaLiga matchday numbers, 2 Dec 2026 to 31 Jan 2027.** S5 numbers the 2 Dec Real Sociedad match as 23 (moved forward for the Supercopa) and the next nine league matches 15 to 22. S6 numbers them 15 to 23 in date order. Dates agree. Same handling as Conflict 13.
15. **Supercopa de España semi-final, 3 Feb 2027, Real Sociedad vs Real Madrid.** Present in S6 (Beşiktaş Stadium, 22:00 UTC+3), absent from S5. Not confirmed on S1 or rfef.es. Kept as OFFICIAL with `sourceConfidence` noting a single secondary source. Kick-off in Madrid time is not recorded.
16. **Squad membership.** S4 also lists seven non-first-team players (Javi Navarro, Sergio Mestre, Ilya Voloshyn, Mario Rivas, Jorge Cestero, Sergio Martínez, Alexis Ciria). S1 controls membership, so they are excluded. The 26 on S1 and S2 are the same people.

Total recorded conflicts: **16**.

### Data-quality flags (not source disagreements, not counted)

- **Carlos Espí minutes.** S4 shows 62' for 12 appearances and 4 goals, which looks low (the raw HTML confirms "62'"). Stored as published. Check against a second source before using the minutes value.
- **Wikipedia disciplinary table** prints Rüdiger as shirt 18 (S1 and S2: 22). Not used.
- **Wikipedia career infobox figures** are not comparable with S4: several rows are league-only and as-of dates differ (for example Álvaro Carreras's national-team data is as of May 2025). They are kept under `career` with a scope note and are not added to season figures.
- **Three players have a public injury flag on S2:** Raúl Asencio (fatigue fracture, return expected 2027-01-01), Rodrygo (cruciate ligament tear, return expected 2026-12-31), Endrick (muscle injury, return unknown). Stored as `publicAvailabilityReport`. This is not a clinical record. The fictional clinical test data must not be built on it without saying so.
- **Rodrygo and Ferland Mendy** have no 2026-27 appearances (S4: not in squad this season). Asencio was called up for 3 matches and did not play. All three have zeros in `performance`, with a `status` string.

### Normalizations (not conflicts)

- Names: the official page uses short labels ("Trent", "Vini Jr.", "Thiago", "Brahim"). Dataset `name` uses the S2 full names ("Trent Alexander-Arnold", "Vinicius Junior", "Thiago Pitarch", "Brahim Díaz"). The label is kept as `officialPageLabel`.
- Nationality: the athlete form accepts only names in `lib/nationalities.ts`. "Türkiye" is stored as **Turkey**, "Cote d'Ivoire" as **Ivory Coast**. Multi-citizenship players are stored with their senior national team (for example Brahim Díaz: Morocco, born in Spain; Huijsen: Spain; Militão: Brazil). All other citizenships are in `citizenshipsTransfermarkt`.
- Kick-off times: S5 shows Madrid time. S6 shows local time with a UTC offset (for example AEK Athens 19:45 UTC+2 equals 18:45 Madrid, S5 shows 6:45 PM). The dataset stores Madrid time. Fixtures after 2026-12-13 have no published time (S5 "Unknown", S6 "--:--").
- Spelling: "Lisbon"/"Lisboa", "Las Palmas"/"Las Palmas de Gran Canaria". Not counted.

## Calendar summary

| Category | Count | Notes |
|---|---|---|
| OFFICIAL | 47 | 38 LaLiga, 8 Champions League league phase, 1 Supercopa semi-final. 18 are already played (13 LaLiga, 5 Champions League) and carry results. 29 are scheduled. |
| TEST PLACEHOLDER | 4 | Copa del Rey round of 32 (window 15-17 Dec, stand-in 16 Dec), Copa del Rey round of 16 (conditional), Supercopa final (conditional), Champions League knockout phase (conditional). Titles start with "TEST PLACEHOLDER". Not official matches. |
| INTERNAL TEST EVENT | 11 | 27 Nov to 11 Dec 2026: 5 training, 3 rest, 3 travel. Invented by the test plan. Titles start with "TEST EVENT". |

Pre-season friendlies (24 Jul to 16 Aug 2026) are listed in S6 but excluded from the calendar.

Intensity values (`low|medium|high|max`) are in the dataset, but recon found no UI field for intensity. Rows entered through the UI keep it empty.

## Profile field mapping

Existing app fields (from `recon.md`):

| Dataset item | Fits an existing field? | Where |
|---|---|---|
| name | Yes | `athletes.name` |
| shirtNumber | Yes | `athletes.shirt_number` |
| position (GK/DEF/MID/FWD) | Yes | `athletes.position` |
| dateOfBirth | Yes | `athletes.date_of_birth` |
| nationality | Yes | `athletes.nationality` (list-restricted, see normalizations) |
| club "Real Madrid" | Yes | `athletes.club` (free text in a federation org) |
| heightCm | Yes | `athletes_medical_history.height_cm` (Ficha Clínica) |
| short bio sentence (for example "Born in X, plays for Y national team") | Yes, as text | `athletes_medical_history.notes` |
| weight | Not collected. No reliable public source was found. | `athletes_medical_history.weight_kg` / `athlete_daily_weight` stay for fictional test values |
| appearances, goals, minutes (2026-27) | **No field.** Manifest only. | `performance` in the JSON |
| career clubs, national teams and caps | **No field.** Manifest only. | `career` in the JSON |
| contract expiry, preferred foot, place of birth, other citizenships, Transfermarkt position | **No field.** Manifest only. | `profile` in the JSON |
| public injury flags | **No field, and not clinical.** Manifest only. | `profile.publicAvailabilityReport` |
| calendar title, date, type, opponent, venue | Yes | `calendar_events.label`, `event_date`, `event_type`, `opponent`, `venue` |
| calendar category (OFFICIAL / TEST PLACEHOLDER / INTERNAL TEST EVENT) | **No field.** Carry it in the label text prefix ("TEST EVENT:", "TEST PLACEHOLDER:"). Official rows have no prefix. | title |
| calendar intensity, result, kickoff time, stadium | **No UI field.** Manifest only. | JSON |
| squad name, type, season | Yes | `squads.name`, `type` (male), `season` ("2026-27", set through `updateSquad`) |
| team facts (stadium, president, coach, staff) | **No field.** Manifest only. | `team` in the JSON |
