# SoloBid DueToday Integration

Last updated: 2026-06-27

## Purpose

DueToday supports SoloBid's existing quote-to-invoice workflow. It should help the user know which quote, invoice, or recurring invoice needs attention today.

SoloBid remains the quote closing workspace. DueToday is a support surface, not a replacement for the dashboard, quote editor, invoice pages, or reports.

## Current files

- `src/lib/duetoday/types.ts`
- `src/lib/duetoday/actions.ts`
- `src/lib/duetoday/index.ts`
- `src/components/duetoday/DueTodayActionsPanel.tsx`
- `/due-today` route registration in `src/app/AppRoutes.tsx`
- Navigation entry in `src/components/Layout.tsx`

## Current action sources

- Quotes that are sent, viewed, or expired.
- Invoices that are sent, overdue, or partially paid.
- Active recurring invoices due to be issued.

## Safety rules

- Read-only action generation only.
- No source-record mutation.
- No automated sending.
- WhatsApp links remain user-initiated.
- Dashboard remains the quote closing workspace.

## Product positioning

DueToday can be prominent in SoloBid because follow-up and payment chasing are close to SoloBid's core purpose.
