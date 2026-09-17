-- =====================================================================
-- Joe System (Nexus) — ERP schema for Supabase (PostgreSQL)
-- Run this once in: Supabase Dashboard -> SQL Editor -> New query
-- (Run sql/schema.sql first if you haven't — this file only adds ERP tables)
-- =====================================================================

create extension if not exists pgcrypto; -- gives us gen_random_uuid()

-- ---------------------------------------------------------------------
-- INVENTORY ITEMS
-- ---------------------------------------------------------------------
create table if not exists inventory_items (
    id             uuid primary key default gen_random_uuid(),
    sku            text not null unique,
    name           text not null,
    category       text,
    quantity       int not null default 0,
    reorder_level  int not null default 0,
    unit_price     numeric(12, 2) not null default 0,
    warehouse      text not null default 'Main',
    created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- ORDERS (sales orders fulfilled out of inventory)
-- ---------------------------------------------------------------------
create table if not exists orders (
    id             uuid primary key default gen_random_uuid(),
    order_number   text not null unique,
    customer_name  text not null,
    status         text not null default 'pending'
                   check (status in ('pending', 'processing', 'shipped', 'completed', 'cancelled')),
    total_value    numeric(12, 2) not null default 0,
    order_date     timestamptz not null default now(),
    created_at     timestamptz not null default now()
);

create table if not exists order_items (
    id                 uuid primary key default gen_random_uuid(),
    order_id           uuid not null references orders(id) on delete cascade,
    inventory_item_id  uuid references inventory_items(id) on delete set null,
    item_name          text not null,  -- snapshot so history survives item renames/deletes
    quantity           int not null check (quantity > 0),
    unit_price         numeric(12, 2) not null default 0
);

-- ---------------------------------------------------------------------
-- PROCUREMENT (purchase orders sent to suppliers to restock inventory)
-- ---------------------------------------------------------------------
create table if not exists purchase_orders (
    id             uuid primary key default gen_random_uuid(),
    po_number      text not null unique,
    supplier_name  text not null,
    status         text not null default 'draft'
                   check (status in ('draft', 'sent', 'received', 'cancelled')),
    total_value    numeric(12, 2) not null default 0,
    expected_date  date,
    created_at     timestamptz not null default now()
);

create table if not exists purchase_order_items (
    id                  uuid primary key default gen_random_uuid(),
    purchase_order_id   uuid not null references purchase_orders(id) on delete cascade,
    inventory_item_id   uuid references inventory_items(id) on delete set null,
    item_name           text not null,
    quantity            int not null check (quantity > 0),
    unit_cost           numeric(12, 2) not null default 0
);

-- ---------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------
create index if not exists idx_inventory_sku            on inventory_items (sku);
create index if not exists idx_inventory_name_lower      on inventory_items (lower(name));
create index if not exists idx_orders_status             on orders (status);
create index if not exists idx_order_items_order_id      on order_items (order_id);
create index if not exists idx_po_status                 on purchase_orders (status);
create index if not exists idx_po_items_po_id            on purchase_order_items (purchase_order_id);

-- ---------------------------------------------------------------------
-- Row Level Security (backend uses the service_role key, which bypasses
-- RLS entirely — enabled here as a safe baseline for any future browser
-- access with the public "anon" key).
-- ---------------------------------------------------------------------
alter table inventory_items       enable row level security;
alter table orders                enable row level security;
alter table order_items           enable row level security;
alter table purchase_orders       enable row level security;
alter table purchase_order_items  enable row level security;

create policy "service role full access - inventory_items"      on inventory_items      for all using (true) with check (true);
create policy "service role full access - orders"                on orders                for all using (true) with check (true);
create policy "service role full access - order_items"            on order_items            for all using (true) with check (true);
create policy "service role full access - purchase_orders"         on purchase_orders         for all using (true) with check (true);
create policy "service role full access - purchase_order_items"     on purchase_order_items     for all using (true) with check (true);

-- ---------------------------------------------------------------------
-- Seed data — mirrors the mock inventory the dashboard used before, plus
-- one sample order and one sample purchase order so the ERP pages aren't
-- empty on first load.
-- ---------------------------------------------------------------------
insert into inventory_items (sku, name, category, quantity, reorder_level, unit_price, warehouse) values
    ('NX-1001', 'Steel Bracket 40mm',  'Hardware',   1250, 300, 4.20,  'Main'),
    ('NX-1002', 'Hydraulic Pump A2',   'Machinery',  42,   50,  310.00,'Main'),
    ('NX-1003', 'Control Panel v3',    'Electronics',180,  100, 96.50, 'North')
on conflict (sku) do nothing;

insert into orders (order_number, customer_name, status, total_value)
values ('ORD-0001', 'Apex Solutions', 'processing', 1596.00)
on conflict (order_number) do nothing;

insert into order_items (order_id, inventory_item_id, item_name, quantity, unit_price)
select o.id, i.id, i.name, 380, 4.20
from orders o, inventory_items i
where o.order_number = 'ORD-0001' and i.sku = 'NX-1001'
on conflict do nothing;

insert into purchase_orders (po_number, supplier_name, status, total_value, expected_date)
values ('PO-0001', 'SteelWorks Supply Co.', 'sent', 2100.00, current_date + interval '7 days')
on conflict (po_number) do nothing;

insert into purchase_order_items (purchase_order_id, inventory_item_id, item_name, quantity, unit_cost)
select po.id, i.id, i.name, 500, 4.20
from purchase_orders po, inventory_items i
where po.po_number = 'PO-0001' and i.sku = 'NX-1001'
on conflict do nothing;
