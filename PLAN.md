# Baseline Planning Suite: Implementation Plan

Status: DRAFT for review. Nothing is scaffolded yet.
Source: `docs/case-study.pdf`, fixtures: `docs/baseline-seed.json`.

## Scoring reminder (where the time goes)

| Dimension | Weight | Plan response |
|---|---|---|
| Architecture and boundaries | 35 | Pure TS domain package, tested without a browser. Remotes talk only through a published contract. |
| Domain correctness | 30 | Reference calculation (Figure 4) is the first test written, before any UI. |
| Micro-frontend engineering | 20 | Module Federation 2.0, runtime remote URLs from container config, error boundary per remote. |
| Code quality | 15 | Strict TS, no `any`, branded ids, discriminated unions, no dead scaffolding. |

Visual polish is NOT scored. Plain CSS only.

## Key decisions (please review these first)

1. **Monorepo with npm workspaces.** pnpm is not installed; npm workspaces need nothing extra.
2. **Bundler: Rsbuild + Module Federation 2.0** (`@module-federation/enhanced`). Its runtime API (`registerRemotes`, `loadRemote`) makes "URLs resolved at runtime, never from the bundle" a first-class feature, not a hack.
3. **Canonical allocation unit: hours.** Hours do not depend on rate or month length. Person-months, % and € are computed at the edges only. Reference: 0.50 PM in March 2026 = 88.00 h.
4. **Who prices the grid: Delivery computes cost itself.** People publishes rate records as data through a versioned contract. Reasons: Delivery needs a blended rate per cell synchronously for 720 cells and for € input conversion; one network round trip per cell edit is wrong; the pricing rule (working days x hours) is a planning rule, the rate is People's fact. README will defend this.
5. **Data layer: two small backend services, one per team.**
   - `people-api`: employees and rate records.
   - `delivery-api`: projects, breakdown items, allocations, plus a published `capacity-usage` endpoint (hours per employee per month, across ALL projects) that People reads to flag oversubscription.
   - Node + Fastify, data in one JSON file per service via `lowdb` (changed from SQLite on 2026-10-03: simpler to read, and 720 allocations need no database). File lives on a Docker volume, seeded from the fixture on first start. Edits survive reload and restart.
6. **Transport between remotes: Server-Sent Events.** Each API emits change events (`rates.changed`, `allocations.changed`). Delivery subscribes to People's stream, so a rate edit reaches an open cost view with no reload, even in another tab or in standalone mode.
7. **Shell pushes context in as props:** `{ currency, activeUser }` (`ShellContext` in contracts). Each remote exposes `./App`, a React component taking exactly those props (changed from `mount(el, props)` on 2026-10-03: simpler, and the shared React singleton makes it safe). Standalone, the remote's own `bootstrap.tsx` renders the same `App` with default props.
8. **Leaf gets a child (R4): move the leaf's allocations onto the new child.** No silent loss, no blocked action.
9. **Over-capacity owner (R5):** every allocation has `updatedAt`; the most recently edited one contributing to an over-capacity person-month is the one Delivery names.
10. **Git: you make every commit yourself** at the end of each step, so the history is real.

## Repo map (target)

```
baseline-planning-suite/
  apps/
    shell/            host: nav, currency, active user, remote loader, failure panel
    people/           remote: register, search, rate history editor
    delivery/         remote: WBS tree, staffing grid
  services/
    people-api/
    delivery-api/
  packages/
    domain/           pure TS: dates, rates, units, rounding, rollups, capacity (Vitest)
    contracts/        shared TS types for API payloads + events (types only, no logic)
  docker/             nginx config + runtime config.json template
  docker-compose.yml
  README.md
```

The two teams never import each other's app source. Both may import `contracts` (a published contract) and `domain` (pure functions).

## Steps

Each step ends with: you run it, read the diff, commit.

