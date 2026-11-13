-- Lógica transaccional (PLAN §5.2). Todos los totales se calculan aquí, nunca en el cliente.
set search_path = public, extensions;

-- ---------- Utilidades ----------
create or replace function public.next_folio(p_business uuid, p_kind text) returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into public.business_counters (business_id, kind, last_value) values (p_business, p_kind, 1)
  on conflict (business_id, kind) do update set last_value = public.business_counters.last_value + 1
  returning last_value into v;
  return v;
end $$;
revoke execute on function public.next_folio(uuid, text) from public, anon, authenticated;

-- IVA por línea (§6.1). p = importe capturado (precio × cantidad) redondeado a 2 decimales.
create or replace function public.calc_line(p_unit numeric, p_qty numeric, p_mode text, p_rate numeric,
  out base numeric, out iva numeric, out total numeric) language plpgsql immutable as $$
declare p numeric(12,2) := round(p_unit * p_qty, 2); r numeric := p_rate / 100;
begin
  if p_mode = 'plus' then base := p; iva := round(p * r, 2); total := base + iva;
  elsif p_mode = 'exempt' then base := p; iva := 0; total := p;
  else total := p; base := round(p / (1 + r), 2); iva := total - base;
  end if;
end $$;

create or replace function public.gen_code(p_len int) returns text language plpgsql volatile as $$
declare alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'; s text := ''; i int;
begin
  for i in 1..p_len loop s := s || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
  return s;
end $$;

create or replace function public.reserved_slugs() returns text[] language sql immutable as $$
  select array['app','super','q','login','api','admin','www','static','_next','assets','ayuda','soporte','terminos','privacidad','precios','planes','storage','invitacion','favicon.ico']
$$;

create or replace function public.slug_status(p_slug text) returns text language sql stable security definer set search_path = public as $$
  select case when p_slug !~ '^[a-z0-9]{2,40}$' then 'invalid'
              when p_slug = any (public.reserved_slugs()) then 'reserved'
              when exists (select 1 from public.businesses where slug = p_slug) then 'taken' else 'available' end
$$;

-- ---------- Alta de negocio (solo super admin) ----------
create or replace function public.create_business(p_name text, p_slug text, p_owner_email text, p_phone text, p_mode text, p_plan text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text; cats text[]; i int;
begin
  if not public.is_super_admin() then raise exception 'Solo el super admin puede dar de alta negocios'; end if;
  if public.slug_status(p_slug) <> 'available' then raise exception 'El slug "%" no está disponible', p_slug; end if;
  insert into public.businesses (name, slug, owner_email, phone, mode, plan, plan_expires_at, contact)
  values (p_name, p_slug, lower(p_owner_email), p_phone, p_mode, p_plan,
          case when p_plan = 'prueba' then current_date + 15 else current_date + 30 end,
          case when coalesce(p_phone, '') <> '' then jsonb_build_object('whatsapp', p_phone, 'phone', p_phone) else '{}'::jsonb end)
  returning id into v_id;
  insert into public.ticket_settings (business_id, header_name, qr_text, footer_text)
  values (v_id, p_name,
          case p_mode when 'food' then 'Escanee para ver nuestro menú' when 'retail' then 'Escanee para ver nuestro catálogo' else 'Escanee para ver nuestros servicios' end,
          case p_mode when 'retail' then 'Cambios dentro de 15 días con ticket.' when 'service' then 'Cancelaciones con 2 horas de anticipación.' else null end);
  insert into public.booking_settings (business_id, online_enabled) values (v_id, p_mode = 'service');
  insert into public.business_counters (business_id, kind) values (v_id, 'sale'), (v_id, 'quote');
  cats := case p_mode when 'food' then array['Desayunos','Comidas','Bebidas','Postres']
                      when 'retail' then array['Novedades','Ofertas']
                      else array['Cortes','Paquetes','Productos'] end;
  for i in 1..array_length(cats, 1) loop
    insert into public.categories (business_id, name, position) values (v_id, cats[i], i);
  end loop;
  loop
    v_code := public.gen_code(7);
    exit when not exists (select 1 from public.qr_codes where code = v_code);
  end loop;
  insert into public.qr_codes (business_id, code) values (v_id, v_code);
  return v_id;
end $$;

-- ---------- Catálogo público ----------
create or replace function public.public_catalog(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b public.businesses; r jsonb;
begin
  select * into b from public.businesses where slug = p_slug;
  if not found then return null; end if;
  if b.status = 'suspendido' then return jsonb_build_object('suspended', true, 'name', b.name); end if;
  select jsonb_build_object(
    'business', jsonb_build_object('id', b.id, 'slug', b.slug, 'name', b.name, 'mode', b.mode, 'features', b.features, 'tagline', b.tagline,
      'logo_path', b.logo_path, 'hero_path', b.hero_path, 'hero_focal_x', b.hero_focal_x, 'hero_focal_y', b.hero_focal_y,
      'accent_color', b.accent_color, 'address', b.address, 'maps_url', b.maps_url, 'lat', b.lat, 'lng', b.lng,
      'contact', b.contact, 'schedule', b.schedule, 'tax_mode_global', b.tax_mode_global, 'tax_rate', b.tax_rate,
      'booking_enabled', coalesce((select online_enabled from public.booking_settings where business_id = b.id), false)
                         and (b.mode = 'service' or coalesce((b.features->>'booking')::boolean, false))),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.position, c.name)
                            from public.categories c where c.business_id = b.id and c.visible), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(public.product_json(p.id, true) order by p.featured desc, p.position, p.name)
                          from public.products p left join public.categories c on c.id = p.category_id
                          where p.business_id = b.id and p.show_in_catalog and p.active and p.deleted_at is null
                            and (c.id is null or c.visible)), '[]'::jsonb)
  ) into r;
  return r;
