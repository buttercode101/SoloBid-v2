# SoloBid

**SoloBid** is a quote-to-invoice platform for independent contractors and small service businesses. Send professional quotes, collect client approvals with e-signatures, convert to invoices, and accept payments — all in one place.

## Features

- **Quote builder** — drag-and-drop line items, material markup, expense tracking, milestone billing
- **Client approval** — shareable public quote link with e-signature and approval/decline flow
- **Invoice management** — convert approved quotes to invoices, PDF generation, Paystack payment links
- **WhatsApp sharing** — one-tap share via wa.me with quote summary pre-filled
- **Recurring invoices & quotes** — set frequencies and auto-generate on schedule
- **South African defaults** — ZAR currency, 15% VAT, SA tax invoice mode
- **Offline-first** — drafts persist locally; sync when back online
- **Multi-currency** — ZAR, USD, EUR, GBP, AUD, CAD, NZD, SGD

## Tech Stack

- **Frontend**: Vite + React 19, TailwindCSS 4, React Router 7
- **Backend**: Express.js with server-side email (Resend) and cron reminders
- **Database**: Supabase (PostgreSQL + realtime subscriptions)
- **Auth**: Firebase Authentication
- **Payments**: Paystack
- **PDF**: @react-pdf/renderer (client-side, chunked for PWA)

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in your Supabase, Firebase, Resend, and Paystack keys.
3. Start the dev server:
   ```
   npm run dev
   ```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Express + Vite dev server |
| `npm run build` | Production build (Vite + esbuild server bundle) |
| `npm start` | Run production server from `dist/` |
| `npm run lint` | TypeScript type check |
