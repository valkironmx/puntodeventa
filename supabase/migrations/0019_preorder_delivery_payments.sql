-- Pedidos del punto de venta: marcar como entregado y abonos desde la ventana de Pedidos.

alter table public.sales add column if not exists delivered_at timestamptz;
create index if not exists sales_preorders_idx on public.sales (business_id, delivery_at) where source = 'encargo';

-- Abonos: dueño/admin en cualquier venta; el cajero también puede cobrar abonos de pedidos.
create or replace function public.add_payment(p_sale uuid, p_amount numeric, p_method text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.sales; v_session uuid;
begin
  select * into s from public.sales where id = p_sale for update;
  if not found or not (public.can_manage(s.business_id) or (s.source = 'encargo' and public.is_member(s.business_id))) then raise exception 'Sin permiso'; end if;
  if s.status = 'cancelled' then raise exception 'La venta está cancelada'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Monto inválido'; end if;
  if p_amount > s.balance then raise exception 'No puedes cobrar más del saldo ($%)', s.balance; end if;
  if p_method not in ('cash', 'card', 'transfer') then raise exception 'Método de pago inválido'; end if;
  select id into v_session from public.cash_sessions where business_id = s.business_id and closed_at is null;
  insert into public.payments (business_id, sale_id, amount, method, note, cash_session_id, received_by)
  values (s.business_id, s.id, p_amount, p_method, nullif(left(coalesce(p_note, ''), 120), ''), v_session, auth.uid());
  select * into s from public.sales where id = p_sale;
  return jsonb_build_object('balance', s.balance, 'status', s.status);
end $$;

create or replace function public.set_preorder_delivered(p_sale uuid, p_delivered boolean) returns void
language plpgsql security definer set search_path = public as $$
declare s public.sales;
begin
  select * into s from public.sales where id = p_sale for update;
  if not found or not (public.is_member(s.business_id) or public.is_super_admin()) then raise exception 'Sin permiso'; end if;
  if s.source <> 'encargo' then raise exception 'Solo los pedidos se marcan como entregados'; end if;
  if s.status = 'cancelled' then raise exception 'El pedido está cancelado'; end if;
  update public.sales set delivered_at = case when p_delivered then now() end where id = s.id;
end $$;

revoke execute on function public.set_preorder_delivered(uuid, boolean) from public, anon;
grant execute on function public.set_preorder_delivered(uuid, boolean) to authenticated, service_role;
