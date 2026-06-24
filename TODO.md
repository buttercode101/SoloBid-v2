# TODO — Deferred / Skipped Items

## SoloBid-v2

### Must-do before live payments (Paystack activation)
- Verify `PAYSTACK_SECRET_KEY` is updated to `sk_live_` in Vercel env after account approval
- Verify `VITE_PAYSTACK_PUBLIC_KEY` is updated to `pk_live_` after account approval
- Register webhook URL in Paystack dashboard: `https://solobid.app/api/webhooks/paystack`
- Test end-to-end payment with a live card after activation

### High-risk (skipped — needs dedicated session)
- `server.ts` TypeScript errors — `@types/node`, `@types/express` missing from devDeps; many implicit `any` params in route handlers
- `src/App.tsx` TS errors — react/jsx-runtime path resolution issue (pre-existing, likely tsconfig/vite config mismatch)
- Paystack webhook handler — needs integration testing before any changes
- WhatsApp reminder cron routes — timing-sensitive, skip
- Firebase cleanup — `src/lib/firebase.ts` is not imported anywhere (confirmed 2026-06-24); safe to remove in a dedicated session after verifying `firebase-applet-config.json`, `firebase.json`, `firestore.rules` are not used anywhere else. Firebase config files added to `.gitignore` as interim measure.
- `quotes.status` DB enum check — verify the column is text (not a Postgres enum); if enum, migration needed to add `viewed` and `expired` values. Could not verify via SQL in this session.

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
- Deposit support (partial payment collection at quote approval)
- Paystack webhook refactor (idempotency, retry queue)
- Soft delete migrations (add `deleted_at` column, filter from queries)
- Audit logs (track status transitions with timestamp + actor)
- AI features (quote description auto-fill, price suggestions)
- MCP integration
- Dashboard: add filter state to invoice page navigation (e.g. "Outstanding" card → invoices pre-filtered to overdue/unpaid)
- Dashboard: "Quotes sent/active" card — consider adding a dedicated Quotes count card
- `viewed` status: verify DB allows text value (not Postgres enum); if enum, migration needed
