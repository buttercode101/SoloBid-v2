# TODO — Deferred / Skipped Items

## SoloBid-v2

### High-risk (skipped — needs dedicated session)
- `server.ts` TypeScript errors — `@types/node`, `@types/express` missing from devDeps; many implicit `any` params in route handlers
- `src/App.tsx` TS errors — react/jsx-runtime path resolution issue (pre-existing, likely tsconfig/vite config mismatch)
- Paystack webhook handler — needs integration testing before any changes
- WhatsApp reminder cron routes — timing-sensitive, skip

### Medium-risk (deferred — need more context)
- QuoteBuilder WhatsApp share per-field validation UI — logic is complex, needs UX review before changing toast → inline
- PDF generation loading progress — needs testing with large invoices
- Error boundary at route level — requires router refactor

### Nice-to-have (future sprint)
- Add search/filter to Clients page
- Add sorting to Invoices list (by date, status, amount)
- `src/pages/Reports.tsx` — add date range filtering
- RecurringInvoices page — add next-issue-date visibility
- Templates page — add preview modal
