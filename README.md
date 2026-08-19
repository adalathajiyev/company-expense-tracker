# Ledgerly Expenses

A responsive company-expense dashboard built with React, TypeScript, Vite, and Supabase. It includes summary metrics, filtering, CSV export, a daily expense entry form, payment/status tracking, and deletion.

## Run locally

```bash
npm install
npm run dev
```

Local development automatically loads `.env.development.local` and connects to the hosted **Expenses Development** Supabase project. A separate signed-in user must exist in that project's Authentication section.

## Supabase environments

| Runtime | Configuration | Supabase project |
| --- | --- | --- |
| `npm run dev` | `.env.development.local` | Expenses Development |
| Local `npm run build` | `.env.production.local` | Expenses |
| Vercel production | Vercel Production environment variables | Expenses |

Configure these variables in Vercel under **Project Settings → Environment Variables**, scoped to **Production**:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

The `.env.*.local` files are ignored by Git. Commit only the corresponding `.example` templates.

Never put a Supabase secret or service-role key in this frontend application.

## Database migrations

The complete, data-free database baseline is stored in `supabase/migrations`. The hosted **Expenses Development** project has already had these migrations applied. Production data was not copied.

The older, comment-only migration files are history markers that align the original production migration versions with development. They must remain in place, but they intentionally execute no SQL; the consolidated baseline defines the schema for a fresh project.

For future schema changes, generate a new migration instead of editing an applied one:

```bash
npx supabase migration new describe_your_change
```

`supabase/legacy-migrations` is historical reference only and must not be applied to a fresh database before the baseline.
