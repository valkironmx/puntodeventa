-- App del teléfono sin internet: cada operación hecha sin conexión llega con un id propio.
-- Se guarda aquí para que, si el teléfono la reenvía, no se registre dos veces.
create table public.mobile_ops (
  client_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('sale', 'payment', 'delivered', 'preorder_update', 'quote', 'convert_quote')),
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.mobile_ops (business_id, created_at desc);
alter table public.mobile_ops enable row level security;
create policy mobile_ops_select on public.mobile_ops for select to authenticated using (user_id = auth.uid());
create policy mobile_ops_insert on public.mobile_ops for insert to authenticated with check (user_id = auth.uid() and public.is_member(business_id));
grant select, insert on public.mobile_ops to authenticated;
