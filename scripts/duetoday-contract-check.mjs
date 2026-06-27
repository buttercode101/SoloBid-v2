import { readFileSync, existsSync } from 'node:fs';

const requiredFiles = [
  'src/lib/duetoday/types.ts',
  'src/lib/duetoday/contract.ts',
  'src/lib/duetoday/actions.ts',
  'src/lib/duetoday/index.ts',
  'src/components/duetoday/DueTodayActionsPanel.tsx',
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`Missing required DueToday file: ${file}`);
}

const actionsPath = 'src/lib/duetoday/actions.ts';
const contractPath = 'src/lib/duetoday/contract.ts';
const typesPath = 'src/lib/duetoday/types.ts';
const panelPath = 'src/components/duetoday/DueTodayActionsPanel.tsx';
const indexPath = 'src/lib/duetoday/index.ts';

const actions = existsSync(actionsPath) ? readFileSync(actionsPath, 'utf8') : '';
const contract = existsSync(contractPath) ? readFileSync(contractPath, 'utf8') : '';
const types = existsSync(typesPath) ? readFileSync(typesPath, 'utf8') : '';
const panel = existsSync(panelPath) ? readFileSync(panelPath, 'utf8') : '';
const index = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '';

const forbiddenWrites = ['.insert(', '.update(', '.delete(', '.upsert(', '.rpc('];
for (const token of forbiddenWrites) {
  if (actions.includes(token)) failures.push(`DueToday adapter must stay read-only. Found ${token} in ${actionsPath}`);
}

const requiredActionTokens = [
  'getSoloBidDueTodayActions',
  'createSoloBidDueTodayExternalKey',
  'isResolvedSoloBidQuoteStatus',
  'isResolvedSoloBidInvoiceStatus',
  'quote_follow_up',
  'invoice_follow_up',
  'payment_chase',
  'recurring_invoices',
  'organizationId: context.organizationId',
];
for (const token of requiredActionTokens) {
  if (!actions.includes(token)) failures.push(`Expected SoloBid adapter token missing: ${token}`);
}

const requiredContractTokens = [
  "DUE_TODAY_SOURCE_APP = 'solobid'",
  'SOLOBID_DUE_TODAY_SOURCE_MAP',
  'DEFAULT_QUOTE_FOLLOW_UP_DAYS',
  'createSoloBidDueTodayExternalKey',
  'isResolvedSoloBidQuoteStatus',
  'isResolvedSoloBidInvoiceStatus',
  'source_table: \'quotes\'',
  'source_table: \'invoices\'',
  'source_table: \'recurring_invoices\'',
];
for (const token of requiredContractTokens) {
  if (!contract.includes(token)) failures.push(`Expected SoloBid contract token missing: ${token}`);
}

const requiredTypeTokens = [
  'DueTodayAction',
  'external_key',
  'source_app',
  'source_table',
  'source_id',
  'due_date',
  'money_value',
  'organization_id',
  'organizationId?: string | null',
];
for (const token of requiredTypeTokens) {
  if (!types.includes(token)) failures.push(`Expected DueToday type token missing: ${token}`);
}

if (!index.includes("export * from './contract'")) {
  failures.push('DueToday index should export local contract helpers.');
}

if (!panel.includes('All') || !panel.includes('Overdue') || !panel.includes('Upcoming')) {
  failures.push('SoloBid DueToday panel should keep timeline filters visible.');
}

const hasDueTodayHeading = panel.includes("Today's Money") || panel.includes('Today&apos;s Money');
if (!panel.includes('Powered by DueToday') || !hasDueTodayHeading) {
  failures.push('SoloBid DueToday panel should preserve DueToday positioning copy.');
}

if (failures.length) {
  console.error('\nDueToday contract check failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('DueToday contract check passed for SoloBid.');
