-- Agenda de citas (PLAN §8.11). Zona horaria del negocio: America/Mexico_City.
set search_path = public, extensions;

-- Rejilla de horarios de un día. free = disponible. p_panel = true ignora anticipación mínima y días máximos.
create or replace function public.slot_grid(p_business uuid, p_product uuid, p_membership uuid, p_date date, p_panel boolean default false, p_ignore uuid default null)
returns table (starts_at timestamptz, membership_id uuid, free boolean)
language plpgsql stable security definer set search_path = public as $$
declare bs public.booking_settings; v_dur int; tz text := 'America/Mexico_City';
begin
  select * into bs from public.booking_settings where business_id = p_business;
  if not found then return; end if;
  select coalesce(duration_min, 30) into v_dur from public.products where id = p_product and business_id = p_business;
  if v_dur is null then v_dur := 30; end if;
  return query
  with staff as (
    select m.id as mid, s.start_time, s.end_time, s.break_start, s.break_end
    from public.memberships m join public.staff_schedules s on s.membership_id = m.id
    where m.business_id = p_business and m.active and s.enabled and s.weekday = extract(dow from p_date)::int
      and (p_membership is null or m.id = p_membership)
  ), grid as (
    select st.mid, st.break_start, st.break_end,
           (t.t at time zone tz) as s
    from staff st, lateral generate_series(
      (p_date + st.start_time)::timestamp, (p_date + st.end_time)::timestamp - make_interval(mins => v_dur),
      make_interval(mins => bs.slot_interval_min)) as t(t)
  )
  select g.s, g.mid,
    not (
      (g.break_start is not null and g.break_end is not null and
        tstzrange(g.s, g.s + make_interval(mins => v_dur)) && tstzrange((p_date + g.break_start)::timestamp at time zone tz, (p_date + g.break_end)::timestamp at time zone tz))
      or exists (select 1 from public.schedule_blocks k where k.business_id = p_business and (k.membership_id is null or k.membership_id = g.mid)
                 and tstzrange(k.starts_at, k.ends_at) && tstzrange(g.s, g.s + make_interval(mins => v_dur)))
      or exists (select 1 from public.appointments a where a.membership_id = g.mid and a.status in ('pending','confirmed')
                 and (p_ignore is null or a.id <> p_ignore)
                 and tstzrange(a.starts_at - make_interval(mins => bs.buffer_min), a.ends_at + make_interval(mins => bs.buffer_min)) && tstzrange(g.s, g.s + make_interval(mins => v_dur)))
      or (not p_panel and (g.s < now() + make_interval(mins => bs.min_notice_min)
                           or p_date > (now() at time zone tz)::date + bs.max_days_ahead))
      or (p_panel and g.s < now() - interval '1 day')
    )
  from grid g order by g.s, g.mid;
end $$;
revoke execute on function public.slot_grid(uuid, uuid, uuid, date, boolean, uuid) from public, anon;

-- Pública: solo horarios libres. Con "cualquiera" (p_membership null) une los de todas las personas.
create or replace function public.available_slots(p_business uuid, p_product uuid, p_membership uuid, p_date date)
returns table (starts_at timestamptz) language sql stable security definer set search_path = public as $$
  select distinct g.starts_at from public.slot_grid(p_business, p_product, p_membership, p_date, false) g
  where g.free and exists (select 1 from public.booking_settings bs where bs.business_id = p_business and bs.online_enabled)
  order by 1
$$;

create or replace function public.public_booking_info(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'business_id', b.id,
    'settings', (select jsonb_build_object('online_enabled', bs.online_enabled, 'requires_approval', bs.requires_approval,
                   'max_days_ahead', bs.max_days_ahead, 'cancel_until_min', bs.cancel_until_min) from public.booking_settings bs where bs.business_id = b.id),
    'staff', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.display_name) order by m.display_name)
              from public.memberships m where m.business_id = b.id and m.active
                and exists (select 1 from public.staff_schedules s where s.membership_id = m.id and s.enabled)), '[]'::jsonb),
    'services', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'emoji', p.emoji, 'duration_min', coalesce(p.duration_min, 30),
                'price', coalesce(p.sale_price, p.price), 'price_from', p.price_from) order by p.position, p.name)
              from public.products p where p.business_id = b.id and p.kind = 'service' and p.show_in_catalog and p.active and p.deleted_at is null), '[]'::jsonb))
  from public.businesses b where b.slug = p_slug and b.status <> 'suspendido'
$$;

create or replace function public.request_appointment(p_slug text, p_product uuid, p_membership uuid, p_starts_at timestamptz, p_name text, p_phone text, p_notes text default null)
returns text language plpgsql security definer set search_path = public as $$
declare b public.businesses; bs public.booking_settings; pr public.products; v_mid uuid; v_token text; v_id uuid; v_status text;
  v_date date := (p_starts_at at time zone 'America/Mexico_City')::date;
