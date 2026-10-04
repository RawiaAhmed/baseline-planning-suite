# Baseline Planning Suite

Who is working on what, for how long, and what it costs. Three federated React apps, built and shipped independently:

| App | Owns |
|---|---|
| **Shell** (host) | Navigation, display currency, active user. Loads the two remotes at runtime. |
| **People** (remote) | Employee register and effective-dated cost-rate history. |
| **Delivery** (remote) | Work breakdown tree and the people × months staffing grid that spends People's rates. |

React 19, TypeScript strict (no `any`), Module Federation 2 on Rsbuild, no UI libraries.

## Run it

```bash
docker compose up --build
```

Open **http://localhost:8080**. No Node needed on the host. The first build takes about two minutes. Data is seeded from `docs/baseline-seed.json` on first start and kept on Docker volumes, so edits survive reloads and restarts. `docker compose down -v` resets to the seed.

**The reference calculation:** Delivery → Ledger Consolidation → *Design* → Adaeze Okafor, March 2026. Switch units: **0.50** PM, **88.00** h, **50.0** %, **7,880.00** cost. Typing `7880` in Cost stores 88 h.

### Local development (Node 22)

```bash
nvm use && npm install
npm run dev        # both APIs + all three apps, with hot reload
```

| URL | What |
|---|---|
| http://localhost:3000 | Shell, hosting both remotes |
| http://localhost:3001 | People standalone |
| http://localhost:3002 | Delivery standalone |
| :4001, :4002 | people-api, delivery-api |

```bash
npm test           # 56 tests, no browser
npm run typecheck
npm run lint
```

## Break a remote on purpose

The shell stays up and shows "*People is unavailable*" in place of that panel; the other remote keeps working.

1. **In the UI:** header link *Break a remote → People* (adds `?break=people`, which points that remote at a URL that does not exist). *Try again* clears it.
2. **Stop its container:** `docker compose stop people-web` (and `start` it again).
3. **Misconfigure it:** `PEOPLE_REMOTE_URL=http://localhost:8080/nowhere/mf-manifest.json docker compose up -d shell`

A remote that crashes while rendering is caught the same way: each remote sits in its own error boundary.

## Repo map

```
apps/
  shell/       host: routes, currency + user, runtime remote loading, failure panel
  people/      remote: register, rate history, oversubscription badge
  delivery/    remote: breakdown tree, staffing grid
               staffing.ts builds the whole grid as plain data (tested without React)
services/
  people-api/    employees + rate records          (owned by the People team)
  delivery-api/  projects, breakdown, allocations  (owned by the Delivery team)
packages/
  domain/      pure TypeScript calculation rules; every rule in the brief is tested here
  contracts/   the published contract: API payloads, events, shell props. Types only.
docker/        nginx configs + start-up script that writes the shell's config.json
docs/          seed fixture
```

The two teams never import each other's app or service code. What they share is `contracts` (a published contract) and `domain` (pure functions with no state).

## Architecture

```
                    browser ─── :8080 nginx (shell container)
                                 │  /                 shell build + config.json
                                 │  /remotes/people/  → people-web   (nginx)
                                 │  /remotes/delivery/→ delivery-web (nginx)
                                 │  /api/people/      → people-api   (Node)
                                 │  /api/delivery/    → delivery-api (Node)
```

### Micro-frontends

- **Runtime remote resolution.** The shell bundle has `remotes: {}`. On start it fetches `/config.json`, which the container writes from `PEOPLE_REMOTE_URL` / `DELIVERY_REMOTE_URL` (`docker/write-config.sh`), then calls `registerRemotes` and `loadRemote('people/App')`. Moving a remote is a config change and a restart, never a rebuild.
- **One React.** `react` and `react-dom` are shared singletons. In the browser they download once, from the shell; the remotes reuse them. That is what makes it safe for each remote to expose a plain React component.
- **Standalone and hosted from one build.** Each remote exposes `./App`, a component taking `ShellContext` (`{ currency, activeUser }`). Hosted, the shell renders it with live props. Standalone, the remote's own `bootstrap.tsx` renders the same component with defaults. Assets use `assetPrefix: 'auto'`, so one build works at any URL.
- **Isolation on failure.** `RemotePanel` wraps each remote in an error boundary and `Suspense`. nginx resolves upstreams per request, so a stopped remote container never stops the shell from starting.

### Who prices the grid: Delivery computes cost itself

The brief asks for a deliberate choice. Delivery reads People's **rate records** (data) through People's published API and computes cost locally with the shared `domain` rules. It does not ask People for computed costs.

