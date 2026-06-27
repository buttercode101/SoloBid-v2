import { readFileSync, existsSync } from 'node:fs';

const requiredFiles = [
  'src/lib/duetoday/types.ts',
  'src/lib/duetoday/contract.ts',
  'src/lib/duetoday/actions.ts',
  'src/lib/duetoday/index.ts',
  'src/components/duetoday/DueTodayActionsPanel.tsx',
  'fixtures/duetoday/realistic-actions.json',
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
const fixturesPath = 'fixtures/duetoday/realistic-actions.json';

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

function readFixtureActions() {
  if (!existsSync(fixturesPath)) return [];
  try {
    const value = JSON.parse(readFileSync(fixturesPath, 'utf8'));
    if (!Array.isArray(value)) {
      failures.push('SoloBid realistic fixture must be a JSON array.');
      return [];
    }
    return value;
  } catch (error) {
    failures.push(`SoloBid realistic fixture is invalid JSON: ${error.message}`);
    return [];
  }
}

const allowedTables = new Set(['quotes', 'invoices', 'recurring_invoices']);
const allowedCategories = new Set(['quote_follow_up', 'invoice_follow_up', 'payment_chase']);
const requiredFixtureScenarios = new Set([
  'quotes:quote_follow_up',
  'invoices:payment_chase',
  'recurring_invoices:invoice_follow_up',
]);
const seenFixtureScenarios = new Set();
const fixtureActions = readFixtureActions();

for (const action of fixtureActions) {
  const context = `${action.source_table ?? 'unknown'}:${action.category ?? 'unknown'}:${action.source_id ?? 'unknown'}`;
  const expectedKey = `${action.source_app}:${action.source_table}:${action.source_id}:${action.category}`;

  if (action.source_app !== 'solobid') failures.push(`Fixture ${context} must use source_app solobid.`);
  if (!allowedTables.has(action.source_table)) failures.push(`Fixture ${context} uses unsupported source_table ${action.source_table}.`);
  if (!allowedCategories.has(action.category)) failures.push(`Fixture ${context} uses unsupported category ${action.category}.`);
  if (action.id !== expectedKey || action.external_key !== expectedKey) failures.push(`Fixture ${context} has invalid external key.`);
  if (action.status !== 'open') failures.push(`Fixture ${context} must start as open.`);
  if (!action.title || typeof action.title !== 'string') failures.push(`Fixture ${context} needs a title.`);
  if (Number.isNaN(new Date(action.due_date).getTime())) failures.push(`Fixture ${context} has invalid due_date.`);
  if (action.currency !== 'ZAR') failures.push(`Fixture ${context} should use ZAR currency.`);
  if (!action.source_url || typeof action.source_url !== 'string') failures.push(`Fixture ${context} needs a source_url.`);
  if (!action.metadata || typeof action.metadata !== 'object' || Array.isArray(action.metadata)) failures.push(`Fixture ${context} needs metadata object.`);

  seenFixtureScenarios.add(`${action.source_table}:${action.category}`);
}

for (const scenario of requiredFixtureScenarios) {
  if (!seenFixtureScenarios.has(scenario)) failures.push(`Missing realistic SoloBid fixture scenario: ${scenario}`);
}

if (failures.length) {
  console.error('\nDueToday contract check failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`DueToday contract check passed for SoloBid with ${fixtureActions.length} realistic fixtures.`);
