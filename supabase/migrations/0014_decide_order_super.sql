-- El super admin también puede atender solicitudes cuando entra al panel de un negocio.
create or replace function public.decide_order(p_id uuid, p_status text, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare o public.order_requests;
begin
  select * into o from public.order_requests where id = p_id for update;
  if not found or (public.member_role(o.business_id) is null and not public.is_super_admin()) then raise exception 'Sin permiso'; end if;
  if p_status not in ('confirmed','rejected','completed','cancelled') then raise exception 'Estatus inválido'; end if;
  if p_status in ('confirmed','rejected') and o.status <> 'pending' then raise exception 'La solicitud ya no está pendiente'; end if;
  if p_status = 'completed' and o.status <> 'confirmed' then raise exception 'Primero confirma la solicitud'; end if;
  update public.order_requests set status = p_status, decided_by = auth.uid(), decided_at = now(),
    reject_reason = case when p_status = 'rejected' then nullif(p_reason, '') else reject_reason end where id = p_id;
end $$;
