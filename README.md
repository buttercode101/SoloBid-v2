# SoloBid

**SoloBid** is a quote-to-invoice platform for independent contractors and small service businesses. Send professional quotes, collect client approvals with e-signatures, convert to invoices, and track payments — all in one place.

Built by **ButterCode Systems**.

## Features

- **Quote builder** — drag-and-drop line items, material markup, expense tracking, milestone billing
- **Client approval** — shareable public quote link with e-signature and approval/decline flow
- **Invoice management** — convert approved quotes to invoices, PDF generation, and manual payment status tracking
- **WhatsApp sharing** — one-tap share via wa.me with quote summary pre-filled
- **Recurring invoices & quotes** — set frequencies and auto-generate on schedule
- **South African defaults** — ZAR currency, 15% VAT, SA tax invoice mode
- **Offline-first** — drafts persist locally; sync when back online
- **Multi-currency** — ZAR, USD, EUR, GBP, AUD, CAD, NZD, SGD

## Tech Stack

- **Frontend**: Vite + React 19, TailwindCSS 4, React Router 7
- **Backend**: Express.js with server-side email (Resend) and cron reminders
- **Database & Auth**: Supabase (PostgreSQL + realtime subscriptions + Supabase Auth)
- **Payments**: Manual tracking for launch; online payments are gated for future activation
- **PDF**: @react-pdf/renderer (client-side, chunked for PWA)
- **Deployment**: Vercel

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```
   npm install
   ```

2. Copy `env.example` to `.env.local` and fill in your credentials:
   ```
   cp env.example .env.local
   ```

3. Start the dev server:
   ```
   npm run dev
   ```

## Environment Variables

All required variables are documented in `env.example`.

| Variable | Where used | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Supabase anonymous/public key |
| `VITE_PAYSTACK_ENABLED` | Frontend | Feature flag for online payment UI. Keep `false` until account approval. |
| `VITE_PAYSTACK_PUBLIC_KEY` | Frontend | Optional public key. Only required when online payments are enabled. |
| `SUPABASE_URL` | Server | Same Supabase project URL |
| `SUPABASE_ANON_KEY` | Server | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Supabase service role key (bypasses RLS) |
| `PAYSTACK_ENABLED` | Server | Feature flag for online payment webhooks/routes. Keep `false` until account approval. |
| `PAYSTACK_SECRET_KEY` | Server | Optional secret key. Only required when online payments are enabled. |
| `RESEND_API_KEY` | Server | Resend API key for outbound email |
| `APP_ORIGIN` | Server | Your public app URL (e.g. `https://solobid.app`) |
| `ALLOWED_ORIGINS` | Server | Comma-separated allowed CORS origins |
| `CRON_SECRET` | Server | Secret token for cron reminder endpoint |

## Deploy to Vercel

1. Push the repo to GitHub.
2. Import the project in Vercel.
3. In Vercel project settings → **Environment Variables**, add the Supabase, Resend, app origin, CORS, and cron variables listed above.
4. Keep online payment flags disabled until account approval is confirmed.
5. Vercel auto-detects the build command (`npm run build`) and output directory (`dist/`).
6. Set the **Root Directory** to `.` (project root).
7. After approval only, enable online payments and register the webhook URL in the payment provider dashboard.

## Supabase Setup

- Create a project at Supabase.
- Run migrations from the `supabase/` directory (if present) or apply schema from the Supabase SQL editor.
- Enable Row Level Security (RLS) on all tables — queries are filtered by `user_id`.
- Add `https://yourdomain.com` to the **Allowed Redirect URLs** in Supabase Auth settings.

## Resend Email Setup

- Create an account at Resend.
- Add and verify your sending domain (e.g. `solobid.app`).
- Create an API key and add it as `RESEND_API_KEY`.
- The from address is `noreply@solobid.app` — update in `server.ts` if using a different domain.

## Online Payment Setup

> **Current launch mode:** online payments are pending provider approval.
> Keep payment feature flags disabled.
> SoloBid remains usable for quote approvals, invoice generation, PDF/WhatsApp sharing, reminders, and manual payment tracking.

To activate online payments after approval:
1. Enable the frontend and server payment flags.
2. Add the approved public and secret keys.
3. Register the webhook URL in the provider dashboard.
4. Test a full invoice payment and webhook confirmation before showing Pay Now in production.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Express + Vite dev server |
| `npm run build` | Production build (Vite + esbuild server bundle) |
| `npm start` | Run production server from `dist/` |
| `npm run lint` | TypeScript type check |
| `npm run clean` | Remove `dist/` |
