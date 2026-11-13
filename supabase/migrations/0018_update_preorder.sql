-- Editar un pedido ya registrado: cliente, teléfono, entrega, tipo de entrega, características y datos adicionales.
-- Los productos y montos no cambian aquí (afectan inventario, caja y pagos ya registrados).

create or replace function public.update_preorder(p_sale uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  s public.sales;
  v_name text := btrim(coalesce(p->>'customer_name', ''));
  v_phone text := regexp_replace(coalesce(p->>'phone', ''), '\D', '', 'g');
  v_fields jsonb := coalesce(p->'custom_fields', '[]'::jsonb);
begin
  select * into s from public.sales where id = p_sale for update;
  if not found or not public.can_manage(s.business_id) then raise exception 'Sin permiso'; end if;
  if s.source <> 'encargo' then raise exception 'Solo se pueden editar pedidos'; end if;
  if s.status = 'cancelled' then raise exception 'El pedido está cancelado'; end if;
  if length(v_name) < 2 then raise exception 'Escribe el nombre del cliente'; end if;
  if v_phone <> '' and length(v_phone) <> 10 then raise exception 'El teléfono debe tener 10 dígitos'; end if;
  if coalesce(p->>'delivery_at', '') = '' then raise exception 'Indica la fecha de entrega'; end if;
  if jsonb_typeof(v_fields) <> 'array' or jsonb_array_length(v_fields) > 20 then raise exception 'Datos adicionales inválidos'; end if;
  if coalesce(p->>'order_type', '') <> '' and not (p->>'order_type' = any (array['mostrador','comer_aqui','para_llevar','domicilio','envio','en_local'])) then
    raise exception 'Tipo de entrega inválido';
  end if;

  update public.sales set
    customer_name = left(v_name, 80),
    customer_phone = nullif(v_phone, ''),
    delivery_at = (p->>'delivery_at')::timestamptz,
    order_type = coalesce(nullif(p->>'order_type', ''), order_type),
    notes = nullif(left(btrim(coalesce(p->>'notes', '')), 600), ''),
    custom_fields = v_fields
  where id = s.id;
end $$;

revoke execute on function public.update_preorder(uuid, jsonb) from public, anon;
grant execute on function public.update_preorder(uuid, jsonb) to authenticated, service_role;
