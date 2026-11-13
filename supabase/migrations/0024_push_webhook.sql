-- Notificaciones push en la nube: Vercel no puede quedarse escuchando el canal "push" de Postgres.
-- Con pg_net (Supabase) la base llama al sistema por HTTPS cada vez que hay una notificación o aviso nuevo.
-- La dirección y la clave se guardan en app_settings después de publicar (ver docs/DESPLIEGUE.md).
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;   -- sin políticas: solo el servidor (service role) la lee
revoke all on public.app_settings from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on public.app_settings from anon, authenticated'; end if;
end $$;

do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then create extension if not exists pg_net; end if;
exception when others then raise notice 'pg_net no disponible: %', sqlerrm;
end $$;

create or replace function public.push_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text; v_body jsonb := jsonb_build_object('table', tg_table_name, 'id', new.id);
begin
  -- En tu Mac: el servidor escucha este canal
  perform pg_notify('push', v_body::text);
  -- En la nube: llamada HTTPS al sistema (si pg_net y la configuración existen)
  select value into v_url from public.app_settings where key = 'push_webhook_url';
  select value into v_secret from public.app_settings where key = 'push_webhook_secret';
  if v_url is not null and v_secret is not null and exists (select 1 from pg_extension where extname = 'pg_net') then
    execute 'select net.http_post(url := $1, body := $2, headers := $3)'
      using v_url, v_body, jsonb_build_object('content-type', 'application/json', 'x-push-secret', v_secret);
  end if;
  return new;
exception when others then
  raise warning 'push: %', sqlerrm;   -- un aviso que no se pudo enviar nunca bloquea el guardado
  return new;
end $$;
