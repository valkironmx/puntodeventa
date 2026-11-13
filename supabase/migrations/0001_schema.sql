-- Esquema completo (PLAN §5). Dinero numeric(12,2); cantidades numeric(12,3).
set search_path = public, extensions;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- ---------- Plataforma ----------
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table public.plans (            -- §11.4: límites por plan (placeholders configurables)
  code text primary key, name text not null, max_employees int not null, max_products int, price numeric(12,2) default 0
);
insert into public.plans values ('prueba','Prueba 15 días',2,50,0),('basico','Básico',2,200,199),('pro','Pro',5,null,399);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, name text not null,
  owner_email text not null, phone text,
  mode text not null default 'food' check (mode in ('food','retail','service')),
  features jsonb not null default '{}',
  plan text not null default 'basico' references public.plans(code),
  plan_expires_at date, status text not null default 'activo' check (status in ('activo','por_vencer','suspendido')),
  tagline text, logo_path text, hero_path text,
  hero_focal_x smallint not null default 50, hero_focal_y smallint not null default 50,
  accent_color text not null default '#1F8A6B', accent_auto boolean not null default true,
  address text, maps_url text, lat numeric, lng numeric,
  contact jsonb not null default '{}',
  schedule jsonb not null default '[]',
  tax_mode_global text not null default 'included' check (tax_mode_global in ('included','plus')),
  tax_rate numeric(5,2) not null default 16 check (tax_rate in (16,8,0)),
  custom_domain text unique,
  onboarded boolean not null default false,     -- asistente inicial terminado
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','cashier')),
  display_name text not null, pin_hash text,
  pin_attempts smallint not null default 0, pin_locked_until timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);

-- ---------- Catálogo ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null, position int not null default 0, visible boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null, description text,
  emoji text,                                     -- ilustración de respaldo cuando no hay foto
  kind text not null default 'product' check (kind in ('product','service')),
  sale_unit text not null default 'pieza' check (sale_unit in ('pieza','kg','g','m','cm','l','ml')),
  price numeric(12,2) not null check (price >= 0),
  sale_price numeric(12,2) check (sale_price is null or sale_price < price),
  price_from boolean not null default false,
  duration_min int,
  tax_mode text not null default 'global' check (tax_mode in ('global','included','plus','exempt')),
  track_stock boolean not null default true, stock numeric(12,3) not null default 0,
  show_in_catalog boolean not null default true,
  active boolean not null default true,
  featured boolean not null default false, position int not null default 0,
  custom_fields jsonb not null default '[]',
  deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.products (business_id);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  path text not null, position smallint not null check (position between 0 and 2),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create or replace function public.product_images_max3() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.product_images where product_id = new.product_id) >= 3 then
    raise exception 'Máximo 3 imágenes por producto';
  end if;
  return new;
end $$;
create trigger product_images_max3 before insert on public.product_images for each row execute function public.product_images_max3();

