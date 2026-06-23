# Sprint Notes

## SoloBid-v2 — 90-min sprint (2026-06-23)

### Completed

| # | Task | Files changed |
|---|------|---------------|
| 1 | Guarded all `console.error` calls in DEV-only blocks | `Dashboard.tsx`, `Invoices.tsx`, `ErrorBoundary.tsx` |
| 2 | Fixed `tsconfig.json` to include `vite/client` types — fixes pre-existing `import.meta.env` TS errors in supabase.ts | `tsconfig.json` |
| 3 | Replaced hardcoded `'INV-'` / `'QTE-'` strings with `DEFAULTS.INVOICE_PREFIX` / `DEFAULTS.QUOTE_PREFIX` | `Settings.tsx` |
| 4 | Extracted validity period options to `VALIDITY_PERIODS` constant; QuoteBuilder now renders from the array | `constants.ts`, `QuoteBuilder.tsx` |
| 5 | Added inline email validation in the Add/Edit Client dialog (regex check, red border + error message, clears on change/close) | `Clients.tsx` |
| 6 | Added skeleton loading UI while invoices are fetching (`initialLoading` state) | `Invoices.tsx` |
| 7 | Replaced `any[]` state types with proper types from `src/types/index.ts`: `Quote[]`, `Invoice[]`, `Client[]` | `Dashboard.tsx`, `Invoices.tsx`, `Clients.tsx` |
| 8 | Typed DEMO_QUOTES as `Quote[]` (added missing required fields) | `Dashboard.tsx` |
| 9 | Typed `handleDuplicateQuote`, `isQuoteExpired`, `handleWhatsAppShare`, `handleConvert` function params properly | `Dashboard.tsx`, `Invoices.tsx` |
| 10 | Typed `editingClient` as `Client \| null`, `clientQuotes` as `Record<string, Quote[]>` | `Clients.tsx` |

### Zero new TypeScript errors introduced
All pre-existing TS errors in `server.ts` and `App.tsx` remain unchanged (out of scope — high-risk files).

---

## SoloBid-v2 — MVP improvement sprint (2026-06-23, session 2)

### Completed

| # | Task | Files changed |
|---|------|---------------|
| 1 | Renamed package from `react-example` to `solobid` | `package.json` |
| 2 | Rewrote README from AI Studio boilerplate to SoloBid product description | `README.md` |
| 3 | SA defaults verified — ZAR, ZA, 15% VAT already correct | (no change) |
| 4 | Dashboard metric cards made clickable (Billed/Outstanding/Jobs → /invoices; Vs Last Month/Avg Job Value → /reports) | `Dashboard.tsx` |
| 5 | WhatsApp message updated to include quote number when available | `whatsapp.ts` |
| 6 | Public quote view tracking: marks quote `sent → viewed` on ClientView load (fire-and-forget, safe fallback) | `ClientView.tsx` |
| 7 | `handleApprove` and `handleReject` updated to allow `viewed` status (so clients who viewed can still action) | `ClientView.tsx` |
| 8 | Added `viewed` badge to ClientView status badge config | `ClientView.tsx` |
| 9 | Added `viewed`, `expired` to `QuoteStatus`; `partially_paid`, `cancelled` to `InvoiceStatus` | `types/index.ts` |
| 10 | Added new status values and badge styles to constants and theme | `constants.ts`, `theme.ts` |
| 11 | `getStatusBadgeClassAndLabel` in Dashboard refactored to use safe fallback table — unknown statuses no longer crash | `Dashboard.tsx` |
| 12 | Empty states verified present in all key pages (no change needed) | (no change) |

### Check run
- `npm run lint` (tsc --noEmit): 1 pre-existing error (`TS2688 vite/client` — unrelated to this sprint). No new errors.

### Risky items skipped → see TODO.md
- Deposit support
- Paystack webhook refactor
- Soft delete migrations
- Audit logs
- AI features / MCP

---

## RentEase-SA-main — TBD
## RadFlow-SA-main — TBD