end $$;

-- Producto como JSON con precio final al público (con IVA), fotos y opciones.
create or replace function public.product_json(p_id uuid, p_public boolean) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'category_id', p.category_id, 'name', p.name, 'description', p.description, 'emoji', p.emoji, 'kind', p.kind,
    'sale_unit', p.sale_unit, 'price', p.price, 'sale_price', p.sale_price, 'price_from', p.price_from, 'duration_min', p.duration_min,
    'tax_mode', case when p.tax_mode = 'global' then b.tax_mode_global else p.tax_mode end,
    'track_stock', p.track_stock, 'stock', p.stock, 'featured', p.featured, 'custom_fields', p.custom_fields,
    'show_in_catalog', p.show_in_catalog, 'active', p.active,
    'images', coalesce((select jsonb_agg(i.path order by i.position) from public.product_images i where i.product_id = p.id), '[]'::jsonb),
    'groups', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'type', g.type,
        'options', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'price_delta', o.price_delta,
                    'track_stock', o.track_stock, 'stock', o.stock) order by o.position, o.label)
                    from public.product_options o where o.group_id = g.id), '[]'::jsonb)) order by g.position, g.name)
      from public.product_option_groups g where g.product_id = p.id), '[]'::jsonb),
    'sold_out', p.track_stock and (
      case when exists (select 1 from public.product_options o join public.product_option_groups g on g.id = o.group_id where g.product_id = p.id and o.track_stock)
           then not exists (select 1 from public.product_options o join public.product_option_groups g on g.id = o.group_id where g.product_id = p.id and o.track_stock and o.stock > 0)
           else p.stock <= 0 end)
  )
  from public.products p join public.businesses b on b.id = p.business_id where p.id = p_id
$$;
revoke execute on function public.product_json(uuid, boolean) from public, anon;

