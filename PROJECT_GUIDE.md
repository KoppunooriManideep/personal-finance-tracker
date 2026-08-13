# Personal Finance Tracker — Project Guide

A mobile-first web app for **Indian families** to track income, expenses, transfers,
accounts, budgets, chit funds, and investments (gold, stocks, mutual funds, PF),
with a net-worth view and AI-assisted data entry.

This document is the single orientation file for a new contributor (human **or** AI).
Read it before making changes. It covers the stack, the non-obvious conventions you
**must** follow, the data model, the AI/serverless pattern, a feature map, and the
quality gates.

---

## Table of contents

1. [What it is](#1-what-it-is)
2. [Tech stack](#2-tech-stack)
3. [Getting started](#3-getting-started)
4. [Quality gates (run before every change is "done")](#4-quality-gates)
5. [Repository structure](#5-repository-structure)
6. [Core conventions — READ THIS](#6-core-conventions--read-this)
7. [Data model & Supabase](#7-data-model--supabase)
8. [Serverless functions & AI (Gemini)](#8-serverless-functions--ai-gemini)
9. [Feature map](#9-feature-map)
10. [Environment variables](#10-environment-variables)
11. [Deployment](#11-deployment)
12. [Gotchas & operational notes](#12-gotchas--operational-notes)

---

## 1. What it is

- **Audience:** an Indian family sharing one workspace. Two+ members each add their
  daily income/expense/transfer transactions; everything is scoped to a **family**.
- **Money is in ₹ (INR).** Amounts are stored as **integer paise** (never floats).
- **Dates are IST** (Asia/Kolkata).
- **Offline-friendly PWA**, installable on mobile.
- **AI-assisted:** scan a gold bill or type a transaction in plain English; Gemini
  fills the form for you to verify.

---

## 2. Tech stack

| Area | Choice |
|---|---|
| UI | **React 19** + **TypeScript** + **Vite 8** |
| Styling | **Tailwind CSS v4** + shadcn/ui-style components (Radix primitives) |
| Icons | **lucide-react** |
| Server state | **TanStack Query v5** (`@tanstack/react-query`) |
| Client state | **Zustand v5** (persisted where noted) |
| Forms | **react-hook-form v7** + **Zod v4** (`@hookform/resolvers`) |
| Charts | **Recharts** |
| Backend | **Supabase** (Postgres + Auth + Row Level Security + Storage) |
| Serverless | **Vercel Edge Functions** in `api/` (mirrored by a Vite dev middleware) |
| AI | **Google Gemini** (`generativelanguage.googleapis.com`) for document/text → structured JSON |
| Toasts | **sonner** · Routing: **react-router-dom v7** · Theming: **next-themes** |
| Tests | **Vitest** |

There is **no dedicated backend service** — the app talks to Supabase directly from
the browser (protected by RLS), plus a few serverless functions for things the browser
can't do (CORS-blocked scrapes, holding an API key).

---

## 3. Getting started

```bash
# 1. Install
npm install

# 2. Configure env — copy the example and fill in real values
cp .env.example .env.local     # .env.local is gitignored; NEVER commit secrets

# 3. Run (Vite dev server, includes the /api/* dev middleware)
npm run dev

# 4. Other scripts
npm run build     # tsc -b && vite build
npm run preview   # preview the production build
npm test          # vitest run
npm run lint      # eslint .
```

Minimum env to boot the app: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
(see [§10](#10-environment-variables)). AI features additionally need `GEMINI_API_KEY`.

**Apply the database migrations** to your Supabase project before features work — see
[§7](#7-data-model--supabase).

---

## 4. Quality gates

A change is not "done" until **all four** pass. Run them after any edit:

```bash
npx tsc -b        # typecheck (also compiles vite.config + tsconfig.node)
npx eslint .      # lint (strict — see the lint quirks in §6)
npm test          # vitest — pure logic (money math, parsers, matchers) is unit-tested
npm run build     # production build must succeed
```

Notes:
- `api/**` is **outside** the app tsconfig, so `tsc -b` skips it — Vercel compiles it.
  ESLint still lints `api/**` (there's an override giving it node + browser globals).
- Prefer adding a **pure, tested module** for any non-trivial logic (this repo keeps
  money/valuation/parse logic in dependency-light files with `*.test.ts` beside them).

---

## 5. Repository structure

Feature-based. Each feature folder is roughly self-contained:

```
src/
  features/<feature>/
    api/            # Supabase queries + mutations (thin data layer)
    hooks/          # TanStack Query hooks wrapping api/
    components/     # feature UI (pages, dialogs, cards)
    <pure>.ts       # pure logic (math/parse/match) + <pure>.test.ts
    schema.ts       # Zod form schemas
    config.ts       # constants, presets, display metadata
  components/
    common/         # PageHeader, EmptyState, ErrorState, ConfirmDialog, spinners…
    ui/             # shadcn-style primitives (Button, Input, Select, Dialog, …)
  config/           # paths.ts (routes), nav.ts (navigation), query-client.ts
  lib/              # money.ts, date.ts, supabase.ts, csv.ts, utils.ts, *-context.ts
  stores/           # zustand stores (e.g. dashboard-store.ts)
  routes/           # router.tsx
  types/            # database.types.ts (generated-style Supabase types + app enums)
api/                # Vercel Edge functions (gold-rate, quotes, parse-gold-receipt, parse-transaction)
supabase/
  schema.sql        # canonical full schema (idempotent) — the source of truth
  migrations/       # numbered incremental migrations (apply in order)
vite.config.ts      # Vite config + dev middlewares that mirror api/* locally
```

Features present: `auth`, `family`, `transactions`, `accounts`, `categories`,
`budgets`, `recurring`, `chits`, `dashboard`, `investments`, `reports`, `settings`.

Routes are centralized in [`src/config/paths.ts`](src/config/paths.ts) — reference
`paths.*`, never hardcode URL strings.

---

## 6. Core conventions — READ THIS

These are the rules that will trip you up if you don't know them.

### 6.1 Money is integer **paise**
- All money in the DB and in app logic is an **integer number of paise** (₹1 = 100 paise).
- Convert only at the UI edge with [`src/lib/money.ts`](src/lib/money.ts):
  `rupeesToPaise`, `paiseToRupees`, `formatPaise`, `formatRupees`.
- Never do float rupee arithmetic. Do math in paise, format at the end.

### 6.2 Dates are **IST**
- Use [`src/lib/date.ts`](src/lib/date.ts): `getCurrentIstDate()` (→ `YYYY-MM-DD`),
  `getCurrentIstMonth()`, `formatDate()`, `istPeriodKey()`.
- `Date.now()`/`new Date()` in business logic should route through these helpers so
  everything is consistent in Asia/Kolkata regardless of the user's timezone.

### 6.3 Everything is **family-scoped** (multi-tenant via RLS)
- Core tables have a `family_id`. **Row Level Security** enforces access using SQL
  helpers: `is_family_member(family_id)` (read), `can_edit_family(family_id)` (write),
  `is_family_owner(family_id)`.
- Roles: **owner** and **member** can edit (`can_edit_family`); **viewer** is read-only.
  In UI, gate edit affordances on `family.role === 'owner' || 'member'`.
- The Supabase **anon key is safe to expose** in the client — data is protected by RLS.

### 6.4 **Owner scoping** (whole-family vs one member)
- Many domains have an `ownerId` (a family member) where **`null` = Shared / Family**.
- A global, persisted filter `useDashboardStore().selectedOwnerId` (`null` = whole family)
  scopes views to one member. Respect it when aggregating.

### 6.5 Server state = TanStack Query; client state = Zustand
- Query client config: [`src/config/query-client.ts`](src/config/query-client.ts) —
  `staleTime: 60_000`, `refetchOnWindowFocus: false`.
- Data flows: `api/*` (Supabase) → `hooks/use-*` (Query) → components. Mutations do
  optimistic updates + `invalidateQueries` on settle.
- Persisted UI state lives in [`src/stores/dashboard-store.ts`](src/stores/dashboard-store.ts):
  `selectedOwnerId` and `view` (`'spending' | 'networth'`).

### 6.6 Supabase **1000-row cap** — paginate large fetches
- Supabase caps a query at **1000 rows** by default. Any fetch that can exceed 1000
  rows (e.g. all transactions across many months) **must paginate** with `.range(from, to)`
  in a loop until a page returns `< PAGE_SIZE`.
- **Aggregates computed server-side are immune.** Account balances come from the
  `account_balances` **VIEW** (all-time SUM in Postgres), so they're always correct and
  don't need pagination. Prefer views/RPC for aggregates over pulling rows to the client.

### 6.7 Forms: react-hook-form + Zod, with lint-driven patterns
ESLint here is strict (`eslint-plugin-react-hooks` v7). Follow these or the build fails:
- **Do not `setState` inside `useEffect`.** For dialogs that must reset per-open, use the
  **inner-body-remount pattern**: render the form body in an inner component that is only
  mounted while the dialog is open and **keyed** (e.g. `key={entity?.id ?? 'new'}`), so all
  state initializes fresh via `useState`/`defaultValues` — no reset-in-effect.
  (See `gold-form-dialog.tsx`.) Some older dialogs still use `useEffect(reset)`; that's OK
  because `reset()`/`setValue()` are RHF calls, not React `setState`.
- Use **`useWatch({ control, name })`**, not `watch()` (avoids
  `react-hooks/incompatible-library`).
- **Index component maps off a `Record`**, don't call a function to get a component
  during render (avoids `react-hooks/static-components`). E.g. `ICONS[name]`, not `getIcon(name)()`.

### 6.8 UI must be **mobile-first**
- Design for a phone first; every screen must be usable one-handed. Tap targets ≥ ~40px,
  bottom sheets for filters on mobile, avoid horizontal body scroll (wrap wide tables/charts
  in their own `overflow-x-auto`). Test at a narrow viewport.

### 6.9 Reference code, don't duplicate
- Routes → `paths.*`. Icons → the category/investment icon registries. Colors → the
  palettes in feature `config.ts`. Add to the registry/array; the pickers expand automatically.

---

## 7. Data model & Supabase

### 7.1 Source of truth
- **`supabase/schema.sql`** is the canonical, **idempotent** full schema (tables, views,
  RLS policies, functions, triggers, seed). Running it on a fresh project builds everything.
- **`supabase/migrations/NN_*.sql`** are incremental steps applied in order. When you add a
  column/table, add a numbered migration **and** mirror it into `schema.sql`.

### 7.2 Applying migrations
Run each new migration in the Supabase SQL editor (or via the Supabase CLI) **in numeric
order**. Migrations are written idempotently (`add column if not exists`, `drop policy if
exists` before `create policy`, `on conflict do …`) so re-running is safe.

### 7.3 Key tables (high level)
- **Identity/tenancy:** `profiles`, `families`, `family_members` (role), invites
  (`create_family_invite` / `join_family_with_code` RPCs), `handle_new_family` trigger
  seeds default categories.
- **Ledger:** `accounts` (+ `account_balances` VIEW), `categories` (income/expense, with
  icon + color), `transactions` (income/expense/transfer; `occurred_at`, creator profile),
  `budgets`, recurring templates.
- **Chits:** `chits` + `chit_payments` (monthly contributions, dividends, base EMI).
- **Investments:**
  - `gold_holdings` (coin/bar/jewellery; weight_mg, fineness ppt, price_total_paise;
    jewellery breakdown: making/va/stone/gst%/discount; `receipt_path`) + `gold_spot`
    (family 24K rate).
  - `market_holdings` (stock | mutual_fund; ISIN, symbol, quantity, invested_paise).
  - `pf_accounts` (EPF/PPF/VPF/NPS; balance + monthly contribution + rate, projected forward).
- **Storage:** private `receipts` bucket (gold bills); RLS by the first path segment
  = `family_id`, path `{family_id}/gold/{uuid}.{ext}`.

Migration numbering currently runs `02` … `16`. `16_gold_receipts.sql` creates the Storage
bucket + policies. All app enums/table row types live in
[`src/types/database.types.ts`](src/types/database.types.ts).

---

## 8. Serverless functions & AI (Gemini)

### 8.1 Why serverless
The browser can't (a) scrape CORS-blocked pages, or (b) hold a secret API key. A handful of
**Vercel Edge functions** in `api/` do those. Each is **also mirrored by a dev middleware in
`vite.config.ts`**, so they work under a plain `npm run dev` too.

| Endpoint | Purpose | Data source |
|---|---|---|
| `api/gold-rate.ts` | Today's Indian gold rate | scrapes GoodReturns |
| `api/quotes.ts` | Stock/MF live prices | AMFI NAV (by ISIN) + Yahoo |
| `api/parse-gold-receipt.ts` | Read a gold bill → fields | **Gemini** vision |
| `api/parse-transaction.ts` | NL note → transaction | **Gemini** text |

### 8.2 The reusable AI pattern (copy it for any new AI feature)
1. **Shared, ZERO-IMPORT module** `*-parse.ts` (e.g.
   `src/features/transactions/nl-parse.ts`): a prompt builder, a Gemini `responseSchema`
   (UPPERCASE OpenAPI types, `nullable: true`), a `ParsedX` type, and a `normalizeX(raw)`
   that coerces anything bad/out-of-range to `null` (so a bad read never writes garbage).
   It has **no imports** so both the edge function and `vite.config.ts` can import it.
2. **Edge function** `api/<name>.ts` (`export const config = { runtime: 'edge' }`, POST):
   build the prompt → call
   `…/v1beta/models/${model}:generateContent` with
   `responseMimeType: 'application/json'` + `responseSchema`, `temperature: 0` →
   `normalizeX(JSON.parse(candidates[0].content.parts.find(p => p.text).text))`.
3. **Dev middleware** in `vite.config.ts` mirrors the edge function (config is function form
   + `loadEnv(mode, cwd, '')` to read the server-only key).
4. **Client** `api/<name>-api.ts`: prepare input → POST → return `ParsedX`; **throw on
   `!ok`** so the caller can degrade gracefully (under bare `vite dev` the endpoint 404s).
5. **UX rule:** AI **prefills → user verifies → user saves.** Never auto-commit AI output.

### 8.3 Gemini model note (important)
Default model is **`gemini-flash-latest`**. Do **not** use a pinned id like
`gemini-2.5-flash` — those return **404 for newly-created API keys** ("no longer available to
new users"). Use a `"-latest"` alias. Override with the `GEMINI_MODEL` env var if needed.

### 8.4 Privacy
- Bill reader: only the single uploaded image is sent to Google.
- NL transaction quick-add: only your **category/account names** are sent (to map the note) —
  **no amounts or balances**.
- Any future feature that sends actual amounts (e.g. dashboard insights/Q&A) must be behind an
  explicit opt-in and labelled "not financial advice".

---

## 9. Feature map

Each entry: what it does + where to look.

- **Auth & Family** (`features/auth`, `features/family`): Supabase email/password auth,
  onboarding, family creation, invite codes, member roles. RLS helpers gate everything.
- **Transactions** (`features/transactions`): income / expense / transfer with account +
  category (transfers use from/to accounts, no category). Filters (bottom sheet on mobile),
  CSV export, paginated fetch. **AI quick-add**: `nl-parse.ts` + `nl-match.ts` +
  `api/parse-transaction.ts` — type a sentence, Gemini fills the Add dialog.
- **Accounts** (`features/accounts`): cash / bank / credit_card / wallet; live balances from
  the `account_balances` VIEW (all-time, immune to the 1000-row cap); owner scoping;
  credit-card balances net dues. Negative opening balance via a +/− sign toggle (mobile
  keyboards hide the minus).
- **Categories** (`features/categories`): income & expense categories with a **color** and a
  **lucide icon**. Rich pickers (icon + color grids in `icons.ts` / `config.ts`); seeded
  Indian defaults.
- **Budgets** (`features/budgets`): monthly per-category budgets vs actuals.
- **Recurring** (`features/recurring`): recurring transaction templates.
- **Chits** (`features/chits`): Indian chit funds — monthly contributions incl. dividends,
  mid-way exit, a stored base EMI. Contributes to net worth at amount **paid-in** for active
  chits (received chits count 0). Pure math in `chit-math.ts`.
- **Dashboard** (`features/dashboard`): a persisted **Spending ↔ Net worth** toggle.
  - *Spending*: month-scoped income/expense summary + recent activity.
  - *Net worth*: point-in-time sum of Cash & bank + Gold + Stocks/MF + PF + Chits(paid-in)
    − Loans(placeholder). Owner-scoped; heavy data (live quotes) loads lazily only on this lens.
    Pure `net-worth.ts`.
- **Investments** (`features/investments`): a hub (total, allocation bar, per-class P&L) +
  detail pages:
  - **Gold** (`/investments/gold`): holdings valued from a single family 24K spot rate scaled
    by fineness. Weight-first summary (grams accumulated + 24K-equivalent), per-karat
    breakdown, and for jewellery a **split** view (Total paid / Gold cost / Current, with
    Gold P&L and Net P&L). Jewellery charges = making + VA + stones + GST − discount (GST
    derived from the GST-inclusive total). **Receipt upload + Gemini auto-fill** (see §8).
    Filters, CSV/print export. Pure `gold-math.ts`.
  - **Stocks & Mutual Funds** (`/investments/stocks`, `/investments/mutual-funds`): one
    `MarketPage` for both. Import from a **Zerodha holdings CSV** (ISIN-keyed, idempotent
    re-import for SIP sync). Live prices via `/api/quotes` (AMFI + Yahoo); day's P&L for
    stocks. Pure `market-math.ts`, `zerodha-import.ts`, `import-plan.ts`.
  - **Provident Fund** (`/investments/pf`): EPF/PPF/VPF/NPS. Can't auto-fetch (EPFO is
    auth-gated) → a manually-anchored balance the app **projects forward** (balance +
    monthly × months since `as_of` + optional simple interest). Editable/reconcilable. Pure
    `pf-math.ts`.
- **Reports** (`features/reports`): period reports (month/FY) with income/expense breakdowns,
  plus a separate **Investments** card (point-in-time, all asset classes). CSV + printable PDF
  (zero-dependency `window.print()` with print-only styles).
- **Settings** (`features/settings`): theme, family management, misc.

---

## 10. Environment variables

Put real values in **`.env.local`** (gitignored via `*.local`). `.env.example` documents them.

| Var | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | client | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | client | anon key (safe to expose; RLS protects data) |
| `GEMINI_API_KEY` | **server only** (no `VITE_` prefix) | Gemini key for AI features |
| `GEMINI_MODEL` | server only (optional) | override the default `gemini-flash-latest` |

- Only `VITE_`-prefixed vars are exposed to the browser bundle. `GEMINI_API_KEY` is read
  server-side (edge function in prod; `vite.config` `loadEnv` for the dev middleware) and
  **never** shipped to the client.
- On **Vercel**, set these in Project → Settings → Environment Variables (do not put secrets
  in any committed file). Redeploy after changing env.

---

## 11. Deployment

- **Vercel** hosts the Vite app **and** the `api/` Edge functions automatically (no
  `vercel.json` needed — Vercel detects `api/`).
- **PWA** via `vite-plugin-pwa` (autoUpdate, offline precache, installable manifest).
- Serverless endpoints (`/api/*`) only run when deployed to Vercel **or** under `npm run dev`
  (the dev middlewares) / `vercel dev`. A static host without functions will 404 them — the
  client handles that gracefully with a toast, and non-AI features still work.

---

## 12. Gotchas & operational notes

- **Apply migrations first.** New features that touch new tables/columns won't work until the
  corresponding `supabase/migrations/NN_*.sql` is applied to your Supabase project.
- **1000-row cap** (§6.6): unpaginated `.select()` silently truncates at 1000 rows and will
  corrupt client-side aggregates. Paginate, or aggregate in Postgres (view/RPC).
- **Never commit secrets.** `.env.local` is gitignored; `.env.example` and other tracked
  files must contain only blank placeholders.
- **Shared parse modules must stay import-free** — they're imported by both edge functions and
  `vite.config.ts`; a stray import breaks the dev server / build. Keep helpers local.
- **Pinned Gemini model ids 404 for new keys** — use `gemini-flash-latest` (§8.3).
- **Lint is strict** (§6.7): set-state-in-effect, `watch()`, and call-a-component-in-render are
  all errors here. Follow the established patterns.
- **AI output is always reviewable** — prefill, never silently save.
- Money in paise, dates in IST, everything family-scoped — the three rules that cause the most
  bugs if forgotten.

---

*Keep this file current when you add a feature, table, endpoint, env var, or convention.*