begin
  select * into b from public.businesses where slug = p_slug and status <> 'suspendido';
  if not found then raise exception 'Negocio no disponible'; end if;
  select * into bs from public.booking_settings where business_id = b.id;
  if not found or not bs.online_enabled then raise exception 'Las citas en línea están desactivadas'; end if;
  select * into pr from public.products where id = p_product and business_id = b.id and kind = 'service' and active and show_in_catalog and deleted_at is null;
  if not found then raise exception 'Servicio no disponible'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) < 10 then
    raise exception 'Escribe tu nombre y un WhatsApp de 10 dígitos';
  end if;
  -- Antispam: máximo 3 solicitudes activas por teléfono
  if (select count(*) from public.appointments where business_id = b.id and customer_phone = p_phone and status = 'pending') >= 3 then
    raise exception 'Ya tienes varias solicitudes en espera. Espera la respuesta del negocio.';
  end if;
  -- Revalida disponibilidad dentro de la transacción y asigna persona si eligió "cualquiera"
  select g.membership_id into v_mid from public.slot_grid(b.id, pr.id, p_membership, v_date, false) g
  where g.free and g.starts_at = p_starts_at order by random() limit 1;
  if v_mid is null then raise exception 'Ese horario ya no está disponible. Elige otro.'; end if;
  v_token := public.gen_code(20);
  v_status := case when bs.requires_approval then 'pending' else 'confirmed' end;
  begin
    insert into public.appointments (business_id, product_id, membership_id, customer_name, customer_phone, notes, starts_at, ends_at, price, status, source, public_token, hold_expires_at)
    values (b.id, pr.id, v_mid, trim(p_name), p_phone, nullif(p_notes, ''), p_starts_at, p_starts_at + make_interval(mins => coalesce(pr.duration_min, 30)),
            coalesce(pr.sale_price, pr.price), v_status, 'online', v_token,
            case when bs.requires_approval then now() + make_interval(mins => bs.approval_timeout_min) end)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'Ese horario ya no está disponible. Elige otro.';
  end;
  insert into public.appointment_events (business_id, appointment_id, type) values (b.id, v_id, 'solicitada');
  return v_token;
end $$;

create or replace function public.public_appointment(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', a.id, 'status', a.status, 'starts_at', a.starts_at, 'ends_at', a.ends_at, 'price', a.price,
    'customer_name', a.customer_name, 'service', p.name, 'duration_min', p.duration_min, 'staff', m.display_name, 'reject_reason', a.reject_reason,
    'can_cancel', a.status in ('pending','confirmed') and now() < a.starts_at - make_interval(mins => bs.cancel_until_min),
    'cancel_until_min', bs.cancel_until_min)
  from public.appointments a join public.memberships m on m.id = a.membership_id
  left join public.products p on p.id = a.product_id join public.booking_settings bs on bs.business_id = a.business_id
  where a.public_token = p_token
$$;

