-- Los paneles maestros del super admin no dependen de planes: sin vencimiento, sin suspensión y sin límites.
set search_path = public, extensions;

create or replace function public.master_without_plan() returns trigger language plpgsql as $$
begin
  if new.is_master then
    new.plan_expires_at := null;
    new.status := 'activo';
  end if;
  return new;
end $$;
create trigger master_without_plan before insert or update on public.businesses for each row execute function public.master_without_plan();

update public.businesses set plan_expires_at = null, status = 'activo' where is_master;
