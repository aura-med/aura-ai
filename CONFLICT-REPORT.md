# PR Conflict Report — 5 Open PRs vs `main`

Generated: 2026-06-01  
Methodology: `git merge-tree` simulation + line-level diff analysis across all 10 branch pairs (C(5,2))

---

## The 5 PRs

| ID | Branch | PR | Files changed |
|----|--------|----|---------------|
| B1 | `feature/readiness-model` | #67 | 7 |
| B2 | `feature/mobile-responsive` | #66 | 44 |
| B3 | `feature/athlete-profile` | #65 | 35 |
| B4 | `feature/recommendations-model` | #35 | 47 |
| B5 | `feature/new-branch` | #34 | 50 |

> **Note:** B2 is a strict superset of B3 — it contains all 18 of B3's commits plus 3 additional mobile-only commits. Merging B3 before B2 is clean.

---

## Conflict Matrix

|    | B1 | B2 | B3 | B4 | B5 |
|----|----|----|----|----|-----|
| **B1** | — | ✅ Clean | ✅ Clean | ✅ Clean | ✅ Clean |
| **B2** | ✅ Clean | — | ✅ Clean | 🔴 5 files | ✅ Clean |
| **B3** | ✅ Clean | ✅ Clean | — | 🔴 1 file | ✅ Clean |
| **B4** | ✅ Clean | 🔴 5 files | 🔴 1 file | — | ✅ Clean |
| **B5** | ✅ Clean | ✅ Clean | ✅ Clean | ✅ Clean | — |

**Summary:** `feature/recommendations-model` (B4) is the sole source of conflicts. It conflicts with both `feature/athlete-profile` (B3) and `feature/mobile-responsive` (B2). All other 8 pairs are clean.

---

## Conflict Details

### Conflict 1 — `app/(dashboard)/athletes/[id]/page.tsx`
**Branches:** B3 vs B4, B2 vs B4  
**Severity:** 🔴 High — architectural incompatibility

| Branch | What it does to this file |
|--------|--------------------------|
| **B3/B2** | Complete rewrite: removes all existing JSX (score grid, readiness row, GPS section). Delegates entire page to `<AthleteProfileClient>` with a tabbed layout (overview, medical, injuries, treatments, documents). Adds medical data fetches (history, EMD, SCAT-6, concussion). |
| **B4** | Incremental enhancement: keeps the existing score/readiness/GPS grid. Swaps `RecommendationTabs` → `RecommendationsPanel`. Adds parallel auth fetch + `getLatestRecommendations()`. Adds viewer role detection. |

**Root cause:** B3 deleted the JSX structure that B4 assumes still exists.

**Resolution strategy — use B3 as the base, port B4's recommendations into it:**
1. Keep B3's `AthleteProfileClient` tabbed architecture as the page shell
2. Add B4's imports: `RecommendationsPanel`, `getLatestRecommendations`, `acknowledgeRecommendations`, `UserRole`
3. Add B4's data fetches into B3's server component:
   ```ts
   const [{ data: { user } }] = await supabase.auth.getUser()
   const [profileResult, recData] = await Promise.all([
     supabase.from('profiles').select('role').eq('id', user?.id ?? '').maybeSingle(),
     getLatestRecommendations(id),
   ])
   const viewerRole = (profileResult.data?.role ?? 'athlete') as UserRole
   ```
4. Re-add B4's GPS/performance data to the athlete fetch (B3 had removed these queries)
5. Pass `{ recommendations: recData, viewerRole }` to `AthleteProfileClient` props
6. Add a `recommendations` tab in the client component rendering `<RecommendationsPanel>`

---

### Conflict 2 — `components/layout/Sidebar.tsx`
**Branches:** B2 vs B4  
**Severity:** 🔴 High — different responsive approaches

| Branch | What it does |
|--------|-------------|
| **B2** | Full mobile drawer: adds `mobileSidebarOpen` state, z-40 sidebar, z-30 backdrop overlay, slide-in/out with `translate-x` + `transition-transform`, auto-close on nav clicks, inline locale switcher footer (mobile only) |
| **B4** | Simple CSS hide: changes className to `hidden w-60 flex-col ... lg:flex` — sidebar hidden on mobile, visible from lg breakpoint, no interactivity |