-- ---------- QR dinámico ----------
create or replace function public.resolve_qr(p_code text, p_user_agent text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q public.qr_codes; b public.businesses;
begin
  select * into q from public.qr_codes where code = p_code and active and deleted_at is null;
  if not found then return null; end if;
  select * into b from public.businesses where id = q.business_id;
  update public.qr_codes set scans_count = scans_count + 1 where id = q.id;
  insert into public.qr_scans (business_id, qr_id, user_agent) values (q.business_id, q.id, left(p_user_agent, 300));
  return jsonb_build_object('type', q.destination_type, 'url', q.destination_url, 'slug', b.slug,
                            'whatsapp', coalesce(b.contact->>'whatsapp', b.phone));
end $$;

create or replace function public.set_qr_destination(p_qr uuid, p_type text, p_url text) returns void
language plpgsql security definer set search_path = public as $$
declare q public.qr_codes;
begin
  select * into q from public.qr_codes where id = p_qr;
  if not found or not public.can_manage(q.business_id) then raise exception 'Sin permiso'; end if;
  if p_type = 'custom' and coalesce(p_url, '') !~ '^https://' then raise exception 'La URL debe empezar con https://'; end if;
  update public.qr_codes set destination_type = p_type, destination_url = case when p_type = 'custom' then p_url else null end where id = p_qr;
end $$;

create or replace function public.regenerate_qr(p_qr uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare q public.qr_codes; v_new uuid; v_code text;
begin
  if not public.is_super_admin() then raise exception 'Solo el super admin puede regenerar un QR'; end if;
  select * into q from public.qr_codes where id = p_qr;
  if not found then raise exception 'QR no encontrado'; end if;
  loop v_code := public.gen_code(7); exit when not exists (select 1 from public.qr_codes where code = v_code); end loop;
  insert into public.qr_codes (business_id, code, destination_type, destination_url)
  values (q.business_id, v_code, q.destination_type, q.destination_url) returning id into v_new;
  update public.qr_codes set active = false, replaced_by = v_new where id = p_qr;
  return v_new;
end $$;

create or replace function public.delete_qr(p_qr uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then raise exception 'Solo el super admin puede borrar un QR'; end if;
  update public.qr_codes set active = false, deleted_at = now() where id = p_qr;
end $$;

-- ---------- Caja ----------
create or replace function public.open_cash_session(p_business uuid, p_opening numeric, p_device text default 'Caja 1') returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if public.member_role(p_business) is null then raise exception 'Sin permiso'; end if;
  if p_opening < 0 then raise exception 'Fondo inválido'; end if;
  select id into v from public.cash_sessions where business_id = p_business and closed_at is null;
  if found then return v; end if;
  insert into public.cash_sessions (business_id, device_label, opened_by, opening_float)
  values (p_business, p_device, auth.uid(), p_opening) returning id into v;
  return v;
end $$;

create or replace function public.add_cash_movement(p_session uuid, p_type text, p_amount numeric, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare s public.cash_sessions;
begin
  select * into s from public.cash_sessions where id = p_session and closed_at is null;
  if not found or not public.can_manage(s.business_id) then raise exception 'Sin permiso o caja cerrada'; end if;
  insert into public.cash_movements (business_id, cash_session_id, type, amount, reason, created_by)
  values (s.business_id, s.id, p_type, p_amount, p_reason, auth.uid());
end $$;

-- Resumen del turno. Esperado = fondo + efectivo de ventas + abonos en efectivo + entradas − retiros (§8.9).
create or replace function public.cash_session_summary(p_session uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s public.cash_sessions; r jsonb;
begin
  select * into s from public.cash_sessions where id = p_session;
  if not found or not (public.is_member(s.business_id) or public.is_super_admin()) then raise exception 'Sin permiso'; end if;
  select jsonb_build_object(
    'opening', s.opening_float,
    'sales_cash', coalesce(sum(amount) filter (where method = 'cash' and is_initial), 0),
    'sales_card', coalesce(sum(amount) filter (where method = 'card' and is_initial), 0),
    'sales_transfer', coalesce(sum(amount) filter (where method = 'transfer' and is_initial), 0),
    'sales_total', coalesce(sum(amount) filter (where is_initial), 0),
    'sales_count', count(distinct sale_id) filter (where is_initial),
    'abonos_cash', coalesce(sum(amount) filter (where method = 'cash' and not is_initial), 0),
    'abonos_other', coalesce(sum(amount) filter (where method <> 'cash' and not is_initial), 0),
    'cash_payments', coalesce(sum(amount) filter (where method = 'cash'), 0)
  ) into r from public.payments where cash_session_id = s.id;
  r := r || (select jsonb_build_object(
    'cash_in', coalesce(sum(amount) filter (where type = 'in'), 0),
    'cash_out', coalesce(sum(amount) filter (where type = 'out'), 0)) from public.cash_movements where cash_session_id = s.id);
  r := r || jsonb_build_object('expected',
    s.opening_float + (r->>'cash_payments')::numeric + (r->>'cash_in')::numeric - (r->>'cash_out')::numeric);
  return r;
end $$;

create or replace function public.close_cash_session(p_session uuid, p_counted numeric, p_notes text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.cash_sessions; v_expected numeric(12,2);
begin
  select * into s from public.cash_sessions where id = p_session and closed_at is null for update;
  if not found then raise exception 'La caja ya está cerrada'; end if;
  if not public.can_manage(s.business_id) or public.is_super_admin() and public.member_role(s.business_id) is null then
    raise exception 'Solo el dueño o administrador puede cerrar la caja';
  end if;
  v_expected := (public.cash_session_summary(p_session)->>'expected')::numeric;
  update public.cash_sessions set closed_by = auth.uid(), closed_at = now(), expected_cash = v_expected,
    counted_cash = p_counted, difference = p_counted - v_expected, notes = p_notes where id = p_session;
  return jsonb_build_object('expected', v_expected, 'counted', p_counted, 'difference', p_counted - v_expected);
end $$;

-- ---------- Punto de venta ----------
create or replace function public.register_pos_sale(
  p_business uuid, p_items jsonb, p_payments jsonb, p_cash_received numeric default null,
  p_customer_name text default null, p_order_type text default 'mostrador', p_table_label text default null,
  p_appointment uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b public.businesses; pr public.products; op record; it jsonb; pay jsonb;
  v_session uuid; v_sale uuid; v_folio int; v_qty numeric(12,3); v_unit numeric(12,2); v_title text; v_mode text;
  v_opts jsonb; v_stock_opt uuid; v_first_opt uuid; l record;
  v_sub numeric(12,2) := 0; v_tax numeric(12,2) := 0; v_total numeric(12,2) := 0;
  v_paid numeric(12,2) := 0; v_cash numeric(12,2) := 0; v_change numeric(12,2) := 0;
begin
  if public.member_role(p_business) is null then raise exception 'Sin permiso para cobrar en este negocio'; end if;
  select * into b from public.businesses where id = p_business;
  select id into v_session from public.cash_sessions where business_id = p_business and closed_at is null;
  if v_session is null then raise exception 'Abre la caja antes de cobrar'; end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'La venta no tiene productos'; end if;

  v_folio := public.next_folio(p_business, 'sale');
  insert into public.sales (business_id, folio, source, customer_name, order_type, table_label, status, cash_session_id, created_by)
  values (p_business, v_folio, 'pos', nullif(p_customer_name, ''), coalesce(p_order_type, 'mostrador'), nullif(p_table_label, ''), 'pending', v_session, auth.uid())
  returning id into v_sale;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'qty')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Cantidad inválida'; end if;
    v_opts := '[]'::jsonb; v_stock_opt := null; v_first_opt := null;
    if coalesce(it->>'product_id', '') <> '' then
      select * into pr from public.products where id = (it->>'product_id')::uuid and business_id = p_business and active and deleted_at is null;
      if not found then raise exception 'Producto no disponible'; end if;
      v_unit := coalesce(pr.sale_price, pr.price); v_title := pr.name;
      for op in
        select o.*, g.name as gname from public.product_options o join public.product_option_groups g on g.id = o.group_id
        where g.product_id = pr.id and o.id in (select x::uuid from jsonb_array_elements_text(coalesce(it->'option_ids', '[]'::jsonb)) x)
        order by g.position, o.position
      loop
        v_unit := v_unit + op.price_delta;
        v_opts := v_opts || jsonb_build_object('group', op.gname, 'label', op.label, 'price_delta', op.price_delta);
        if v_first_opt is null then v_first_opt := op.id; end if;
        if op.track_stock and pr.track_stock then
          if op.stock < v_qty then raise exception 'Sin existencias suficientes de % (%)', pr.name, op.label; end if;
          v_stock_opt := op.id;
        end if;
      end loop;
      if pr.track_stock and v_stock_opt is null then
        if exists (select 1 from public.product_options o join public.product_option_groups g on g.id = o.group_id where g.product_id = pr.id and o.track_stock) then
          raise exception 'Elige una variante de %', pr.name;
        end if;
        if pr.stock < v_qty then raise exception 'Sin existencias suficientes de %', pr.name; end if;
      end if;
      v_mode := case when pr.tax_mode = 'global' then b.tax_mode_global else pr.tax_mode end;
      select * into l from public.calc_line(v_unit, v_qty, v_mode, b.tax_rate);
      insert into public.sale_items (business_id, sale_id, product_id, option_id, title, unit_price, qty, sale_unit, options, notes, tax_mode, line_subtotal, line_tax, line_total)
      values (p_business, v_sale, pr.id, v_first_opt, v_title, v_unit, v_qty, pr.sale_unit, v_opts, nullif(it->>'notes', ''), v_mode, l.base, l.iva, l.total);
      if pr.track_stock then
        insert into public.inventory_movements (business_id, product_id, option_id, qty, reason, ref_table, ref_id, created_by)
        values (p_business, pr.id, v_stock_opt, -v_qty, 'sale', 'sales', v_sale, auth.uid());
      end if;
    else
      v_unit := (it->>'unit_price')::numeric; v_title := coalesce(nullif(it->>'title', ''), 'Monto libre');
      if v_unit is null or v_unit <= 0 then raise exception 'Monto inválido'; end if;
      v_mode := b.tax_mode_global;
      select * into l from public.calc_line(v_unit, v_qty, v_mode, b.tax_rate);
      insert into public.sale_items (business_id, sale_id, title, unit_price, qty, sale_unit, tax_mode, line_subtotal, line_tax, line_total)
      values (p_business, v_sale, v_title, v_unit, v_qty, 'pieza', v_mode, l.base, l.iva, l.total);
    end if;
    v_sub := v_sub + l.base; v_tax := v_tax + l.iva; v_total := v_total + l.total;
  end loop;

  update public.sales set subtotal = v_sub, tax = v_tax, total = v_total where id = v_sale;

  for pay in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    if (pay->>'amount')::numeric > 0 then
      insert into public.payments (business_id, sale_id, amount, method, cash_session_id, received_by, is_initial)
      values (p_business, v_sale, (pay->>'amount')::numeric, pay->>'method', v_session, auth.uid(), true);
      v_paid := v_paid + (pay->>'amount')::numeric;
      if pay->>'method' = 'cash' then v_cash := v_cash + (pay->>'amount')::numeric; end if;
    end if;
  end loop;
  if v_paid <> v_total then raise exception 'Los pagos (%) no cuadran con el total (%)', v_paid, v_total; end if;
  if v_cash > 0 then
    if coalesce(p_cash_received, v_cash) < v_cash then raise exception 'El efectivo recibido no alcanza'; end if;
    v_change := coalesce(p_cash_received, v_cash) - v_cash;
    update public.sales set cash_received = coalesce(p_cash_received, v_cash), change_given = v_change where id = v_sale;
  end if;

  if p_appointment is not null then
    update public.appointments set sale_id = v_sale, status = 'completed' where id = p_appointment and business_id = p_business and status in ('confirmed','completed');
    insert into public.appointment_events (business_id, appointment_id, type, created_by) values (p_business, p_appointment, 'cobrada', auth.uid());
  end if;

  return jsonb_build_object('sale_id', v_sale, 'folio', v_folio, 'subtotal', v_sub, 'tax', v_tax, 'total', v_total, 'change', v_change);
end $$;

-- ---------- Cotizaciones ----------
create or replace function public.save_quote(p_business uuid, p_quote uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare b public.businesses; v_id uuid := p_quote; it jsonb; l record; v_mode text; i int := 0;
  v_sub numeric(12,2) := 0; v_tax numeric(12,2) := 0; v_total numeric(12,2) := 0; v_days int; v_status text;
begin
  if not public.can_manage(p_business) then raise exception 'Sin permiso'; end if;
  select * into b from public.businesses where id = p_business;
  v_days := greatest(1, coalesce((p->>'valid_days')::int, 15));
  v_status := coalesce(nullif(p->>'status', ''), 'pending');
  if v_status not in ('draft','pending','accepted','rejected','cancelled') then raise exception 'Estatus inválido'; end if;
  v_mode := case when coalesce((p->>'prices_plus_tax')::boolean, false) then 'plus' else 'included' end;
  if v_id is null then
    insert into public.quotes (business_id, folio, created_by) values (p_business, public.next_folio(p_business, 'quote'), auth.uid()) returning id into v_id;
  else
    perform 1 from public.quotes where id = v_id and business_id = p_business and status <> 'converted' and deleted_at is null;
    if not found then raise exception 'La cotización no se puede editar'; end if;
    delete from public.quote_items where quote_id = v_id;
  end if;
  for it in select * from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) loop
    select * into l from public.calc_line((it->>'unit_price')::numeric, (it->>'qty')::numeric, v_mode, b.tax_rate);
    insert into public.quote_items (business_id, quote_id, product_id, title, description, unit_price, qty, sale_unit, tax_mode, position, line_subtotal, line_tax, line_total)
    values (p_business, v_id, nullif(it->>'product_id', '')::uuid, it->>'title', nullif(it->>'description', ''), (it->>'unit_price')::numeric,
            (it->>'qty')::numeric, coalesce(nullif(it->>'sale_unit', ''), 'pieza'), v_mode, i, l.base, l.iva, l.total);
    i := i + 1; v_sub := v_sub + l.base; v_tax := v_tax + l.iva; v_total := v_total + l.total;
  end loop;
  update public.quotes set client_name = nullif(p->>'client_name', ''), client_phone = nullif(p->>'client_phone', ''), client_email = nullif(p->>'client_email', ''),
    status = v_status, valid_days = v_days, expires_at = issued_at + v_days, prices_plus_tax = (v_mode = 'plus'),
    custom_fields = coalesce(p->'custom_fields', '[]'::jsonb), notes = nullif(p->>'notes', ''),
    subtotal = v_sub, tax = v_tax, total = v_total where id = v_id;
  return v_id;
end $$;

create or replace function public.convert_quote_to_sale(p_quote uuid, p_initial_payment jsonb default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q public.quotes; v_sale uuid; v_folio int; qi record; pr public.products; v_session uuid; v_amount numeric(12,2);
begin
  select * into q from public.quotes where id = p_quote for update;
  if not found or not public.can_manage(q.business_id) then raise exception 'Sin permiso'; end if;
  if q.deleted_at is not null or q.status in ('converted','cancelled','rejected') then raise exception 'Esta cotización no se puede convertir'; end if;
  select id into v_session from public.cash_sessions where business_id = q.business_id and closed_at is null;
  v_folio := public.next_folio(q.business_id, 'sale');
  insert into public.sales (business_id, folio, source, quote_id, customer_name, status, subtotal, tax, total, cash_session_id, created_by)
  values (q.business_id, v_folio, 'quote', q.id, q.client_name, 'pending', q.subtotal, q.tax, q.total, v_session, auth.uid())
  returning id into v_sale;
  for qi in select * from public.quote_items where quote_id = q.id order by position loop
    insert into public.sale_items (business_id, sale_id, product_id, title, unit_price, qty, sale_unit, notes, tax_mode, line_subtotal, line_tax, line_total)
    values (q.business_id, v_sale, qi.product_id, qi.title, qi.unit_price, qi.qty, qi.sale_unit, qi.description, qi.tax_mode, qi.line_subtotal, qi.line_tax, qi.line_total);
    if qi.product_id is not null then
      select * into pr from public.products where id = qi.product_id;
      if found and pr.track_stock then     -- §11.5: el stock se descuenta al convertir
        insert into public.inventory_movements (business_id, product_id, qty, reason, ref_table, ref_id, created_by)
        values (q.business_id, pr.id, -qi.qty, 'quote_sale', 'sales', v_sale, auth.uid());
      end if;
    end if;
  end loop;
  update public.quotes set status = 'converted', converted_sale_id = v_sale where id = q.id;
  v_amount := coalesce((p_initial_payment->>'amount')::numeric, 0);
  if v_amount > 0 then
    if v_amount > q.total then raise exception 'El anticipo no puede ser mayor al total'; end if;
    insert into public.payments (business_id, sale_id, amount, method, note, cash_session_id, received_by)
    values (q.business_id, v_sale, v_amount, coalesce(p_initial_payment->>'method', 'cash'), coalesce(nullif(p_initial_payment->>'note', ''), 'Anticipo'), v_session, auth.uid());
  end if;
  return jsonb_build_object('sale_id', v_sale, 'folio', v_folio);
end $$;

create or replace function public.add_payment(p_sale uuid, p_amount numeric, p_method text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.sales; v_session uuid;
begin
  select * into s from public.sales where id = p_sale for update;
  if not found or not public.can_manage(s.business_id) then raise exception 'Sin permiso'; end if;
  if s.status = 'cancelled' then raise exception 'La venta está cancelada'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Monto inválido'; end if;
  if p_amount > s.balance then raise exception 'No puedes cobrar más del saldo ($%)', s.balance; end if;
  select id into v_session from public.cash_sessions where business_id = s.business_id and closed_at is null;
  insert into public.payments (business_id, sale_id, amount, method, note, cash_session_id, received_by)
  values (s.business_id, s.id, p_amount, p_method, nullif(p_note, ''), v_session, auth.uid());
  select * into s from public.sales where id = p_sale;
  return jsonb_build_object('balance', s.balance, 'status', s.status);
end $$;

create or replace function public.cancel_sale(p_sale uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s public.sales;
begin
  select * into s from public.sales where id = p_sale for update;
  if not found or not public.can_delete(s.business_id) then raise exception 'Solo el dueño puede cancelar una venta'; end if;
  if s.status = 'cancelled' then return; end if;
  insert into public.inventory_movements (business_id, product_id, option_id, qty, reason, ref_table, ref_id, created_by)
  select m.business_id, m.product_id, m.option_id, -m.qty, 'cancel', 'sales', s.id, auth.uid()
  from public.inventory_movements m where m.ref_table = 'sales' and m.ref_id = s.id and m.reason in ('sale','quote_sale');
  update public.sales set status = 'cancelled' where id = s.id;
end $$;

create or replace function public.adjust_stock(p_product uuid, p_option uuid, p_new_stock numeric) returns void
language plpgsql security definer set search_path = public as $$
declare pr public.products; v_cur numeric(12,3);
begin
  select * into pr from public.products where id = p_product;
  if not found or not public.can_manage(pr.business_id) then raise exception 'Sin permiso'; end if;
  if p_option is not null then select stock into v_cur from public.product_options where id = p_option; else v_cur := pr.stock; end if;
  if p_new_stock is distinct from v_cur then
    insert into public.inventory_movements (business_id, product_id, option_id, qty, reason, created_by)
    values (pr.business_id, pr.id, p_option, p_new_stock - v_cur, 'adjust', auth.uid());
  end if;
end $$;

-- ---------- PIN (modo caja) ----------
create or replace function public.set_pin(p_membership uuid, p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare m public.memberships;
begin
  select * into m from public.memberships where id = p_membership;
  if not found or not (public.can_delete(m.business_id) or m.user_id = auth.uid()) then raise exception 'Sin permiso'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'El PIN debe tener 4 dígitos'; end if;
  update public.memberships set pin_hash = crypt(p_pin, gen_salt('bf')), pin_attempts = 0, pin_locked_until = null where id = p_membership;
end $$;

-- La llama el servidor (service role) al cambiar de usuario en una caja compartida.
create or replace function public.verify_pin(p_business uuid, p_membership uuid, p_pin text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare m public.memberships;
begin
  select * into m from public.memberships where id = p_membership and business_id = p_business and active for update;
  if not found or m.pin_hash is null then return null; end if;
  if m.pin_locked_until is not null and m.pin_locked_until > now() then raise exception 'PIN bloqueado. Intenta en unos minutos.'; end if;
  if m.pin_hash = crypt(p_pin, m.pin_hash) then
    update public.memberships set pin_attempts = 0, pin_locked_until = null where id = m.id;
    return m.user_id;
  end if;
  update public.memberships set pin_attempts = pin_attempts + 1,
    pin_locked_until = case when pin_attempts + 1 >= 5 then now() + interval '5 minutes' else null end where id = m.id;
  return null;
end $$;
revoke execute on function public.verify_pin(uuid, uuid, text) from public, anon, authenticated;
