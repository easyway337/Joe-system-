-- =====================================================================
-- Joe System (Nexus) — CRM schema for Supabase (PostgreSQL)
-- Run this once in: Supabase Dashboard -> SQL Editor -> New query
-- =====================================================================

create extension if not exists pgcrypto; -- gives us gen_random_uuid()

-- ---------------------------------------------------------------------
-- ACCOUNTS — companies/customers the sales team works with
-- ---------------------------------------------------------------------
create table if not exists accounts (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    industry    text,
    owner       text,               -- sales rep responsible for the account
    website     text,
    created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- LEADS — raw inbound contacts, not yet a confirmed deal
-- ---------------------------------------------------------------------
create table if not exists leads (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    company     text,
    email       text,
    phone       text,
    source      text not null default 'manual',   -- e.g. 'website', 'voice-assistant', 'referral'
    status      text not null default 'new'
                check (status in ('new', 'contacted', 'qualified', 'converted', 'lost')),
    account_id  uuid references accounts(id) on delete set null,
    created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- DEALS — the sales pipeline (this powers the "Active Opportunities" table)
-- ---------------------------------------------------------------------
create table if not exists deals (
    id             uuid primary key default gen_random_uuid(),
    client_name    text not null,
    account_id     uuid references accounts(id) on delete set null,
    deal_stage     text not null default 'Qualified'
                   check (deal_stage in ('Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost')),
    value          numeric(12, 2) not null default 0,
    probability    int not null default 0 check (probability between 0 and 100),
    owner          text,
    last_activity  timestamptz not null default now(),
    created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Indexes for the lookups the app actually performs
-- ---------------------------------------------------------------------
create index if not exists idx_leads_status        on leads (status);
create index if not exists idx_leads_account_id     on leads (account_id);
create index if not exists idx_deals_stage          on deals (deal_stage);
create index if not exists idx_deals_account_id     on deals (account_id);
create index if not exists idx_accounts_name_lower  on accounts (lower(name));
create index if not exists idx_leads_name_lower     on leads (lower(name));

-- ---------------------------------------------------------------------
-- Row Level Security
-- The backend connects with the service_role key, which bypasses RLS
-- entirely — so these policies only matter if you later also query these
-- tables directly from the browser with the public "anon" key. Enabled by
-- default as a safe baseline; tighten the USING/WITH CHECK clauses once
-- you add real user accounts.
-- ---------------------------------------------------------------------
alter table accounts enable row level security;
alter table leads    enable row level security;
alter table deals    enable row level security;

create policy "service role full access - accounts" on accounts
    for all using (true) with check (true);
create policy "service role full access - leads" on leads
    for all using (true) with check (true);
create policy "service role full access - deals" on deals
    for all using (true) with check (true);

-- ---------------------------------------------------------------------
-- Seed data — mirrors the mock data the dashboard used before, so the UI
-- looks the same immediately after you connect Supabase.
-- ---------------------------------------------------------------------
insert into accounts (name, industry, owner, website) values
    ('Apex Solutions', 'Manufacturing', 'Sarah', 'apexsolutions.example.com')
on conflict do nothing;

insert into deals (client_name, deal_stage, value, probability, owner, account_id)
select 'Apex Solutions', stage, value, probability, 'Sarah', a.id
from (values
    ('Proposal', 45000, 75),
    ('Proposal', 36000, 75),
    ('Proposal', 20000, 20),
    ('Proposal', 15000, 50),
    ('Proposal', 15000, 75)
) as d(stage, value, probability)
cross join (select id from accounts where name = 'Apex Solutions' limit 1) as a
on conflict do nothing;
