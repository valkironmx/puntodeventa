-- SOLO LOCAL: la tabla auth.users local recibe las columnas que tiene la de Supabase,
-- para que app_auth.create_user() inserte igual en tu Mac y en la nube.
alter table auth.users add column if not exists instance_id uuid;
alter table auth.users add column if not exists aud varchar(255);
alter table auth.users add column if not exists role varchar(255);
alter table auth.users add column if not exists email_confirmed_at timestamptz;
alter table auth.users add column if not exists raw_app_meta_data jsonb;
alter table auth.users add column if not exists raw_user_meta_data jsonb;
alter table auth.users add column if not exists updated_at timestamptz;
alter table auth.users add column if not exists confirmation_token varchar(255);
alter table auth.users add column if not exists recovery_token varchar(255);
alter table auth.users add column if not exists email_change_token_new varchar(255);
alter table auth.users add column if not exists email_change varchar(255);
