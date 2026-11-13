-- Preferencias de cada usuario (se conservan al cerrar sesión) y suscripciones de notificaciones push.
set search_path = public, extensions;

create table public.user_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prefs jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.user_prefs enable row level security;
grant select, insert, update on public.user_prefs to authenticated;
grant all on public.user_prefs to service_role;
create policy prefs_own on public.user_prefs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text unique not null, p256dh text not null, auth text not null,
  user_agent text, created_at timestamptz not null default now()
);
create index on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
grant select, insert, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
create policy push_own on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Cada notificación o aviso nuevo se publica en el canal "push"; el servidor lo envía a los teléfonos suscritos.
create or replace function public.push_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_notify('push', json_build_object('table', tg_table_name, 'id', new.id)::text);
  return new;
end $$;
create trigger push_notify after insert on public.notifications for each row execute function public.push_notify();
create trigger push_notify after insert on public.announcements for each row execute function public.push_notify();
revoke execute on function public.push_notify() from public, anon, authenticated;