create table public.product_option_groups (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null, type text not null default 'modifier' check (type in ('modifier','variant')),
  position int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.product_options (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  group_id uuid not null references public.product_option_groups(id) on delete cascade,
  label text not null, price_delta numeric(12,2) not null default 0, position int not null default 0,
  track_stock boolean not null default false, stock numeric(12,3) not null default 0, sku text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  option_id uuid references public.product_options(id) on delete set null,
  qty numeric(12,3) not null, reason text not null check (reason in ('sale','adjust','cancel','quote_sale')),
  ref_table text, ref_id uuid, created_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- El stock nunca se edita directo desde la venta: solo por movimientos.
create or replace function public.apply_inventory_movement() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.option_id is not null then
    update public.product_options set stock = stock + new.qty where id = new.option_id;
  else
    update public.products set stock = stock + new.qty where id = new.product_id;
  end if;
  return new;
end $$;
create trigger apply_inventory_movement after insert on public.inventory_movements for each row execute function public.apply_inventory_movement();

-- ---------- Folios ----------
create table public.business_counters (
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null, last_value int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (business_id, kind)
);

-- ---------- Cotizaciones ----------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  folio int not null, client_name text, client_phone text, client_email text,
  status text not null default 'pending' check (status in ('draft','pending','accepted','rejected','cancelled','expired','converted')),
  valid_days int not null default 15, issued_at date not null default current_date, expires_at date,
  prices_plus_tax boolean not null default false,
  custom_fields jsonb not null default '[]',
  notes text, subtotal numeric(12,2) not null default 0, tax numeric(12,2) not null default 0, total numeric(12,2) not null default 0,
  converted_sale_id uuid, created_by uuid, deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  title text not null, description text, unit_price numeric(12,2) not null, qty numeric(12,3) not null,
  sale_unit text not null default 'pieza', tax_mode text not null default 'included', position int not null default 0,
  line_subtotal numeric(12,2) not null default 0, line_tax numeric(12,2) not null default 0, line_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ---------- Ventas, pagos y caja ----------
create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  device_label text, opened_by uuid, opened_at timestamptz not null default now(), opening_float numeric(12,2) not null default 0,
  closed_by uuid, closed_at timestamptz, expected_cash numeric(12,2), counted_cash numeric(12,2), difference numeric(12,2), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index one_open_session on public.cash_sessions (business_id) where closed_at is null;

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  folio int not null, source text not null check (source in ('pos','quote')),
  quote_id uuid references public.quotes(id) on delete set null, customer_name text,
  order_type text not null default 'mostrador' check (order_type in ('mostrador','comer_aqui','para_llevar','domicilio','envio','en_local')),
  table_label text,
  status text not null default 'pending' check (status in ('paid','partial','pending','cancelled')),
  subtotal numeric(12,2) not null default 0, tax numeric(12,2) not null default 0, total numeric(12,2) not null default 0,
  paid_total numeric(12,2) not null default 0,
  balance numeric(12,2) generated always as (total - paid_total) stored,
  cash_received numeric(12,2), change_given numeric(12,2),
  cash_session_id uuid references public.cash_sessions(id) on delete set null, created_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.sales (business_id, created_at desc);
create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  option_id uuid references public.product_options(id) on delete set null,
  title text not null, unit_price numeric(12,2) not null, qty numeric(12,3) not null, sale_unit text not null default 'pieza',
  options jsonb not null default '[]', notes text, tax_mode text not null,
  line_subtotal numeric(12,2) not null, line_tax numeric(12,2) not null, line_total numeric(12,2) not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('cash','card','transfer')),
  note text, cash_session_id uuid references public.cash_sessions(id) on delete set null, received_by uuid,
  is_initial boolean not null default false,        -- pago hecho al registrar la venta en POS (no es abono)
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create or replace function public.recalc_sale_paid() returns trigger language plpgsql security definer set search_path = public as $$
declare v_sale uuid := coalesce(new.sale_id, old.sale_id); v_paid numeric(12,2);
begin
  select coalesce(sum(amount), 0) into v_paid from public.payments where sale_id = v_sale;
  update public.sales set paid_total = v_paid,
    status = case when status = 'cancelled' then 'cancelled' when v_paid >= total and total > 0 then 'paid' when v_paid > 0 then 'partial' else 'pending' end
  where id = v_sale;
  return null;
end $$;
create trigger recalc_sale_paid after insert or update or delete on public.payments for each row execute function public.recalc_sale_paid();

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  cash_session_id uuid not null references public.cash_sessions(id) on delete cascade,
  type text not null check (type in ('in','out')), amount numeric(12,2) not null check (amount > 0), reason text, created_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ---------- QR dinámico ----------
create table public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code text unique not null,
  destination_type text not null default 'catalog' check (destination_type in ('catalog','whatsapp','custom')),
  destination_url text,
  active boolean not null default true, scans_count int not null default 0,
  replaced_by uuid references public.qr_codes(id), deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (destination_type <> 'custom' or destination_url ~ '^https://')
);
create table public.qr_scans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  qr_id uuid not null references public.qr_codes(id) on delete cascade,
  scanned_at timestamptz not null default now(), user_agent text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ---------- Agenda ----------
create table public.booking_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  online_enabled boolean not null default true,
  requires_approval boolean not null default true,
  approvers text not null default 'owner_admin_assignee' check (approvers in ('owner_admin','owner_admin_assignee')),
  approval_timeout_min int not null default 120,
  slot_interval_min int not null default 30 check (slot_interval_min in (15,30,60)),
  min_notice_min int not null default 120, max_days_ahead int not null default 30,
  cancel_until_min int not null default 120, buffer_min int not null default 0,
  reminder_24h boolean not null default true, reminder_2h boolean not null default true,
  reminder_template text default 'Hola {cliente}, te recordamos tu cita en {negocio}: {servicio} el {día} a las {hora}. Detalles: {link}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.staff_schedules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),   -- 0 = domingo
  start_time time not null, end_time time not null, break_start time, break_end time, enabled boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (membership_id, weekday)
);
create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  membership_id uuid references public.memberships(id) on delete cascade,
  starts_at timestamptz not null, ends_at timestamptz not null, reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  customer_name text not null, customer_phone text, notes text,
  starts_at timestamptz not null, ends_at timestamptz not null,
  price numeric(12,2),
  status text not null default 'pending' check (status in ('pending','confirmed','rejected','cancelled','completed','no_show','expired')),
  source text not null default 'online' check (source in ('online','panel')),
  public_token text unique not null,
  hold_expires_at timestamptz,
  decided_by uuid, decided_at timestamptz, reject_reason text,
  sale_id uuid references public.sales(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  exclude using gist (membership_id with =, tstzrange(starts_at, ends_at) with &&) where (status in ('pending','confirmed'))
);
create index on public.appointments (business_id, starts_at);
create table public.appointment_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  type text not null, created_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ---------- Ticket ----------
create table public.ticket_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  show_logo boolean not null default true, header_name text,
  show_address boolean not null default true, address_text text,
  show_phone boolean not null default true, phone_text text,
  show_tax_breakdown boolean not null default true, show_payment boolean not null default true, show_cashier boolean not null default true,
  thanks_message text default '¡Gracias por su compra!',
  show_qr boolean not null default true, qr_text text default 'Escanee para ver nuestro menú',
  footer_text text,
  paper_width smallint not null default 58 check (paper_width in (58,80)),
  auto_print boolean not null default true, open_cash_drawer boolean not null default false,
  printer_name text, printer_address text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- updated_at en todas las tablas
do $$ declare t text; begin
  for t in select table_name from information_schema.columns where table_schema = 'public' and column_name = 'updated_at' loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
