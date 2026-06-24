# SoloBid

**SoloBid** is a quote-to-invoice platform for independent contractors and small service businesses. Send professional quotes, collect client approvals with e-signatures, convert to invoices, and track invoice status manually — all in one place.

Built by **ButterCode Systems**.

## Features

- **Quote builder** — drag-and-drop line items, material markup, expense tracking, milestone billing
- **Client approval** — shareable public quote link with e-signature and approval/decline flow
- **Invoice management** — convert approved quotes to invoices, PDF generation, and manual status tracking
- **WhatsApp sharing** — one-tap share via wa.me with quote summary pre-filled
- **Recurring invoices & quotes** — set frequencies and auto-generate on schedule
- **South African defaults** — ZAR currency, 15% VAT, SA tax invoice mode
- **Offline-first** — drafts persist locally; sync when back online
- **Multi-currency** — ZAR, USD, EUR, GBP, AUD, CAD, NZD, SGD

## Tech Stack

- **Frontend**: Vite + React 19, TailwindCSS 4, React Router 7
- **Backend**: Express.js with server-side email (Resend), cron reminders, and subscription webhook handling
- **Database & Auth**: Supabase (PostgreSQL + realtime subscriptions + Supabase Auth)
- **Billing**: Paystack is reserved for SoloBid user subscriptions. Contractor/client invoice payments are tracked manually.
- **PDF**: @react-pdf/renderer
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
| `VITE_PAYSTACK_ENABLED` | Frontend | Feature flag for SoloBid subscription checkout. Keep `false` until account approval and billing QA are complete. |
| `VITE_PAYSTACK_PUBLIC_KEY` | Frontend | Optional Paystack public key. Only required when subscription checkout is enabled. |
| `SUPABASE_URL` | Server | Same Supabase project URL |
| `SUPABASE_ANON_KEY` | Server | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Supabase service role key |
| `PAYSTACK_ENABLED` | Server | Feature flag for subscription webhook handling. Keep `false` until account approval and billing QA are complete. |
| `PAYSTACK_SECRET_KEY` | Server | Optional Paystack secret key. Only required when subscription webhooks are enabled. |
| `RESEND_API_KEY` | Server | Resend API key for outbound email |
| `APP_ORIGIN` | Server | Your public app URL |
| `ALLOWED_ORIGINS` | Server | Comma-separated allowed CORS origins |
| `CRON_SECRET` | Server | Secret token for cron reminder endpoint |

## Deploy to Vercel

1. Push the repo to GitHub.
2. Import the project in Vercel.
3. In Vercel project settings, add the Supabase, Resend, app origin, CORS, and cron variables listed above.
4. Keep Paystack flags disabled until account approval, subscription checkout, webhook verification, and billing QA are complete.
5. Vercel auto-detects the build command (`npm run build`) and output directory (`dist/`).
6. Set the **Root Directory** to `.`.
7. After approval only, enable Paystack subscription billing and register the webhook URL in the Paystack dashboard.

## Supabase Setup

- Create a project at Supabase.
- Run migrations from the `supabase/` directory or apply schema from the Supabase SQL editor.
- Enable Row Level Security on all tables.
- Add your production domain to the Allowed Redirect URLs in Supabase Auth settings.

## Resend Email Setup

- Create an account at Resend.
- Add and verify your sending domain.
- Create an API key and add it as `RESEND_API_KEY`.
- The from address is `noreply@solobid.app`; update in `server.ts` if using a different domain.

## Subscription Billing Setup

Current launch mode: contractor invoices use manual tracking only. Paystack is reserved for SoloBid user subscription purchases after account approval. Do not use Paystack for contractor/client invoice payments.

Before enabling Paystack billing:
1. Run the subscription billing Supabase migration.
2. Enable the frontend and server Paystack flags.
3. Add the approved public and secret keys.
4. Register the webhook URL in the Paystack dashboard.
5. Test a full SoloBid subscription checkout and webhook confirmation.
6. Confirm `users.subscription_status` changes to `active` for paid users.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Express + Vite dev server |
| `npm run build` | Production build |
| `npm start` | Run production server |
| `npm run lint` | TypeScript type check |
| `npm run clean` | Remove `dist/` |
