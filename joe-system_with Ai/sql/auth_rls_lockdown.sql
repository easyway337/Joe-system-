-- =====================================================================
-- Joe System (Nexus) — RLS lockdown for Step 7 (Authentication)
-- Run this once in: Supabase Dashboard -> SQL Editor -> New query
-- (Run AFTER schema.sql and erp_schema.sql)
-- =====================================================================
--
-- WHY THIS IS NECESSARY:
-- Steps 4/5 created policies like `for all using (true) with check (true)`
-- with no `to <role>` clause, which means they applied to EVERY role,
-- including "anon". That was fine while the anon key never left the
-- backend. Step 7 puts the anon key in the browser (frontend/js/
-- supabase-config.js) so it can talk to Supabase Auth directly — but that
-- same key can also hit Supabase's auto-generated REST API for every
-- table. Without this fix, anyone could read/write your CRM & ERP data
-- directly with the public anon key, completely bypassing FastAPI (and
-- its business logic, like decrementing inventory on order creation).
--
-- This script re-scopes every existing policy to `to service_role` only,
-- so only the backend (which holds the service_role key in .env) can
-- read/write these tables. The anon key becomes useless for data access —
-- exactly what we want; it should only ever be used for Auth.
-- =====================================================================

drop policy if exists "service role full access - accounts" on accounts;
create policy "service role full access - accounts"
    on accounts for all to service_role using (true) with check (true);

drop policy if exists "service role full access - leads" on leads;
create policy "service role full access - leads"
    on leads for all to service_role using (true) with check (true);

drop policy if exists "service role full access - deals" on deals;
create policy "service role full access - deals"
    on deals for all to service_role using (true) with check (true);

drop policy if exists "service role full access - inventory_items" on inventory_items;
create policy "service role full access - inventory_items"
    on inventory_items for all to service_role using (true) with check (true);

drop policy if exists "service role full access - orders" on orders;
create policy "service role full access - orders"
    on orders for all to service_role using (true) with check (true);

drop policy if exists "service role full access - order_items" on order_items;
create policy "service role full access - order_items"
    on order_items for all to service_role using (true) with check (true);

drop policy if exists "service role full access - purchase_orders" on purchase_orders;
create policy "service role full access - purchase_orders"
    on purchase_orders for all to service_role using (true) with check (true);

drop policy if exists "service role full access - purchase_order_items" on purchase_order_items;
create policy "service role full access - purchase_order_items"
    on purchase_order_items for all to service_role using (true) with check (true);

-- Sanity check: list every policy and which role(s) it applies to.
-- After running this script, every row below should show "{service_role}".
select schemaname, tablename, policyname, roles
from pg_policies
where schemaname = 'public'
order by tablename;
