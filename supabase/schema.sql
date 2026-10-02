-- =============================================================================
-- Sniper Trader — full Supabase schema (run once on a NEW project)
-- Copy this entire file into Supabase → SQL Editor → Run.
-- For existing projects that already ran schema + 002 + 003, only run
-- migrations/004_safety_platforms_mcap.sql instead.
-- =============================================================================

create table if not exists bot_config (
  id integer primary key default 1 check (id = 1),
  paused boolean not null default false,
  enable_solana boolean not null default true,
  enable_bsc boolean not null default false,
  min_recommend_tier text not null default 'LOW_MEDIUM'
    check (min_recommend_tier in ('LOW', 'LOW_MEDIUM')),
  max_tokens_per_day integer not null default 50,
  max_dev_percent numeric not null default 99,
  max_top10_percent numeric not null default 99,
  capital_pct numeric not null default 10,
  max_position_sol numeric not null default 0.5,
  bsc_capital_pct numeric not null default 10,
  bsc_max_position_bnb numeric not null default 0.1,
  -- Exit (0 = auto by risk tier)
  take_profit_pct numeric not null default 0,
  stop_loss_pct numeric not null default 0,
  max_hold_min numeric not null default 0,
  max_risk_score numeric not null default 100,
  heartbeat_min integer not null default 60,
  -- MEDIUM tier ceilings
  medium_max_dev_percent numeric not null default 99,
  medium_max_top10_percent numeric not null default 99,
  medium_max_score numeric not null default 100,
  -- BSC tax
  max_buy_tax_pct numeric not null default 50,
  max_sell_tax_pct numeric not null default 50,
  -- Safety / filters (0 = off for numeric gates)
  min_market_cap_usd numeric not null default 0,
  max_single_holder_percent numeric not null default 0,
  max_high_ownership_percent numeric not null default 0,
  block_mint_authority boolean not null default false,
  block_creator_rug boolean not null default false,
  -- Launchpads
  launchpad_pumpfun boolean not null default true,
  launchpad_launchlab boolean not null default true,
  launchpad_meteora boolean not null default true,
  launchpad_moonshot boolean not null default true,
  launchpad_boop boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into bot_config (id) values (1) on conflict (id) do nothing;

create or replace function set_bot_config_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bot_config_updated_at on bot_config;
create trigger bot_config_updated_at
  before update on bot_config
  for each row execute function set_bot_config_updated_at();

-- Assessments log (scanner / risk engine)
create table if not exists assessments (
  id bigserial primary key,
  chain text not null,
  address text not null,
  score numeric,
  tier text,
  recommended boolean,
  tradeable boolean,
  reasons jsonb,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists assessments_created_at_idx on assessments (created_at desc);
create index if not exists assessments_address_idx on assessments (address);

-- Open / closed positions
create table if not exists positions (
  id bigserial primary key,
  chain text not null,
  mint text not null,
  status text not null default 'open',
  size_native numeric,
  entry_native numeric,
  exit_native numeric,
  pnl_native numeric,
  pnl_pct numeric,
  reason text,
  signature_buy text,
  signature_sell text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists positions_status_idx on positions (status, opened_at desc);
create index if not exists positions_mint_idx on positions (mint);

-- Optional: enable Realtime in Dashboard → Database → Replication, or:
-- alter publication supabase_realtime add table bot_config;
-- alter publication supabase_realtime add table assessments;
-- alter publication supabase_realtime add table positions;