Why:

1. **Volume and latency.** A project grid has hundreds of cells, and every unit switch or edit re-prices them. Asking People per cell, or per grid, would put another team's service on the critical path of every keystroke.
2. **Typing a cost needs the rate synchronously.** Entering € in a cell divides by that month's blended rate to get hours. That has to happen in the cell, not after a round trip.
3. **Clear ownership.** The *fact* (who costs what from when) belongs to People. The *rule* that spends it (effort spread over working days, sliced at rate changes) is a planning rule, so it belongs with planning. It lives in `packages/domain`, which is pure and versioned, so both teams can read the same rule without importing each other.
4. **Freshness without coupling.** People publishes a `rates.changed` event; Delivery refetches the records and re-prices. A rate edit reaches an open cost view with no reload.

The cost: if People changed *how* rates work (not just their values), both sides would need the new `domain` version. That is a contract change and should be versioned like one.

### Data, transport and state ownership

| Data | Owner | Others read it via |
|---|---|---|
| Employees, rate records | people-api | `GET /api/people/employees`, `/rates` |
| Projects, breakdown, allocations | delivery-api | `GET /api/delivery/...` |
| Capacity usage (hours per person-month, all projects) | delivery-api | `GET /api/delivery/capacity-usage`, read by People for the badge |
| Display currency, active user | shell | props pushed into each remote |

- **Transport:** REST for reads and writes; **Server-Sent Events** (`GET /events` on each API) to announce changes. Each remote keeps a TanStack Query cache and refetches only what an event affects. SSE works across tabs and in standalone mode, which a browser-only event bus would not.
- **Persistence:** one JSON file per service via `lowdb`, on a Docker volume. Seven hundred and twenty allocations need no database; a file is the simplest thing that survives a reload and a restart, and each file has exactly one writer.
- **Bundler:** Rsbuild with Module Federation 2, chosen for its runtime API (`registerRemotes`), which makes runtime URLs a first-class feature.

## Domain rules

All in `packages/domain`, all tested without React.

| Rule | Where | Notes |
|---|---|---|
| **R1** rate slicing | `rates.ts`, `cost.ts` | `validFrom` is inclusive; the last rate is open-ended; working days are Monday to Friday. A month before the first rate costs zero and the cell is marked `*`. **Extension:** if the first rate starts mid-month, only the days before it cost zero (also marked). |
| **R2** one canonical unit | `units.ts` | Stored unit is **hours**: it depends on neither rate nor month length. PM, % and cost are conversions at the edge. A cell only saves when its text changes, so switching units never rewrites a value. |
| **R3** totals reconcile | `rounding.ts` | Largest-remainder rounding per row: the displayed months add up exactly to the displayed total. |
| **R4** derived parents | `breakdown.ts`, delivery-api | Parents are always the sum of children. Adding a child under a leaf that holds effort **moves** that effort onto the new child, and the UI says so. Moving an item *under* a leaf that holds effort is refused with a message. |
| **R5** cross-project capacity | `capacity.ts` | Summed across every project. Over capacity is flagged, never blocked: People shows *Oversubscribed*, Delivery puts `†` on the most recently edited allocation that caused it. Exactly 100 % is within capacity. |

`reference-calculation.test.ts` checks the five Figure 4 numbers; `apps/delivery/src/staffing.test.ts` checks them again through the whole grid.

## Trade-offs and known limits

- **R3 across columns.** Rounding reconciles each row. A parent's displayed month can differ from the sum of its children's displayed months by 0.01; reconciling rows and columns at once is a controlled-rounding problem I left out of scope. A visible side effect: the same exact value can show as 2,767.56 in one month and 2,767.57 in another within a row.
- **Display currency.** Rates are recorded in EUR. The shell offers EUR, USD and GBP from a fixed, illustrative conversion table, pushed to remotes as `{ code, perEuro }`. People shows rates in EUR, their recorded currency.
- **Seed import.** The fixture stores allocations in person-months. Delivery converts them to hours once, on first start, using the fixture's weekly hours. At runtime it never reads People's store.
- **No auth**, so the active user is a demo picker. No optimistic updates; edits round-trip to the API, which keeps one source of truth.

## Tests

| Where | What |
|---|---|
| `packages/domain/src/*.test.ts` | Every calculation rule, including Figure 4 |
| `apps/delivery/src/staffing.test.ts` | The grid model: all four units, roll-ups, markers, R3, display currency |
| `services/*/src/server.test.ts` | API rules: retroactive rate edits, duplicate start dates, R4 effort move, leaf-only effort, capacity usage |
