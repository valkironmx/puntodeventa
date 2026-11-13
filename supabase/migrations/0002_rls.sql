-- RLS en TODAS las tablas (PLAN §5.1). El admin nunca puede DELETE; el cajero solo POS (vía RPC).
set search_path = public, extensions;

create or replace function public.is_super_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;
create or replace function public.member_role(b uuid) returns text language sql stable security definer set search_path = public as $$
  select role from public.memberships where business_id = b and user_id = auth.uid() and active limit 1
$$;
create or replace function public.is_member(b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.member_role(b) is not null
$$;
create or replace function public.can_manage(b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or public.member_role(b) in ('owner','admin')
$$;
create or replace function public.can_delete(b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or public.member_role(b) = 'owner'
$$;
create or replace function public.my_membership(b uuid) returns uuid language sql stable security definer set search_path = public as $$
  select id from public.memberships where business_id = b and user_id = auth.uid() and active limit 1
$$;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
-- La tabla de control de migraciones solo existe en tu Mac (en Supabase se usa app_auth.migrations)
do $$ begin if to_regclass('public._migrations') is not null then execute 'revoke all on public._migrations from authenticated'; end if; end $$;
-- pin_hash nunca sale al cliente: permisos por columna en memberships
revoke select on public.memberships from authenticated;
grant select (id, business_id, user_id, role, display_name, active, created_at, updated_at) on public.memberships to authenticated;

do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename <> '_migrations' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Plataforma
create policy pa_select on public.platform_admins for select to authenticated using (user_id = auth.uid() or public.is_super_admin());
create policy plans_select on public.plans for select to authenticated using (true);
create policy plans_write on public.plans for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy biz_select on public.businesses for select to authenticated using (public.is_member(id) or public.is_super_admin());
create policy biz_update on public.businesses for update to authenticated using (public.can_manage(id)) with check (public.can_manage(id));
create policy biz_insert on public.businesses for insert to authenticated with check (public.is_super_admin());
create policy biz_delete on public.businesses for delete to authenticated using (public.is_super_admin());
-- Columnas sensibles: solo super admin
create or replace function public.protect_business_columns() returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' and not public.is_super_admin() then
    if new.slug is distinct from old.slug or new.plan is distinct from old.plan or new.plan_expires_at is distinct from old.plan_expires_at
       or new.status is distinct from old.status or new.owner_email is distinct from old.owner_email or new.custom_domain is distinct from old.custom_domain then
      raise exception 'Solo el super admin puede cambiar slug, plan o estatus';
    end if;
  end if;
  return new;
end $$;
create trigger protect_business_columns before update on public.businesses for each row execute function public.protect_business_columns();

create policy mem_select on public.memberships for select to authenticated using (public.is_member(business_id) or public.is_super_admin());
create policy mem_insert on public.memberships for insert to authenticated with check (public.can_delete(business_id));
create policy mem_update on public.memberships for update to authenticated using (public.can_delete(business_id)) with check (public.can_delete(business_id));
create policy mem_delete on public.memberships for delete to authenticated using (public.can_delete(business_id));

-- Tablas administrables: lee todo miembro; escribe owner/admin; borra solo owner/super
do $$ declare t text; begin
  foreach t in array array['categories','products','product_images','product_option_groups','product_options','ticket_settings','booking_settings','staff_schedules','schedule_blocks'] loop
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (public.is_member(business_id) or public.is_super_admin())', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check (public.can_manage(business_id))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (public.can_manage(business_id)) with check (public.can_manage(business_id))', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using (public.can_delete(business_id))', t);
  end loop;
  -- Cotizaciones: el cajero no las ve
  foreach t in array array['quotes','quote_items'] loop
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (public.can_manage(business_id))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check (public.can_manage(business_id))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (public.can_manage(business_id)) with check (public.can_manage(business_id))', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using (public.can_delete(business_id))', t);
  end loop;
  -- Solo lectura para miembros; se escriben únicamente por RPC (security definer)
  foreach t in array array['sales','sale_items','payments','cash_sessions','cash_movements','inventory_movements','business_counters','qr_codes','qr_scans','appointment_events'] loop
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (public.is_member(business_id) or public.is_super_admin())', t);
  end loop;
end $$;

-- Citas: dueño/admin ven todo; el empleado solo las suyas
create policy appt_select on public.appointments for select to authenticated
  using (public.can_manage(business_id) or membership_id = public.my_membership(business_id));

-- Papelera de cotizaciones: mandar a papelera (deleted_at) es "eliminar" → solo dueño
create or replace function public.protect_quote_trash() returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' and new.deleted_at is distinct from old.deleted_at and not public.can_delete(new.business_id) then
    raise exception 'Solo el dueño puede eliminar';
  end if;
  return new;
end $$;
create trigger protect_quote_trash before update on public.quotes for each row execute function public.protect_quote_trash();
create or replace function public.protect_product_trash() returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' and new.deleted_at is distinct from old.deleted_at and not public.can_delete(new.business_id) then
    raise exception 'Solo el dueño puede eliminar';
  end if;
  return new;
end $$;
create trigger protect_product_trash before update on public.products for each row execute function public.protect_product_trash();
