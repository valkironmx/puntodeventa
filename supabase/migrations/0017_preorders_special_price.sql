-- Punto de venta: pedidos a futuro (encargos con anticipo) y precio especial por partida.
set search_path = public, extensions;

alter table public.sales drop constraint sales_source_check;
alter table public.sales add constraint sales_source_check check (source in ('pos','quote','encargo'));
alter table public.sales add column delivery_at timestamptz;
alter table public.sales add column customer_phone text;
alter table public.sales add column notes text;
alter table public.sales add column custom_fields jsonb not null default '[]';
alter table public.sale_items add column list_price numeric(12,2);   -- precio de lista cuando se cobró con precio especial

drop function public.register_pos_sale(uuid, jsonb, jsonb, numeric, text, text, text, uuid);

create or replace function public.register_pos_sale(
  p_business uuid, p_items jsonb, p_payments jsonb, p_cash_received numeric default null,
  p_customer_name text default null, p_order_type text default 'mostrador', p_table_label text default null,
  p_appointment uuid default null, p_extra jsonb default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_list numeric(12,2); v_pre boolean := coalesce((p_extra->>'preorder')::boolean, false);
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
  if v_pre then
    if length(trim(coalesce(p_customer_name, ''))) < 2 then raise exception 'Escribe el nombre del cliente'; end if;
    if coalesce(p_extra->>'delivery_at', '') = '' then raise exception 'Indica la fecha de entrega'; end if;
  end if;
  insert into public.sales (business_id, folio, source, customer_name, order_type, table_label, status, cash_session_id, created_by,
                            delivery_at, customer_phone, notes, custom_fields)
  values (p_business, v_folio, case when v_pre then 'encargo' else 'pos' end, nullif(trim(p_customer_name), ''), coalesce(p_order_type, 'mostrador'), nullif(p_table_label, ''), 'pending', v_session, auth.uid(),
          case when v_pre then (p_extra->>'delivery_at')::timestamptz end, nullif(left(p_extra->>'phone', 20), ''), nullif(left(p_extra->>'notes', 600), ''),
          coalesce(p_extra->'custom_fields', '[]'::jsonb))
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
      -- Precio especial capturado en caja: se guarda el precio de lista para mostrarlo en el ticket
      v_list := null;
      if coalesce(it->>'unit_override', '') <> '' then
        if (it->>'unit_override')::numeric < 0 then raise exception 'Precio inválido'; end if;
        if (it->>'unit_override')::numeric <> v_unit then v_list := v_unit; v_unit := round((it->>'unit_override')::numeric, 2); end if;
      end if;
      v_mode := case when pr.tax_mode = 'global' then b.tax_mode_global else pr.tax_mode end;
      select * into l from public.calc_line(v_unit, v_qty, v_mode, b.tax_rate);
      insert into public.sale_items (business_id, sale_id, product_id, option_id, title, unit_price, list_price, qty, sale_unit, options, notes, tax_mode, line_subtotal, line_tax, line_total)
      values (p_business, v_sale, pr.id, v_first_opt, v_title, v_unit, v_list, v_qty, pr.sale_unit, v_opts, nullif(it->>'notes', ''), v_mode, l.base, l.iva, l.total);
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
  if v_pre then
    if v_paid > v_total then raise exception 'El anticipo no puede ser mayor al total'; end if;
  elsif v_paid <> v_total then raise exception 'Los pagos (%) no cuadran con el total (%)', v_paid, v_total;
  end if;
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

revoke execute on function public.register_pos_sale(uuid, jsonb, jsonb, numeric, text, text, text, uuid, jsonb) from public, anon;
grant execute on function public.register_pos_sale(uuid, jsonb, jsonb, numeric, text, text, text, uuid, jsonb) to authenticated, service_role;
