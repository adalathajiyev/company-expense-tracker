# Ledgerly Expenses

A responsive company-expense dashboard built with React, TypeScript, Vite, and Supabase. It includes summary metrics, filtering, CSV export, a daily expense entry form, payment/status tracking, and deletion.

## Run locally

```bash
npm install
npm run dev
```

The app requires Supabase environment variables and a signed-in Supabase Auth user.

## Connect Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Copy `.env.example` to `.env.local` and add your project URL and publishable key.
4. Create an application user under Supabase Dashboard → Authentication → Users.
5. Restart `npm run dev`.

Never put a Supabase secret or service-role key in this frontend application.
