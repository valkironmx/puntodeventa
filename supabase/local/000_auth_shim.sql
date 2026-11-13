-- SOLO LOCAL (sin Docker): imita lo mínimo de Supabase Auth para que las migraciones,
-- RLS y RPC sean las mismas que correrán en Supabase. En Supabase real NO se aplica este archivo.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  encrypted_password text,
  phone text,
  invite_token text unique,
  created_at timestamptz default now(),
  last_sign_in_at timestamptz
);

-- Sesiones del servidor web (cookie httpOnly). acting_user_id = empleado activo en modo caja (PIN).
create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  acting_user_id uuid references auth.users(id) on delete set null,
  business_id uuid,
  is_cash_device boolean default false,
  device_label text default 'Caja 1',
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;
