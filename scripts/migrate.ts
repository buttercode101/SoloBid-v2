#!/usr/bin/env tsx
/**
 * Runs DB migrations against the Supabase project via the Management API.
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=<token> npx tsx scripts/migrate.ts
 *
 * Alternatively if SUPABASE_SERVICE_ROLE_KEY is set, creates the storage
 * bucket using the supabase-js client.
 */

const PROJECT_REF = 'kkxgrsmmwajcbuuigayf';
const MGMT_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

const migrations: { name: string; sql: string }[] = [
  {
    name: '01_profiles_bank_details',
    sql: `
      ALTER TABLE profiles
        ADD COLUMN IF NOT EXISTS bank_name text,
        ADD COLUMN IF NOT EXISTS account_number text,
        ADD COLUMN IF NOT EXISTS account_type text,
        ADD COLUMN IF NOT EXISTS branch_code text;
    `,
  },
  {
    name: '02_clients_vat_number',
    sql: `
      ALTER TABLE clients
        ADD COLUMN IF NOT EXISTS vat_number text;
    `,
  },
  {
    name: '03_invoices_payment_fields',
    sql: `
      ALTER TABLE invoices
        ADD COLUMN IF NOT EXISTS supply_date date,
        ADD COLUMN IF NOT EXISTS paystack_reference text,
        ADD COLUMN IF NOT EXISTS client_vat_number text;
    `,
  },
  {
    name: '04_quotes_client_vat',
    sql: `
      ALTER TABLE quotes
        ADD COLUMN IF NOT EXISTS client_vat_number text;
    `,
  },
  {
    name: '05_webhook_logs',
    sql: `
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        provider text NOT NULL,
        reference text UNIQUE NOT NULL,
        payload jsonb,
        status text DEFAULT 'processed',
        created_at timestamptz DEFAULT now()
      );
    `,
  },
  {
    name: '06_quote_attachments',
    sql: `
      CREATE TABLE IF NOT EXISTS quote_attachments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE,
        invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
        file_name text NOT NULL,
        file_path text NOT NULL,
        file_type text,
        file_size int,
        uploaded_at timestamptz DEFAULT now()
      );
      ALTER TABLE quote_attachments ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = 'quote_attachments' AND policyname = 'Users own attachments'
        ) THEN
          CREATE POLICY "Users own attachments"
            ON quote_attachments FOR ALL USING (auth.uid() = user_id);
        END IF;
      END $$;
    `,
  },
  {
    name: '07_recurring_quotes',
    sql: `
      CREATE TABLE IF NOT EXISTS recurring_quotes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
        client_name text,
        client_email text,
        template_quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
        frequency text NOT NULL DEFAULT 'monthly',
        next_issue_date date NOT NULL,
        status text NOT NULL DEFAULT 'active',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
      ALTER TABLE recurring_quotes ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = 'recurring_quotes' AND policyname = 'Users own recurring quotes'
        ) THEN
          CREATE POLICY "Users own recurring quotes"
            ON recurring_quotes FOR ALL USING (auth.uid() = user_id);
        END IF;
      END $$;
    `,
  },
];

async function runMigration(name: string, sql: string, token: string): Promise<void> {
  const res = await fetch(MGMT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Migration "${name}" failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  // Successful DDL returns an empty array or similar
  console.log(`  ✓ ${name}`);
  if (data && !Array.isArray(data)) {
    console.log('    ', JSON.stringify(data));
  }
}

async function createStorageBucket(): Promise<void> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = `https://${PROJECT_REF}.supabase.co`;

  if (!serviceKey) {
    console.log('\n⚠  SUPABASE_SERVICE_ROLE_KEY not set — skipping storage bucket creation.');
    console.log('   Manually create bucket "quote-attachments" (private) in the Supabase dashboard.');
    return;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: existing } = await admin.storage.getBucket('quote-attachments');
  if (existing) {
    console.log('  ✓ Storage bucket "quote-attachments" already exists');
    return;
  }

  const { error } = await admin.storage.createBucket('quote-attachments', {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024, // 10MB per file
    allowedMimeTypes: ['image/*', 'application/pdf'],
  });

  if (error) {
    console.warn(`  ⚠  Could not create storage bucket: ${error.message}`);
    console.log('     Manually create bucket "quote-attachments" (private) in the Supabase dashboard.');
  } else {
    console.log('  ✓ Storage bucket "quote-attachments" created (private, 10MB limit)');
  }
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;

  if (!token) {
    console.error('Error: SUPABASE_ACCESS_TOKEN environment variable is required.');
    console.error('Get yours at: https://supabase.com/dashboard/account/tokens');
    process.exit(1);
  }

  console.log(`\nRunning ${migrations.length} migrations against project ${PROJECT_REF}...\n`);

  for (const { name, sql } of migrations) {
    try {
      await runMigration(name, sql, token);
    } catch (err) {
      console.error(`✗ ${(err as Error).message}`);
      process.exit(1);
    }
  }

  console.log('\nCreating Supabase Storage bucket...\n');
  await createStorageBucket();

  console.log('\n✅ All migrations complete.\n');
}

main();
