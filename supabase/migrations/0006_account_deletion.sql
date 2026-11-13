-- Eliminación de cuenta iniciada por el usuario desde la app (requisito de App Store 5.1.1(v) y Google Play).
set search_path = public, extensions;

-- Qué se borraría: sirve para mostrar la advertencia antes de confirmar
create or replace function public.account_deletion_preview() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'is_super', public.is_super_admin(),
    'businesses', coalesce((select jsonb_agg(jsonb_build_object('name', b.name, 'role', m.role,
        'sole_owner', m.role = 'owner' and not exists (select 1 from public.memberships o where o.business_id = b.id and o.role = 'owner' and o.user_id <> auth.uid() and o.active)))
      from public.memberships m join public.businesses b on b.id = m.business_id where m.user_id = auth.uid()), '[]'::jsonb))
$$;

-- Borra la cuenta del usuario. Si es el único dueño de un negocio, borra también el negocio y todos sus datos.
create or replace function public.delete_my_account(p_confirm text) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := auth.uid(); r record;
begin
  if v is null then raise exception 'Sin sesión'; end if;
  if public.is_super_admin() then raise exception 'La cuenta de super admin no se elimina desde la app'; end if;
  if coalesce(upper(trim(p_confirm)), '') <> 'ELIMINAR' then raise exception 'Escribe ELIMINAR para confirmar'; end if;
  for r in select m.business_id from public.memberships m where m.user_id = v and m.role = 'owner'
           and not exists (select 1 from public.memberships o where o.business_id = m.business_id and o.role = 'owner' and o.user_id <> v and o.active)
  loop
    delete from public.businesses where id = r.business_id;   -- cascada: catálogo, ventas, citas, promociones, QR…
  end loop;
  delete from public.memberships where user_id = v;
  delete from auth.users where id = v;                          -- cascada: sesiones
end $$;

revoke execute on function public.account_deletion_preview(), public.delete_my_account(text) from public, anon;
grant execute on function public.account_deletion_preview(), public.delete_my_account(text) to authenticated, service_role;
