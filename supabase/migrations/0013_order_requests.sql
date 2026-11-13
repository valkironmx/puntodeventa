-- Solicitudes de pedido desde la página pública (quedan "pendientes" hasta que el negocio confirma)
-- y tipos de entrega que el negocio decide mostrar.
set search_path = public, extensions;

alter table public.businesses add column order_types text[]
  check (order_types is null or (cardinality(order_types) >= 1 and order_types <@ array['mostrador','comer_aqui','para_llevar','domicilio','envio','en_local']));

create or replace function public.default_order_types(p_mode text) returns text[] language sql immutable as $$
  select case p_mode when 'food' then array['mostrador','comer_aqui','para_llevar','domicilio']
                     when 'retail' then array['mostrador','envio'] else array['en_local','domicilio'] end
$$;

create table public.order_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  folio int not null,
  public_token text unique not null,
  customer_name text not null,
  order_type text not null,
  address text,
  items jsonb not null,                  -- [{product_id, title, qty, sale_unit, options[], notes, unit_price, line_total}]
  total numeric(12,2) not null,
  status text not null default 'pending' check (status in ('pending','confirmed','rejected','completed','cancelled')),
  reject_reason text, decided_by uuid, decided_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.order_requests (business_id, created_at desc);
create trigger set_updated_at before update on public.order_requests for each row execute function public.set_updated_at();
alter table public.order_requests enable row level security;
grant select on public.order_requests to authenticated;
grant all on public.order_requests to service_role;
create policy order_requests_select on public.order_requests for select to authenticated using (public.is_member(business_id) or public.is_super_admin());

-- Pública (anon): crea la solicitud recalculando precios en el servidor
create or replace function public.request_order(p_slug text, p_items jsonb, p_name text, p_order_type text, p_address text default null)
returns text language plpgsql security definer set search_path = public as $$
declare b public.businesses; it jsonb; pr public.products; v_unit numeric(12,2); v_qty numeric(12,3); v_opts jsonb; l record;
  v_items jsonb := '[]'::jsonb; v_total numeric(12,2) := 0; v_token text; v_types text[]; v_mode text;
begin
  select * into b from public.businesses where slug = p_slug and status <> 'suspendido';
  if not found then raise exception 'Negocio no disponible'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Escribe tu nombre'; end if;
  v_types := coalesce(b.order_types, public.default_order_types(b.mode));
  if not (p_order_type = any (v_types)) then raise exception 'Tipo de entrega no disponible'; end if;
  if p_order_type in ('domicilio','envio') and length(trim(coalesce(p_address, ''))) < 5 then raise exception 'Escribe la dirección de entrega'; end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 or jsonb_array_length(p_items) > 50 then raise exception 'Tu pedido está vacío'; end if;
  -- Antispam: máximo 10 solicitudes pendientes por nombre en este negocio
  if (select count(*) from public.order_requests where business_id = b.id and status = 'pending' and lower(customer_name) = lower(trim(p_name))) >= 10 then
    raise exception 'Ya tienes varias solicitudes pendientes. Espera la confirmación del negocio.';
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    select * into pr from public.products where id = (it->>'product_id')::uuid and business_id = b.id and active and show_in_catalog and deleted_at is null;
    if not found then raise exception 'Un producto de tu pedido ya no está disponible'; end if;
    v_qty := (it->>'qty')::numeric;
    if v_qty is null or v_qty <= 0 or v_qty > 999 then raise exception 'Cantidad inválida'; end if;
    v_unit := coalesce(pr.sale_price, pr.price);
    select coalesce(jsonb_agg(o.label order by g.position, o.position), '[]'::jsonb), v_unit + coalesce(sum(o.price_delta), 0) into v_opts, v_unit
    from public.product_options o join public.product_option_groups g on g.id = o.group_id
    where g.product_id = pr.id and o.label in (select x from jsonb_array_elements_text(coalesce(it->'options', '[]'::jsonb)) x);
    v_mode := case when pr.tax_mode = 'global' then b.tax_mode_global else pr.tax_mode end;
    select * into l from public.calc_line(v_unit, v_qty, v_mode, b.tax_rate);
    v_items := v_items || jsonb_build_object('product_id', pr.id, 'title', pr.name, 'qty', v_qty, 'sale_unit', pr.sale_unit, 'options', v_opts,
      'notes', nullif(left(it->>'notes', 120), ''), 'unit_price', round(l.total / v_qty, 2), 'line_total', l.total);
    v_total := v_total + l.total;
  end loop;
  v_token := public.gen_code(20);
  insert into public.order_requests (business_id, folio, public_token, customer_name, order_type, address, items, total)
  values (b.id, public.next_folio(b.id, 'order'), v_token, trim(p_name), p_order_type, nullif(trim(p_address), ''), v_items, v_total);
  return v_token;
end $$;

create or replace function public.public_order(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('folio', o.folio, 'status', o.status, 'customer_name', o.customer_name, 'order_type', o.order_type, 'address', o.address,
    'items', o.items, 'total', o.total, 'reject_reason', o.reject_reason, 'created_at', o.created_at, 'decided_at', o.decided_at)
  from public.order_requests o where o.public_token = p_token
$$;

create or replace function public.decide_order(p_id uuid, p_status text, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare o public.order_requests;
begin
  select * into o from public.order_requests where id = p_id for update;
  if not found or public.member_role(o.business_id) is null then raise exception 'Sin permiso'; end if;
  if p_status not in ('confirmed','rejected','completed','cancelled') then raise exception 'Estatus inválido'; end if;
  if p_status in ('confirmed','rejected') and o.status <> 'pending' then raise exception 'La solicitud ya no está pendiente'; end if;
  if p_status = 'completed' and o.status <> 'confirmed' then raise exception 'Primero confirma la solicitud'; end if;
  update public.order_requests set status = p_status, decided_by = auth.uid(), decided_at = now(),
    reject_reason = case when p_status = 'rejected' then nullif(p_reason, '') else reject_reason end where id = p_id;
end $$;

-- Aviso al negocio cuando llega una solicitud
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in ('cita','stock','plan','sistema','pedido'));
create or replace function public.notify_order() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (business_id, type, title, body, link)
  values (new.business_id, 'pedido', 'Nueva solicitud de pedido P-' || lpad(new.folio::text, 4, '0'),
          new.customer_name || ' · ' || jsonb_array_length(new.items) || ' producto(s) · $' || to_char(new.total, 'FM999,999,990.00'), '/app/pedidos');
  return new;
end $$;
create trigger notify_order after insert on public.order_requests for each row execute function public.notify_order();

-- Catálogo público con los tipos de entrega activos
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
      'hero_title', b.hero_title, 'hero_text', b.hero_text, 'hero_button', b.hero_button, 'hero_action', b.hero_action, 'hero_links', b.hero_links,
      'order_types', coalesce(b.order_types, public.default_order_types(b.mode)),
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

revoke execute on function public.request_order(text, jsonb, text, text, text), public.public_order(text), public.decide_order(uuid, text, text), public.notify_order() from public;
grant execute on function public.request_order(text, jsonb, text, text, text), public.public_order(text) to anon, authenticated, service_role;
grant execute on function public.decide_order(uuid, text, text), public.default_order_types(text) to authenticated, service_role;
