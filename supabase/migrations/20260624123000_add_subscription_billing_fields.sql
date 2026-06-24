-- SoloBid subscription billing support
-- Paystack is used for SoloBid account subscriptions, not contractor/client invoice payments.

alter table public.users
  add column if not exists subscription_status text not null default 'free',
  add column if not exists subscription_plan_id text,
  add column if not exists subscription_provider text,
  add column if not exists subscription_reference text,
  add column if not exists subscription_updated_at timestamptz;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null default 'paystack',
  provider_reference text not null,
  plan_id text not null,
  status text not null default 'active',
  amount numeric,
  currency text default 'ZAR',
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_reference)
);

alter table public.subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'subscriptions'
      and policyname = 'Users can read own subscriptions'
  ) then
    create policy "Users can read own subscriptions"
      on public.subscriptions
      for select
      using (auth.uid() = user_id);
  end if;
end
$$;

create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_provider_reference_idx on public.subscriptions(provider, provider_reference);
