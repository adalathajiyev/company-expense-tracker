# Ledgerly Expenses

A responsive company-finance dashboard built with React, TypeScript, Vite, and Supabase. It tracks expenses, owner funding, sales and customer receipts, debts, salaries, and cash balance.

## Run locally

```bash
npm install
npm run dev
```

Local development automatically loads `.env.development.local` and connects to the hosted **Expenses Development** Supabase project. A separate signed-in user must exist in that project's Authentication section.

Use Node.js 22 or newer. With `nvm`, run `nvm use` from the project directory.

Before deploying a change, run the same checks used during development:

```bash
npm run lint
npm test
npm run build
```

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

All accounting dates use the `Asia/Baku` business timezone in both the React client and database defaults/validation.

## Application roles

Access is enforced by Supabase Row Level Security as well as by the React navigation:

| Role | Access |
| --- | --- |
| Admin | Full access to every module and user-role assignments |
| Main Accountant | Full access to all current business modules |
| Office Accountant | Can view the Sales and Customers modules, add customers, add only bank-transfer sales and customer payments, and delete only records they created; cannot edit sales |

Users that existed when the role migration was applied are assigned `admin` to prevent lockout. New Authentication users have no application access until a row is added to `public.user_roles`. In the Supabase SQL editor, find the user and assign one of the supported roles:

Administrators can normally make this assignment from the **Access** module in the sidebar after the user has been created in Supabase Authentication. The SQL below is the manual fallback:

```sql
select id, email from auth.users order by created_at;

insert into public.user_roles (user_id, role)
values ('USER_UUID', 'office_accountant')
on conflict (user_id) do update set role = excluded.role;
```

Supported values are `admin`, `main_accountant`, and `office_accountant`.

Expenses, owner-funding transactions, sales, and customer payments store an immutable creator ID and email snapshot. Admins can delete any of these records; other authorized users can delete only records they created.

## Customer payments

Sales belong to customer accounts. Money received is stored once in `customer_payments` and distributed across one or more sales through `payment_allocations`. A receipt may remain partially or fully unallocated, and the Customers module can suggest an oldest-sale-first allocation that the accountant can adjust before saving.

Sale payment status is derived from allocations. Customer outstanding balance uses all sales and all receipts, while the cash-balance view counts each cash receipt once regardless of how many sales it covers.

## Database migrations

The complete, data-free database baseline is stored in `supabase/migrations`. The hosted **Expenses Development** project has already had these migrations applied. Production data was not copied.

The older, comment-only migration files are history markers that align the original production migration versions with development. They must remain in place, but they intentionally execute no SQL; the consolidated baseline plus later incremental migrations define the schema for a fresh project.

For future schema changes, generate a new migration instead of editing an applied one:

```bash
npx supabase migration new describe_your_change
```

`supabase/legacy-migrations` is historical reference only and must not be applied to a fresh database before the baseline.