create or replace function public.cancel_appointment_public(p_token text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.appointments; bs public.booking_settings;
begin
  select * into a from public.appointments where public_token = p_token for update;
  if not found then raise exception 'Cita no encontrada'; end if;
  select * into bs from public.booking_settings where business_id = a.business_id;
  if a.status not in ('pending','confirmed') or now() >= a.starts_at - make_interval(mins => bs.cancel_until_min) then
    raise exception 'Esta cita ya no se puede cancelar en línea';
  end if;
  update public.appointments set status = 'cancelled' where id = a.id;
  insert into public.appointment_events (business_id, appointment_id, type) values (a.business_id, a.id, 'cancelada por el cliente');
end $$;

create or replace function public.can_decide_appointment(a public.appointments) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_manage(a.business_id) or (
    a.membership_id = public.my_membership(a.business_id)
    and (select approvers from public.booking_settings where business_id = a.business_id) = 'owner_admin_assignee')
$$;

create or replace function public.decide_appointment(p_id uuid, p_decision text, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a public.appointments;
begin
  select * into a from public.appointments where id = p_id for update;
  if not found or not public.can_decide_appointment(a) then raise exception 'Sin permiso para decidir esta cita'; end if;
  if a.status <> 'pending' then raise exception 'La cita ya no está en espera'; end if;
  if p_decision = 'accept' then
    update public.appointments set status = 'confirmed', decided_by = auth.uid(), decided_at = now(), hold_expires_at = null where id = p_id;
    insert into public.appointment_events (business_id, appointment_id, type, created_by) values (a.business_id, a.id, 'aceptada', auth.uid());
  elsif p_decision = 'reject' then
    update public.appointments set status = 'rejected', decided_by = auth.uid(), decided_at = now(), reject_reason = nullif(p_reason, '') where id = p_id;
    insert into public.appointment_events (business_id, appointment_id, type, created_by) values (a.business_id, a.id, 'rechazada', auth.uid());
  else raise exception 'Decisión inválida';
  end if;
end $$;

-- Nueva cita desde el panel: queda confirmada directamente.
create or replace function public.panel_create_appointment(p_business uuid, p_product uuid, p_membership uuid, p_starts_at timestamptz, p_name text, p_phone text, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare pr public.products; v_id uuid;
begin
  if not public.can_manage(p_business) then raise exception 'Sin permiso'; end if;
  select * into pr from public.products where id = p_product and business_id = p_business;
  if not found then raise exception 'Servicio no encontrado'; end if;
  perform 1 from public.memberships where id = p_membership and business_id = p_business and active;
  if not found then raise exception 'Persona no encontrada'; end if;
  begin
    insert into public.appointments (business_id, product_id, membership_id, customer_name, customer_phone, notes, starts_at, ends_at, price, status, source, public_token, decided_by, decided_at)
    values (p_business, pr.id, p_membership, trim(p_name), nullif(p_phone, ''), nullif(p_notes, ''), p_starts_at,
            p_starts_at + make_interval(mins => coalesce(pr.duration_min, 30)), coalesce(pr.sale_price, pr.price), 'confirmed', 'panel', public.gen_code(20), auth.uid(), now())
    returning id into v_id;
  exception when exclusion_violation then raise exception 'Ese horario ya está ocupado';
  end;
  insert into public.appointment_events (business_id, appointment_id, type, created_by) values (p_business, v_id, 'creada en el panel', auth.uid());
  return v_id;
end $$;

create or replace function public.set_appointment_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.appointments;
begin
  select * into a from public.appointments where id = p_id for update;
  if not found or not (public.can_manage(a.business_id) or a.membership_id = public.my_membership(a.business_id)) then raise exception 'Sin permiso'; end if;
  if p_status not in ('completed','no_show','cancelled') or a.status <> 'confirmed' then raise exception 'Cambio de estatus inválido'; end if;
  update public.appointments set status = p_status where id = p_id;
  insert into public.appointment_events (business_id, appointment_id, type, created_by)
  values (a.business_id, a.id, case p_status when 'completed' then 'completada' when 'no_show' then 'no asistió' else 'cancelada' end, auth.uid());
end $$;

create or replace function public.reschedule_appointment(p_id uuid, p_starts_at timestamptz, p_membership uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a public.appointments;
begin
  select * into a from public.appointments where id = p_id for update;
  if not found or not public.can_manage(a.business_id) then raise exception 'Sin permiso'; end if;
  if a.status not in ('pending','confirmed') then raise exception 'Esta cita ya no se puede reagendar'; end if;
  begin
    update public.appointments set starts_at = p_starts_at, ends_at = p_starts_at + (a.ends_at - a.starts_at),
      membership_id = coalesce(p_membership, a.membership_id), status = 'confirmed', hold_expires_at = null where id = p_id;
  exception when exclusion_violation then raise exception 'Ese horario ya está ocupado';
  end;
  insert into public.appointment_events (business_id, appointment_id, type, created_by) values (a.business_id, a.id, 'reagendada', auth.uid());
end $$;

-- Mantenimiento periódico (equivale a los pg_cron del plan): vencer citas, vencer cotizaciones, purgar papelera, planes.
create or replace function public.run_maintenance() returns void
language plpgsql security definer set search_path = public as $$
begin
  with x as (update public.appointments set status = 'expired' where status = 'pending' and hold_expires_at < now() returning id, business_id)
  insert into public.appointment_events (business_id, appointment_id, type) select business_id, id, 'venció sin respuesta' from x;
  update public.quotes set status = 'expired' where status in ('draft','pending') and expires_at < (now() at time zone 'America/Mexico_City')::date;
  delete from public.quotes where deleted_at < now() - interval '30 days';
  update public.businesses set status = 'por_vencer' where status = 'activo' and plan_expires_at is not null and plan_expires_at <= current_date + 5;
end $$;
revoke execute on function public.run_maintenance() from public, anon, authenticated;

-- En Supabase (nube) se programa con pg_cron; en local lo dispara el servidor Next.js cada 5 min.
do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('run_maintenance', '*/5 * * * *', 'select public.run_maintenance()');
  end if;
exception when others then raise notice 'pg_cron no disponible: %', sqlerrm;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
grant execute on function public.public_catalog(text), public.resolve_qr(text, text), public.available_slots(uuid, uuid, uuid, date),
  public.public_booking_info(text), public.request_appointment(text, uuid, uuid, timestamptz, text, text, text),
  public.public_appointment(text), public.cancel_appointment_public(text), public.slug_status(text) to anon;
revoke execute on function public.next_folio(uuid, text), public.verify_pin(uuid, uuid, text), public.run_maintenance() from authenticated;