**Resolution strategy — use B2, add explicit `hidden lg:flex`:**
```tsx
<aside
  className={cn(
    'fixed left-0 top-14 bottom-0 w-60 flex flex-col border-r overflow-y-auto z-40',
    'hidden lg:flex',
    'transition-transform duration-200',
    mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
  )}
>
```
Keep all of B2's state management, backdrop, and close-on-click logic. B4's intent (hide on mobile) is already satisfied by B2's implementation.

---

### Conflict 3 — `components/layout/TopbarClient.tsx`
**Branches:** B2 vs B4  
**Severity:** 🟡 Low — fully compatible changes

| Branch | What it does |
|--------|-------------|
| **B2** | Adds hamburger button (`<Menu>` icon, `md:hidden`), hides squad/lang selectors on mobile (`hidden sm:flex`), increases theme toggle touch target to `min-h-[44px] min-w-[44px]` |
| **B4** | Adds `aria-label="Choose squad"` to the squad `SelectTrigger` |

**Resolution strategy — apply both, they don't overlap:**
- Keep B2's hamburger button, responsive hiding, and touch-target sizing
- Add B4's `aria-label="Choose squad"` to the squad selector trigger

---

### Conflict 4 — `app/(dashboard)/layout.tsx`
**Branches:** B2 vs B4  
**Severity:** 🟡 Medium — same intent, different breakpoints

| Branch | What it changes |
|--------|----------------|
| **B2** | `ml-60` → `md:ml-60`; `p-6` → `p-4 md:p-6` |
| **B4** | `ml-60` → `lg:ml-60`; `p-6` → `p-4 sm:p-6` |

Both remove the fixed left margin on small screens — they differ only in which breakpoint triggers the sidebar margin.

**Resolution strategy — align breakpoints with the sidebar's `lg:flex`:**
```tsx
<main className="mt-14 min-h-[calc(100vh-3.5rem)] p-4 sm:p-6 lg:ml-60">
```
- Use `lg:ml-60` (matches B4's Sidebar `lg:flex` — consistent breakpoint)
- Use `p-4 sm:p-6` (B2's padding — more granular mobile treatment)
- Apply identically to `DashboardLayout` and `DashboardShellFallback`

---

### Conflict 5 — `.gitignore`
**Branches:** B2 vs B4  
**Severity:** 🟢 Trivial — one line added by B4

B4 adds a single line to `.gitignore`. B2 also modifies `.gitignore`. Git will likely auto-resolve this; if not, manually include both sets of ignore rules.

---

## Recommended Merge Order

This order produces only **one round of manual conflict resolution** (at step 4):

| Step | Branch | PR | Conflicts |
|------|--------|----|-----------|
| 1 | `feature/readiness-model` | #67 | None |
| 2 | `feature/new-branch` | #34 | None |
| 3 | `feature/athlete-profile` | #65 | None vs current main |
| 4 | `feature/recommendations-model` | #35 | ⚠️ Resolve `athletes/[id]/page.tsx` (conflict with B3 now in main) |
| 5 | `feature/mobile-responsive` | #66 | ⚠️ Resolve `Sidebar.tsx`, `TopbarClient.tsx`, `layout.tsx`, `.gitignore` (conflict with B4 now in main) |

> Steps 1–3 can be merged in any order. Steps 4 and 5 must follow steps 1–3 and each other in sequence.

---

## Verification

After all 5 are merged into a scratch branch:

```bash
git checkout -b conflict-test/all-prs main
git merge feature/readiness-model
git merge feature/new-branch
git merge feature/athlete-profile
git merge feature/recommendations-model  # resolve athletes/[id]/page.tsx
git merge feature/mobile-responsive       # resolve Sidebar.tsx, TopbarClient.tsx, layout.tsx
npm run build
npm run lint
```

A clean build with no TypeScript errors confirms all conflicts were resolved correctly.
