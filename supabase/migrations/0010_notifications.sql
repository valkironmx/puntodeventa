-- Centro de notificaciones: avisos del sistema (super admin → todos o por modo) y notificaciones propias del negocio.
set search_path = public, extensions;

-- Avisos del sistema enviados por el super admin
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null, body text not null, link_url text,
  audience_modes text[],                         -- null = todos; si no, modos: food | retail | service
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (audience_modes is null or audience_modes <@ array['food','retail','service'])
);
-- Notificaciones propias de un negocio. user_id null = para dueño y administradores; con user_id = solo esa persona.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null check (type in ('cita','stock','plan','sistema')),
  title text not null, body text, link text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.notifications (business_id, created_at desc);
-- Qué ha leído cada usuario (kind: a = aviso, n = notificación)
create table public.notification_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('a','n')), ref_id uuid not null,
  read_at timestamptz not null default now(),
  primary key (user_id, kind, ref_id)
);

alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;
grant select, insert, update, delete on public.announcements, public.notifications, public.notification_reads to authenticated;
grant all on public.announcements, public.notifications, public.notification_reads to service_role;

create policy announcements_select on public.announcements for select to authenticated using (
  public.is_super_admin() or audience_modes is null
  or exists (select 1 from public.memberships m join public.businesses b on b.id = m.business_id
             where m.user_id = auth.uid() and m.active and b.mode = any (audience_modes)));
create policy announcements_write on public.announcements for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy notifications_select on public.notifications for select to authenticated using (
  user_id = auth.uid() or (user_id is null and public.can_manage(business_id)));
create policy notifications_delete on public.notifications for delete to authenticated using (public.can_delete(business_id));
create policy reads_own on public.notification_reads for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Lista unificada para el panel de un negocio (últimos 90 días)
create or replace function public.my_notifications(p_business uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_mode text; r jsonb;
begin
  if not (public.is_member(p_business) or public.is_super_admin()) then raise exception 'Sin permiso'; end if;
  select mode into v_mode from public.businesses where id = p_business;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.at desc), '[]'::jsonb) into r from (
    select * from (
      select 'a' as kind, a.id, 'aviso' as type, a.title, a.body, a.link_url as link, a.created_at as at,
             exists (select 1 from public.notification_reads k where k.user_id = auth.uid() and k.kind = 'a' and k.ref_id = a.id) as read
      from public.announcements a
      where (a.audience_modes is null or v_mode = any (a.audience_modes)) and a.created_at > now() - interval '90 days'
      union all
      select 'n', n.id, n.type, n.title, n.body, n.link, n.created_at,
             exists (select 1 from public.notification_reads k where k.user_id = auth.uid() and k.kind = 'n' and k.ref_id = n.id)
      from public.notifications n
      where n.business_id = p_business and n.created_at > now() - interval '90 days'
        and (n.user_id = auth.uid() or (n.user_id is null and public.can_manage(p_business)))
    ) u order by at desc limit 80
  ) x;
  return r;
end $$;

create or replace function public.unread_notifications(p_business uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from jsonb_array_elements(public.my_notifications(p_business)) e where not (e->>'read')::boolean
$$;

create or replace function public.mark_notifications_read(p_business uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.notification_reads (user_id, kind, ref_id)
  select auth.uid(), e->>'kind', (e->>'id')::uuid from jsonb_array_elements(public.my_notifications(p_business)) e
  where not (e->>'read')::boolean and auth.uid() is not null
  on conflict do nothing
$$;

-- ---------- Notificaciones automáticas ----------
-- Citas: solicitud en línea (a dueño/admin y a quien atiende) y cancelación hecha por el cliente
create or replace function public.notify_appointment() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_service text; v_when text; v_title text; v_staff_user uuid;
begin
  select name into v_service from public.products where id = new.product_id;
  v_when := to_char(new.starts_at at time zone 'America/Mexico_City', 'DD/MM "a las" HH12:MI am');
  if tg_op = 'INSERT' and new.source = 'online' then
    v_title := case when new.status = 'pending' then 'Nueva solicitud de cita' else 'Nueva cita confirmada' end;
  elsif tg_op = 'UPDATE' and new.status = 'cancelled' and old.status in ('pending','confirmed') and auth.uid() is null then
    v_title := 'El cliente canceló su cita';
  else
    return new;
  end if;
  insert into public.notifications (business_id, user_id, type, title, body, link)
  values (new.business_id, null, 'cita', v_title, new.customer_name || ' · ' || coalesce(v_service, 'Servicio') || ' · ' || v_when, '/app/citas/' || new.id);
  select m.user_id into v_staff_user from public.memberships m where m.id = new.membership_id and m.role = 'cashier' and m.active;
  if v_staff_user is not null then
    insert into public.notifications (business_id, user_id, type, title, body, link)
    values (new.business_id, v_staff_user, 'cita', v_title, new.customer_name || ' · ' || coalesce(v_service, 'Servicio') || ' · ' || v_when, '/app/citas/' || new.id);
  end if;
  return new;
end $$;
create trigger notify_appointment after insert or update of status on public.appointments for each row execute function public.notify_appointment();

-- Inventario: un producto con existencias controladas se agotó
create or replace function public.notify_sold_out() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.track_stock and new.deleted_at is null and new.stock <= 0 and old.stock > 0 then
    insert into public.notifications (business_id, type, title, body, link)
    values (new.business_id, 'stock', 'Se agotó ' || new.name, 'Ya aparece como agotado en tu página y en el punto de venta.', '/app/catalogo/' || new.id);
  end if;
  return new;
end $$;
create trigger notify_sold_out after update of stock on public.products for each row execute function public.notify_sold_out();

-- Plan por vencer o vencido: una vez cada 6 días como máximo (no aplica a paneles maestros)
create or replace function public.run_notifications() returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (business_id, type, title, body)
  select b.id, 'plan',
         case when b.plan_expires_at < current_date then 'Tu plan venció' else 'Tu plan vence pronto' end,
         case when b.plan_expires_at < current_date then 'Venció el ' || to_char(b.plan_expires_at, 'DD/MM/YYYY') || '. Contáctanos para renovarlo.'
              else 'Vence el ' || to_char(b.plan_expires_at, 'DD/MM/YYYY') || '. Contáctanos para renovarlo y no perder el servicio.' end
  from public.businesses b
  where not b.is_master and b.status <> 'suspendido' and b.plan_expires_at is not null and b.plan_expires_at <= current_date + 5
    and not exists (select 1 from public.notifications n where n.business_id = b.id and n.type = 'plan' and n.created_at > now() - interval '6 days');
end $$;

revoke execute on function public.my_notifications(uuid), public.unread_notifications(uuid), public.mark_notifications_read(uuid), public.run_notifications(),
  public.notify_appointment(), public.notify_sold_out() from public, anon;
grant execute on function public.my_notifications(uuid), public.unread_notifications(uuid), public.mark_notifications_read(uuid) to authenticated, service_role;
grant execute on function public.run_notifications() to service_role;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('run_notifications', '0 15 * * *', 'select public.run_notifications()');
  end if;
exception when others then raise notice 'pg_cron no disponible: %', sqlerrm;
end $$;

-- Aviso de bienvenida
insert into public.announcements (title, body, link_url)
values ('Nuevo centro de notificaciones', 'Aquí verás los avisos de la plataforma y las novedades de tu negocio: solicitudes de cita, productos agotados y el estado de tu plan.', null);
