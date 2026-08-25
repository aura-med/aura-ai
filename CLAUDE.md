# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build
npm run lint     # eslint
```

There is no test suite configured.

## Architecture

**Sophi** is a predictive injury risk management platform for elite football, built with Next.js 16.2.4 App Router, React 19, TypeScript, Supabase, Tailwind CSS v4, next-intl, Zustand, and Recharts.

### Route groups

- `app/(auth)/` — unauthenticated routes (login)
- `app/(dashboard)/` — authenticated shell with `Topbar` + `Sidebar` layout (fixed, not scrolling); main content has `ml-60 mt-14` offsets

### Supabase clients

Two distinct clients — use the right one for the context:

- `lib/supabase/client.ts` — browser singleton (`createBrowserClient`), for Client Components
- `lib/supabase/server.ts` — async factory (`createServerClient`), for Server Components and API routes; must `await createClient()`
- `lib/supabase.ts` — typed query helpers built on the browser client (e.g. `getAthletes`, `getAthlete`, `upsertWellnessCheckin`)

Auth uses Supabase email/password. Sessions are refreshed via cookies; middleware is not present, but `server.ts` sets cookies within a try/catch to handle Server Component limitations.

### Scoring engine

**Scoring must run server-side only** (see `app/api/athletes/[id]/score/route.ts`). The canonical server implementation lives in `lib/scoring/engine.ts` (`calculateScore`, `BASE_WEIGHTS_V1`). The file `lib/scoring.ts` is an older client-side port used only for display helpers (`riskColor`, `riskLabel`, `VAR_LABELS`, etc.) — do not add new scoring logic there.

The score (0–100) is a weighted sum of 9 normalised variables: `history`, `acwr`, `hrv`, `fatigue`, `sleep`, `tqr`, `stress`, `decel`, `md`. Risk bands: low <40, medium 40–64, high 65–84, critical ≥85. ACWR is EWMA-based (7-day acute / 28-day chronic) computed from `gps_sessions`. Scores are persisted daily to `score_history` (upsert on `athlete_id, score_date`).

Female-squad scoring includes a menstrual cycle LCA-risk multiplier — see `lib/menstrual/cycle.ts` and `getMenstrualPhase` in `lib/scoring.ts`.

### State management (Zustand)

- `stores/athleteStore.ts` — in-memory athlete list and selected athlete ID; not persisted
- `stores/uiStore.ts` — persisted to localStorage (`sophi-ui`): active role (`UserRole`), theme, locale, and selected `squadId`/`orgId`

### Multi-squad / multi-org

Squad context is carried as a `?squadId=` query parameter across dashboard pages. Use `lib/squad-url.ts` helpers (`getSquadIdParam`, `withSquadParam`) to read/write this param consistently — do not hard-code URL construction.

### i18n

next-intl is configured via `i18n/request.ts`. The active locale is read from the `NEXT_LOCALE` cookie (default: `pt`). Supported locales: `pt`, `en`, `es`. Message files live in `messages/`. Setting the locale writes the cookie directly (`uiStore.setLocale`).

### Styling

Tailwind CSS v4 with PostCSS. Theme tokens are CSS custom properties (`--sophi-bg`, `--sophi-green`, `--sophi-border`, `--sophi-text`, etc.) defined in `app/globals.css`. Prefer inline `style={{ color: 'var(--sophi-text2)' }}` over one-off Tailwind colour utilities when using Sophi design tokens. UI primitives in `components/ui/` are shadcn-based; `components/ui/sophi.tsx` has project-specific variants.

Fonts: Inter (`--font-inter`), DM Mono (`--font-dm-mono`), Syne (`--font-syne` — used for headings and the brand wordmark).

### Environment variables

Copy `.env.local.example` to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
