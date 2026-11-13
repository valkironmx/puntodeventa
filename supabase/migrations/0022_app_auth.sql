-- Sesiones propias, intentos de inicio de sesión e invitaciones en su propio esquema.
-- En Supabase, el esquema auth es de Supabase (no se le agregan tablas ni columnas);
-- los usuarios sí viven en auth.users, con la contraseña cifrada (bcrypt) en encrypted_password.
create schema if not exists app_auth;
revoke all on schema app_auth from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on schema app_auth from anon, authenticated'; end if;
end $$;

create table if not exists app_auth.sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  acting_user_id uuid references auth.users(id) on delete set null,   -- empleado activo en modo caja (PIN)
  business_id uuid,
  is_cash_device boolean not null default false,
  device_label text default 'Caja 1',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_user_idx on app_auth.sessions (user_id);

create table if not exists app_auth.login_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  ok boolean not null,
  at timestamptz not null default now()
);
create index if not exists login_attempts_email_idx on app_auth.login_attempts (email, at desc);

create table if not exists app_auth.invites (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text unique not null,
  created_at timestamptz not null default now()
);

-- Datos que ya existían en la versión local (en Supabase estas columnas/tablas no existen y se omite)
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'sessions' and column_name = 'token_hash') then
    execute 'insert into app_auth.sessions (id, token_hash, user_id, acting_user_id, business_id, is_cash_device, device_label, created_at, expires_at)
      select id, token_hash, user_id, acting_user_id, business_id, coalesce(is_cash_device, false), device_label, coalesce(created_at, now()), expires_at
      from auth.sessions on conflict do nothing';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'invite_token') then
    execute 'insert into app_auth.invites (user_id, token) select id, invite_token from auth.users where invite_token is not null on conflict do nothing';
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'login_attempts') then
    execute 'insert into app_auth.login_attempts (email, ok, at) select email, ok, at from auth.login_attempts';
  end if;
end $$;

-- Alta de usuario igual en local y en Supabase. p_password nulo = invitación pendiente.
create or replace function app_auth.create_user(p_email text, p_password text default null) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', lower(trim(p_email)),
          case when p_password is null then null else extensions.crypt(p_password, extensions.gen_salt('bf')) end,
          now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');
  return v;
end $$;
revoke execute on function app_auth.create_user(text, text) from public;
