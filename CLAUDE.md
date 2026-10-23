# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build
npm run lint     # eslint
```

Tests live in `tests/` and `lib/*.test.ts` (vitest / playwright configs at the repo root).

## Architecture

**Sophi Sports** ("sophi — behind your team") is a predictive injury risk management platform for elite football, built with Next.js 16.2.4 App Router, React 19, TypeScript, Supabase, Tailwind CSS v4, next-intl, Zustand, and Recharts.

### Route groups

- `app/(auth)/` — unauthenticated routes (login)
- `app/(dashboard)/` — authenticated shell with `Topbar` + `Sidebar` layout (fixed, not scrolling); main content has `ml-60 mt-14` offsets

### Supabase clients

Two distinct clients — use the right one for the context:

- `lib/supabase/client.ts` — browser singleton (`createBrowserClient`), for Client Components
- `lib/supabase/server.ts` — async factory (`createServerClient`), for Server Components and API routes; must `await createClient()`
- `lib/supabase.ts` — typed query helpers built on the browser client (e.g. `getAthletes`, `getAthlete`, `upsertWellnessCheckin`)

Auth uses Supabase email/password. Sessions are refreshed via cookies; `proxy.ts` guards routes, and `server.ts` sets cookies within a try/catch to handle Server Component limitations.

### Scoring engine

**Scoring must run server-side only** (see `app/api/athletes/[id]/score/route.ts`). The canonical server implementation lives in `lib/scoring/engine.ts` (`calculateScore`, `BASE_WEIGHTS_V1`). The file `lib/scoring.ts` is an older client-side port used only for display helpers (`riskColor`, `riskLabel`, `VAR_LABELS`, etc.) — do not add new scoring logic there.

The score (0–100) is a weighted sum of 9 normalised variables: `history`, `acwr`, `hrv`, `fatigue`, `sleep`, `tqr`, `stress`, `decel`, `md`. Risk bands: low <40, medium 40–64, high 65–84, critical ≥85. ACWR is EWMA-based (7-day acute / 28-day chronic) computed from `gps_sessions`. Scores are persisted daily to `score_history` (upsert on `athlete_id, score_date`).

Female-squad scoring includes a menstrual cycle LCA-risk multiplier — see `lib/menstrual/cycle.ts` and `getMenstrualPhase` in `lib/scoring.ts`.

### State management (Zustand)

- `stores/athleteStore.ts` — in-memory athlete list and selected athlete ID; not persisted
- `stores/uiStore.ts` — persisted to localStorage (`sophi-ui`): active role (`UserRole`), theme (default `light`), locale, and selected `squadId`/`orgId`

### Multi-squad / multi-org

Squad context is carried as a `?squadId=` query parameter across dashboard pages. Use `lib/squad-url.ts` helpers (`getSquadIdParam`, `withSquadParam`) to read/write this param consistently — do not hard-code URL construction.

### i18n

next-intl is configured via `i18n/request.ts`. The active locale is read from the `NEXT_LOCALE` cookie (default: `pt`). Supported locales: `pt`, `en`, `es`. Message files live in `messages/`. Setting the locale writes the cookie directly (`uiStore.setLocale`).

### Styling

Tailwind CSS v4 with PostCSS. Brand: navy `#000056` + white, Poppins (guideline in `public/sophi_branding/`; landing page in `landing_page/` is the visual reference). Theme tokens are CSS custom properties defined in `app/globals.css` — **light is `:root` (default), dark is `html.dark`** (class toggled by `components/ThemeProvider.tsx`; a pre-hydration script in `app/layout.tsx` applies the persisted theme). Prefer inline `style={{ color: 'var(--sophi-text2)' }}` over one-off Tailwind colour utilities.

Token roles: `--sophi-bg/bg2/bg3/bg4`, `--sophi-text/text2/text3`, `--sophi-border/border2`; brand chrome (buttons, links, active tabs, focus) uses `--sophi-primary` + `--sophi-on-primary` and `--sophi-accent` / `--sophi-accent-bg` / `--sophi-on-accent`; **status colours (`--sophi-green/warn/orange/danger`, `--risk-*`) are semantic only** (risk, success, warning) — never use green as a brand accent. Don't append hex alpha to colour values (`${color}20`); use `color-mix(in srgb, <color> N%, transparent)`. The logo is `components/brand/SophiLogo.tsx` (inline SVG, `currentColor` via `--sophi-logo`). UI primitives in `components/ui/` are shadcn-based; `components/ui/sophi.tsx` has project-specific variants.

Fonts: Poppins (`--font-poppins`, aliased as `--font-display` / `--display` / `--body`) for all text; DM Mono (`--font-dm-mono`, `--font-mono` / `--mono`) for numbers and labels. The Admin App (`apps/admin/`, separate Next app on :3001, run with `npm run admin:dev`) has its own `globals.css` with the same token set and its own copy of `SophiLogo`; keep the two in sync.

### Environment variables

Copy `.env.local.example` to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
