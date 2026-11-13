-- Banners de promoción (imagen + título + descripción + botón que agrega al pedido) y paneles maestros por modo.
set search_path = public, extensions;

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null, description text, image_path text,
  button_label text not null default 'Agregar al pedido',
  product_id uuid references public.products(id) on delete set null,
  active boolean not null default true, position int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.promotions (business_id);
create trigger set_updated_at before update on public.promotions for each row execute function public.set_updated_at();
alter table public.promotions enable row level security;
grant select, insert, update, delete on public.promotions to authenticated;
grant all on public.promotions to service_role;
create policy promotions_select on public.promotions for select to authenticated using (public.is_member(business_id) or public.is_super_admin());
create policy promotions_insert on public.promotions for insert to authenticated with check (public.can_manage(business_id));
create policy promotions_update on public.promotions for update to authenticated using (public.can_manage(business_id)) with check (public.can_manage(business_id));
create policy promotions_delete on public.promotions for delete to authenticated using (public.can_delete(business_id));

-- Pública: solo promociones activas de un negocio no suspendido
create or replace function public.public_promotions(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'description', p.description, 'image_path', p.image_path,
           'button_label', p.button_label, 'product_id', p.product_id) order by p.position, p.created_at), '[]'::jsonb)
  from public.promotions p join public.businesses b on b.id = p.business_id
  where b.slug = p_slug and b.status <> 'suspendido' and p.active
$$;

-- Paneles maestros: un negocio de demostración por modo, donde el super admin entra como dueño
alter table public.businesses add column is_master boolean not null default false;

create or replace function public.create_master_business(p_mode text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid; base text; v_slug text; n int := 1; v_email text; label text; m uuid; c1 uuid; c2 uuid; p1 uuid; i int;
begin
  if not public.is_super_admin() then raise exception 'Solo el super admin puede crear paneles maestros'; end if;
  if p_mode not in ('food','retail','service') then raise exception 'Modo inválido'; end if;
  select id into v from public.businesses where is_master and mode = p_mode limit 1;
  if found then return v; end if;
  label := case p_mode when 'food' then 'Comida' when 'retail' then 'Productos' else 'Servicios' end;
  base := 'maestro' || case p_mode when 'food' then 'comida' when 'retail' then 'productos' else 'servicios' end;
  v_slug := base;
  while public.slug_status(v_slug) <> 'available' loop n := n + 1; v_slug := base || n; end loop;
  select email into v_email from auth.users where id = auth.uid();
  v := public.create_business('Panel maestro ' || label, v_slug, v_email, '5500000000', p_mode, 'pro');
  update public.businesses set is_master = true, onboarded = true, tagline = 'Negocio de demostración · modo ' || label,
    address = 'Av. Reforma 100, Ciudad de México',
    schedule = '[{"days":"Lun-Vie","open":"09:00","close":"20:00","enabled":true,"dow":[1,2,3,4,5]},{"days":"Sábado","open":"10:00","close":"18:00","enabled":true,"dow":[6]},{"days":"Domingo","open":"10:00","close":"15:00","enabled":false,"dow":[0]}]'
  where id = v;
  insert into public.memberships (business_id, user_id, role, display_name) values (v, auth.uid(), 'owner', 'Super Admin') returning id into m;
  select id into c1 from public.categories where business_id = v order by position limit 1;
  select id into c2 from public.categories where business_id = v order by position offset 1 limit 1;
  if p_mode = 'food' then
    insert into public.products (business_id, category_id, name, description, price, sale_price, track_stock, featured, position) values
      (v, c1, 'Chilaquiles rojos', 'Con pollo, crema, queso y cebolla morada.', 129, 109, false, true, 1) returning id into p1;
    insert into public.products (business_id, category_id, name, description, price, track_stock, featured, position) values
      (v, c1, 'Molletes especiales', 'Frijoles, queso gratinado y pico de gallo.', 95, false, true, 2),
      (v, c2, 'Hamburguesa clásica', 'Carne de res, queso, lechuga, jitomate y papas.', 159, false, true, 3),
      (v, c2, 'Ensalada de la casa', 'Mezcla de lechugas, pollo a la plancha y aderezo.', 119, false, false, 4);
  elsif p_mode = 'retail' then
    insert into public.products (business_id, category_id, name, description, price, sale_price, track_stock, stock, featured, position) values
      (v, c1, 'Mochila urbana', 'Resistente al agua, con compartimento para laptop.', 899, 749, true, 12, true, 1) returning id into p1;
    insert into public.products (business_id, category_id, name, description, price, track_stock, stock, featured, position) values
      (v, c1, 'Termo de acero 750 ml', 'Mantiene frío 24 h y caliente 12 h.', 420, true, 20, true, 2),
      (v, c2, 'Gorra clásica', 'Ajustable, algodón de alta calidad.', 280, true, 15, true, 3),
      (v, c2, 'Cinta por metro', 'Se vende por metro.', 18, true, 100, false, 4);
    update public.products set sale_unit = 'm' where business_id = v and name = 'Cinta por metro';
  else
    insert into public.products (business_id, category_id, name, description, price, kind, duration_min, track_stock, featured, position) values
      (v, c1, 'Corte de cabello', 'Corte, lavado y peinado.', 180, 'service', 45, false, true, 1) returning id into p1;
    insert into public.products (business_id, category_id, name, description, price, kind, duration_min, price_from, track_stock, featured, position) values
      (v, c1, 'Arreglo de barba', 'Perfilado con navaja y toalla caliente.', 120, 'service', 30, false, false, true, 2),
      (v, c2, 'Paquete completo', 'Corte, barba y tratamiento.', 320, 'service', 75, false, false, true, 3),
      (v, c1, 'Color o diseño', 'El precio depende del trabajo.', 350, 'service', 90, true, false, false, 4);
    for i in 1..6 loop
      insert into public.staff_schedules (business_id, membership_id, weekday, start_time, end_time, break_start, break_end)
      values (v, m, i, '09:00', '19:00', '15:00', '16:00');
    end loop;
  end if;
  insert into public.promotions (business_id, title, description, button_label, product_id)
  values (v, 'Promoción de la semana', 'Edita este banner con tu imagen, texto y botón desde Promociones.', 'Agregar al pedido', p1);
  return v;
end $$;

revoke execute on function public.public_promotions(text), public.create_master_business(text) from public;
grant execute on function public.public_promotions(text) to anon, authenticated, service_role;
grant execute on function public.create_master_business(text) to authenticated, service_role;

-- Promoción de ejemplo en los negocios demo (si existen y aún no tienen ninguna)
insert into public.promotions (business_id, title, description, button_label, product_id)
select b.id, x.title, x.descr, x.btn, (select p.id from public.products p where p.business_id = b.id and p.name = x.prod limit 1)
from (values
  ('cafelaluna', 'Capuchino de la casa', 'Espresso doble con leche texturizada. Esta semana con 20% de descuento.', 'Pedir ahora', 'Capuchino'),
  ('nomadastore', 'Tenis Trail Runner', 'Agarre para montaña y malla transpirable. Precio especial por tiempo limitado.', 'Lo quiero', 'Tenis Trail Runner'),
  ('barberiadonbeto', 'Corte + barba', 'El paquete completo con perfilado de barba.', 'Agregar', 'Corte + barba')
) as x(slug, title, descr, btn, prod)
join public.businesses b on b.slug = x.slug
where not exists (select 1 from public.promotions pr where pr.business_id = b.id);
