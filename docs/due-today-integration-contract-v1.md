# DueToday Integration Contract v1

Status: Draft 1
Scope: SoloBid, RentEase SA, RadFlow SA, and DueToday Core / Action Engine.

## Principle

The repositories are the source of truth. No workflow should be assumed from a product name.

DueToday is a shared action layer. It should answer: what money or work action is due today, overdue, upcoming, or completed?

DueToday must not become a merged super-app. SoloBid, RentEase SA, and RadFlow SA remain separate products and systems of record.

## Systems of record

- SoloBid owns quotes, invoices, clients, templates, expenses, attachments, and recurring invoices.
- RentEase SA owns properties, units, tenants, leases, payments, and maintenance requests.
- RadFlow SA owns clinic workflow records, appointments, studies, reports, billing records, audit logs, and related healthcare workflow data.

DueToday should store only action summaries and source links.

## Core action shape

```ts
export interface DueTodayAction {
  id: string;
  source_app: "solobid" | "rentease" | "radflow" | "duetoday";
  source_table: string;
  source_id: string;
  owner_id: string | null;
  organization_id: string | null;
  title: string;
  description: string | null;
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "waiting" | "completed" | "cancelled";
  due_date: string;
  money_value: number | null;
  currency: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  source_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}
```

## Privacy boundary

DueToday may store safe action summaries, dates, status, priority, money value, limited reminder contact fields where already used by the source app, and source links.

DueToday must not copy full documents, uploaded files, signatures, bank details, clinical content, report content, raw AI output, or unnecessary personal details from source apps.

RadFlow integration must use the strictest minimisation. DueToday should show neutral titles such as "Review study", "Approve report", or "Follow up unpaid invoice", with a source link back to RadFlow for authorised users.

## SoloBid action candidates

Confirmed repo concepts: Quote, Invoice, Client, Template, Expense, Attachment, RecurringInvoice, RecurringQuote.

Candidate actions:

- sent quote -> quote follow-up
- viewed quote -> quote follow-up
- expired quote that is not approved/rejected/converted -> quote follow-up
- sent invoice due today or earlier -> invoice follow-up
- overdue invoice -> payment chase
- partially paid invoice -> payment chase
- active recurring invoice due today or earlier -> invoice follow-up

Draft quotes should not become actions unless the user explicitly schedules them.

## RentEase SA action candidates

Confirmed dashboard concepts: properties, units, leases, payments, maintenance requests, overdue rent, expiring leases, outstanding rent, open maintenance.

Candidate actions:

- overdue payment -> rent collection
- pending payment due today or earlier -> rent collection
- active lease expiring soon -> lease renewal
- urgent or high-priority open maintenance -> maintenance follow-up
- open maintenance -> maintenance follow-up

RentEase remains the source of truth for tenant, lease, property, unit, payment, and maintenance details.

## RadFlow SA action candidates

Confirmed repo concepts: appointments, studies, reports, invoices, work queue, healthcare workflow dashboard.

Candidate actions:

- appointment scheduled for today -> appointment follow-up
- no-show appointment -> appointment follow-up
- pending study -> study review
- study awaiting review -> study review
- study in review -> study review
- report pending approval -> report approval
- sent invoice due today or earlier -> billing follow-up
- overdue invoice -> billing follow-up

RadFlow remains the source of truth for all healthcare workflow details.

## Deduplication

Every generated action needs a stable external key:

```ts
const externalKey = `${source_app}:${source_table}:${source_id}:${category}`;
```

Publishers must upsert by this key instead of creating duplicates.

When the source record is resolved, the DueToday action should be completed or cancelled.

Examples:

- SoloBid invoice paid -> complete payment action.
- RentEase payment paid -> complete rent collection action.
- RadFlow report approved -> complete report approval action.
- SoloBid quote approved/rejected/converted -> complete quote follow-up action.

## V1 source-of-truth rule

DueToday may display actions. DueToday may later send reminders. DueToday may show money at risk.

DueToday must not change source-app domain state in v1.

Completing an action in DueToday should not mark an invoice paid, approve a report, renew a lease, or change a study status.

## First milestone

Add a read-only adapter to each app:

```ts
export async function getDueTodayActions(context): Promise<DueTodayAction[]>;
```

Suggested files:

- SoloBid: `src/lib/duetoday/actions.ts`
- RentEase SA: `src/lib/duetoday/actions.ts`
- RadFlow SA: `src/lib/duetoday/actions.ts`

## Implementation order

1. SoloBid read-only action extraction.
2. RentEase SA read-only action extraction.
3. RadFlow SA read-only action extraction with strict minimisation.
4. Local DueToday Actions panel in each app.
5. Shared DueToday dashboard only after extraction is stable.
6. Notifications only after deduplication is proven.

## Non-goals for v1

- No super-app.
- No shared auth migration.
- No cross-app database merge.
- No write-back automation.
- No copied source documents.
- No sensitive healthcare content copied into DueToday.

## Recommendation

Start with read-only action extraction. This proves the model without breaking existing workflows.

SoloBid should go first because quote and invoice actions match DueToday's money-action promise most directly.