| # | Step | What you can see when done | Estimate |
|---|---|---|---|
| 1 | Workspace scaffold: root `package.json`, TS strict base config, ESLint (`no-explicit-any`), Vitest, `.gitignore`, `git init` | `npm run typecheck` and `npm test` pass on an empty repo | 30 min |
| 2 | `packages/domain` part 1: working days, rate slicing per month, cost. First test = Figure 4 numbers (22, 8, 14, 176 h, 88 h, €7,880.00, 50.0%, €89.5455) | Reference calculation green in Vitest | 2 h |
| 3 | `packages/domain` part 2: unit conversion (h / PM / % / €) with round-trip test, largest-remainder rounding, WBS roll-ups, cross-project capacity, "rate missing" marker | All domain tests green, still no React | 2-3 h |
| 4 | `packages/contracts` + `people-api` + `delivery-api` with lowdb JSON files, seed import, REST + SSE | `curl` returns seeded employees; edit a rate, SSE event appears | 3 h |
| 5 | Shell + empty People and Delivery remotes on Module Federation, runtime `config.json`, error boundary with "break a remote" switch | Shell loads both remotes; break toggle shows the failure panel while shell stays alive | 3 h |
| 6 | People remote: searchable register, rate history add / correct / remove (retroactive allowed), oversubscribed badge | Edit a rate, reload, it persisted | 3 h |
| 7 | Delivery remote part 1: WBS tree create / rename / move / delete, R4 rule | Tree edits persist; adding a child under an allocated leaf moves its effort | 3 h |
| 8 | Delivery remote part 2: staffing grid, 4 units, derived parent rows, totals that reconcile, † over-capacity marker naming the latest edit | Type the Figure 4 inputs into the grid, see €7,880.00 | 4-5 h |
| 9 | Live rate propagation People to Delivery + standalone mode for each remote | Edit a rate in People, Delivery cost cell changes without reload | 1-2 h |
| 10 | Docker: multi-stage builds, nginx on 8080, compose with env-driven remote URLs | `docker compose up` from a clean clone works | 2 h |
| 11 | README: run, break a remote, repo map, decision defences (esp. #4) | Reviewer can follow it cold | 1 h |

Total: roughly 25-30 hours of focused work.

## Blocker to fix before step 10

Docker is not installed on this Mac (`docker: command not found`). Steps 1-9 do not need it. Install Docker Desktop (or OrbStack) any time before step 10.

## Deadline and schedule

Received 2026-10-01, due within 4 days: **submit by 2026-10-05**.
Repo: `github.com/RawiaAhmed/baseline-planning-suite` (public, already created).

| Day | Steps | Goal by end of day |
|---|---|---|
| Sat 10-03 | 1, 2, 3, 4 | All domain math green incl. Figure 4; APIs serve seed data |
| Sun 10-04 | 5, 6, 7, 8 | Shell + both remotes working end to end |
| Mon 10-05 | 9, 10, 11 | Live propagation, Docker, README, submit |

## Scope: main build first, extras after

Main build uses the simple version. Extras are done only after steps 1-11 are complete.

| Main build (simple) | Extra (after main points) |
|---|---|
| WBS "move" = a "move under..." dropdown | Drag and drop in the tree |
| Small plain CSS file per app | Nicer styling, shared visual tokens |
| Tests on `packages/domain` + one API smoke test | Component tests, more API tests |
| Grid renders all 12 months plainly | Virtualised / sticky-header grid |

## Decisions to defend in the README (collected while building)

- **R1 extension:** if the first rate starts mid-month, days before it cost zero and the cell is marked `*`.
- **R3 scope:** largest-remainder rounding runs per row (cells add up to the row total). Columns (parent = sum of children's displayed cells) can differ by 0.01; doing both directions at once is a controlled-rounding problem, out of scope. Side effect: one exact value can display as 2767.56 in one month and 2767.57 in another within the same row.
- **R5:** the `†` marks only the latest-edited allocation causing an over-capacity person-month; capacity counts all projects.
- **Display currency:** rates are recorded in EUR; the shell pushes `{ code, perEuro }` from a fixed illustrative table. Typing a cost in USD converts back to EUR, then to hours.
- **Seed import:** allocation `amount` is person-months; Delivery converts to hours once at first start using the fixture's weekly hours.
- **Grid rows:** a person row stays visible after its last hours are cleared (until reload), so clearing a cell never makes the row jump away.
