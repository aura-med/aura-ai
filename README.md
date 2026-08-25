# Sophi

## The Operating System for Sports Medicine

Sophi is a Health & Performance Intelligence Platform for professional football clubs. It turns raw biometric, wellness, GPS, and rehabilitation signals into actionable medical protocols that help sports medicine departments protect player availability, reduce avoidable injuries, and coordinate return-to-play decisions with confidence.

> Our mission is to keep elite athletes healthy, available, and performing by giving medical teams a real-time intelligence layer between data collection and clinical action.

## Why Sophi?

In professional football, the squad is the club's most valuable asset. Every preventable soft-tissue injury carries a competitive, medical, and financial cost. Sophi exists to keep players on the pitch by helping multidisciplinary teams move from retrospective reporting to proactive, evidence-led intervention.

Sophi is not just another dashboard. It is designed as the operating layer for sports medicine departments: a shared system where doctors, physios, performance staff, and coaches can understand athlete readiness, detect risk earlier, and adapt rehabilitation plans as the athlete responds.

## Product Preview

![Sophi Dashboard](./public/screenshot.png)

## Core Pillars

| Pillar | What It Enables | Why It Matters |
| --- | --- | --- |
| Injury Risk Prediction | Server-side scoring models synthesize workload, recovery, history, wellness, and contextual signals into risk bands that help staff identify risk before it becomes an absence. | Medical teams can intervene earlier, prioritize the right athletes, and protect availability across congested calendars. |
| Adaptive Rehab | Rehabilitation protocols evolve with athlete feedback, wellness check-ins, loading response, and clinical progress rather than staying fixed to a generic timeline. | Return-to-play becomes more personalized, measurable, and responsive to the athlete's actual recovery curve. |
| Performance Intelligence | Health and performance data live in the same operating context, connecting readiness, load, fatigue, and recovery into a single decision layer. | Clubs can align medical risk, training design, and squad availability instead of treating them as separate workflows. |

## Technical Architecture

| Layer | Technology | Role in Sophi |
| --- | --- | --- |
| Application Framework | Next.js 16 App Router, React 19 | File-system routing, server-rendered clinical workflows, and modern React primitives for fast decision surfaces. |
| Type Safety | TypeScript | Strong contracts for athlete profiles, scoring inputs, rehabilitation state, and sensitive health-related data flows. |
| Data Platform | Supabase | Authentication, database access, and persistence for athletes, wellness check-ins, GPS-derived metrics, and score history. |
| Visualization | Recharts | Real-time-ready charts for risk trends, workload signals, and health/performance interpretation. |
| State Management | Zustand | Lightweight UI and squad-context state for authenticated dashboard workflows. |
| Internationalization | next-intl | Multilingual clinical workflows with Portuguese, English, and Spanish message files. |
| Styling | Tailwind CSS v4, shadcn-based primitives, Sophi CSS tokens | A consistent visual system for high-density medical and performance interfaces. |
| Typography | next/font-managed product typography | Sophi uses a design-first approach for maximum legibility of complex medical metrics. The requested production direction is Vercel's Geist family for clinical readability; the current app imports Inter, DM Mono, and Syne in `app/layout.tsx`. |

### Performance Principles

Sophi is optimized for high-frequency decision-making: fast navigation, clear risk visualization, and server-side scoring boundaries for sensitive calculations. The injury score engine runs server-side, persists daily score history, and keeps display helpers separate from canonical scoring logic.

## Setup & Installation

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

Build for production:

```bash
npm run build
npm run start
```

Run linting:

```bash
npm run lint
```

## Environment Variables

Copy `.env.local.example` to `.env.local` and provide the required project values.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Optional deployment or integration placeholders
DATABASE_URL=postgresql://user:password@host:5432/sophi
NEXT_PUBLIC_API_KEY=your-public-api-key
SUPABASE_SERVICE_ROLE_KEY=server-only-service-role-key
AURA_API_JWT_SECRET=replace-with-a-long-random-secret
```

Never commit `.env.local` or production secrets.

## API Documentation

Open Swagger UI at [http://localhost:3000/api/docs](http://localhost:3000/api/docs). The OpenAPI spec is served from `/api/docs/openapi.yaml` and tracked in `docs/openapi.yaml`.

Generate a 30-minute API token:

```bash
curl -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"your-password"}'
```

Use the returned token on REST API calls:

```bash
TOKEN="paste-access-token-here"

curl http://localhost:3000/api/athletes?page=1&pageSize=20 \
  -H "Authorization: Bearer $TOKEN"

curl http://localhost:3000/api/athletes/athlete-id \
  -H "Authorization: Bearer $TOKEN"

curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"new-user@example.com","role":"physio","full_name":"New User"}'

curl -X POST http://localhost:3000/api/athletes/athlete-id/score \
  -H "Authorization: Bearer $TOKEN"

curl -X POST http://localhost:3000/api/rehab/session-id/rtp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rtp_criteria":[{"label":"Pain-free sprinting","done":true}]}'
```

API tokens are Sophi REST tokens only. They expire after 30 minutes and do not expose Supabase refresh tokens.

## Security & Data Integrity

Sophi is built for sensitive athlete health and performance workflows. The platform should be operated with a HIPAA/GDPR compliance mindset: least-privilege access, strict separation of public and server-only keys, audit-ready data handling, encrypted transport, and careful control over who can view or modify medical context.

Formal compliance depends on deployment, hosting, contracts, data residency, access controls, audit logging, and organizational process. Treat the application as a clinical-grade system even during development.

## Roadmap

| Initiative | Future Capability |
| --- | --- |
| Wearable Integration | Direct ingestion from GPS, HRV, sleep, and recovery wearables to reduce manual data entry and improve signal freshness. |
| AI-Generated Video Analysis | Computer vision workflows for movement quality, asymmetry detection, and rehabilitation milestone review. |
| Multi-Club Management | Organization-level views for ownership groups, academies, loan squads, and federated medical governance. |
| Explainable Risk Narratives | Clinician-readable summaries explaining the main contributors behind an athlete's changing risk profile. |

## Repository Orientation

Most root-level files are standard and should remain at the repository root because the framework, package manager, or developer tooling expects them there: `package.json`, `package-lock.json`, `next.config.js`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `components.json`, `proxy.ts`, `AGENTS.md`, `CLAUDE.md`, `.mcp.json`, `skills-lock.json`, `.env.local.example`, and `README.md`.

Generated or local-only files such as `.next/`, `node_modules/`, `.env.local`, `next-env.d.ts`, `tsconfig.tsbuildinfo`, and `aura.code-workspace` are already covered by `.gitignore` and do not need to be committed. The empty tracked `test.txt` does not appear to serve the application and can likely be removed after confirming it is not being used as a placeholder.
