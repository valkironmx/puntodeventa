-- SOLO LOCAL: límite de intentos de inicio de sesión (en Supabase Auth lo hace el propio servicio).
create table if not exists auth.login_attempts (
  id bigserial primary key, email text not null, ok boolean not null default false, at timestamptz not null default now()
);
create index if not exists login_attempts_email_at on auth.login_attempts (email, at desc);
