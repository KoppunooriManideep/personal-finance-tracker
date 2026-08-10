# Personal Finance Tracker

A mobile-first personal finance app for **Indian families**. Two (or more) family
members share one ledger — income, expenses, transfers, accounts, budgets — and
track their wider net worth: chit funds and investments (gold, stocks, mutual
funds). Built as an installable PWA.

Money is stored as **integer paise**, amounts use the **Indian numbering system**
(₹1,23,456.78), and dates are handled in **IST (Asia/Kolkata)**.

---

## Features

- **Family & auth** — Supabase auth; create/join a family via invite code. All
  data is family-scoped and protected by Row-Level Security. Members have roles
  (owner/member/viewer).
- **Accounts** — cash / bank / credit-card / wallet, each with an optional
  **owner** (a family member, or Shared). Live balance is computed server-side
  by the `account_balances` SQL view.
- **Transactions** — income, expense and transfers. Transfers move money between
  accounts and are always excluded from income/expense/category aggregations.
  Filterable list with CSV export.
- **Categories & Budgets** — Indian default categories seeded per family; monthly
  per-category budgets.
- **Recurring** — templates that generate transactions on a schedule.
- **Dashboard** — month-scoped income/expense, category & member breakdowns,
  spending trend, total balance (with a whole-family ↔ member view toggle).
- **Reports** — a printable **month or financial-year (Apr–Mar)** summary
  (income / spent / saved, by category, by member, month-by-month), plus a
  current **Investments** snapshot. Print / Save-PDF and CSV export.
- **Chits** — chit-fund tracker: monthly payments, mark-received, XIRR/return
  math, projection and charts. Per-chit share + printable report.
- **Investments** — a hub with cross-asset **allocation** and **segment P&L**:
  - **Gold** — coins / bars / jewellery, by purity; live 24K/22K rate scraped
    from GoodReturns; jewellery cost breakdown (making/VA/stones/GST); filters;
    CSV + printable report.
  - **Stocks & Mutual Funds** — import your **Zerodha Console holdings** CSV
    (idempotent — re-import after SIPs updates by ISIN, no duplicates), live
    prices (MF NAV by ISIN from AMFI, stock quotes from Yahoo), day's P&L, and
    filters.

---

## Tech stack

- **React 19 + TypeScript + Vite**, Tailwind CSS + shadcn/ui (Radix), PWA
  (`vite-plugin-pwa`).
- **TanStack Query** (server state) + **Zustand** (view state).
- **React Hook Form + Zod** for forms.
- **Recharts** for charts.
- **Supabase** (Postgres + Auth + RLS) for the backend.
- **Vercel** for hosting + serverless functions.
- **Vitest** for unit tests (pure money/return/parse logic).

---

## Serverless functions (`api/`)

Same-origin functions (Vercel auto-detects the `api/` folder; a Vite dev
middleware in `vite.config.ts` mirrors them locally):

- `GET /api/gold-rate` — scrapes today's 24K/22K/18K gold rate from GoodReturns.
- `POST /api/quotes` — live prices for stock/MF holdings: **MF NAV by ISIN** from
  AMFI's `NAVAll.txt`, **stock quotes** from Yahoo Finance (`.NS`/`.BO`), plus
  each stock's previous close (for day's P&L).

> These only work when deployed (or under `vite dev`), not in a static preview.

---

## Local development

```bash
npm install

# Supabase credentials (anon key is safe to expose; RLS protects data)
cp .env.example .env.local   # then edit:
#   VITE_SUPABASE_URL=...
#   VITE_SUPABASE_ANON_KEY=...

npm run dev       # dev server (+ /api/* dev middleware)
npm test          # unit tests (vitest)
npm run lint      # eslint
npm run build     # tsc -b && vite build
```

## Database

The full schema lives in **`supabase/schema.sql`** (idempotent — safe to run on a
fresh project). Incremental changes are in **`supabase/migrations/`** (run in
order). Apply either via the Supabase SQL editor or your migration tooling.

Conventions across all tables: money in **BIGINT paise**, soft deletes
(`deleted_at`), `family_id` on every row with **RLS** (`is_family_member` for
read, `can_edit_family` for write), and `owner_id → profiles(id)` (NULL = Shared)
where ownership applies.

## Deployment (Vercel)

- Framework preset: Vite. The `api/` folder is auto-detected as serverless/edge
  functions — no `vercel.json` needed.
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project.
- **Apply the Supabase migrations** (through `13_market_holdings.sql`) before use.

### Operational notes

- **Supabase "Max rows" is 1000.** Large fetches (the transaction ledger, the
  dashboard's yearly query) **paginate** with `.range()` so nothing is silently
  dropped past 1000 rows — keep new high-volume fetches paginated too.
- **Whole-family ↔ member toggle** is a global, sticky filter: when set to a
  member, the Dashboard / Reports / Investments show only that member's data (the
  Accounts page always shows everyone, grouped by owner).
