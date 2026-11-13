-- Demostraciones: cada panel maestro recuerda su modo original, así una demostración puede cambiar
-- el tipo de negocio en el asistente y al iniciar otra demostración vuelve a su modo, sin borrar datos.
set search_path = public, extensions;

alter table public.businesses add column master_mode text check (master_mode is null or master_mode in ('food','retail','service'));
update public.businesses set master_mode = mode where is_master and master_mode is null;

create or replace function public.create_master_business(p_mode text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid; base text; v_slug text; n int := 1; v_email text; label text; m uuid; c1 uuid; c2 uuid; p1 uuid; i int;
begin
  if not public.is_super_admin() then raise exception 'Solo el super admin puede crear paneles maestros'; end if;
  if p_mode not in ('food','retail','service') then raise exception 'Modo inválido'; end if;
  select id into v from public.businesses where is_master and coalesce(master_mode, mode) = p_mode limit 1;
  if found then return v; end if;
  label := case p_mode when 'food' then 'Comida' when 'retail' then 'Productos' else 'Servicios' end;
  base := 'maestro' || case p_mode when 'food' then 'comida' when 'retail' then 'productos' else 'servicios' end;
  v_slug := base;
  while public.slug_status(v_slug) <> 'available' loop n := n + 1; v_slug := base || n; end loop;
  select email into v_email from auth.users where id = auth.uid();
  v := public.create_business('Panel maestro ' || label, v_slug, v_email, '5500000000', p_mode, 'pro');
  update public.businesses set is_master = true, master_mode = p_mode, onboarded = true, tagline = 'Negocio de demostración · modo ' || label,
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

-- Inicia una demostración: el panel vuelve a verse como cuenta recién creada (asistente "¿Qué vendes?"),
-- conservando catálogo, promociones, ventas y todo lo demás.
create or replace function public.start_master_demo(p_mode text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not public.is_super_admin() then raise exception 'Solo el super admin puede iniciar demostraciones'; end if;
  v := public.create_master_business(p_mode);
  update public.businesses set onboarded = false, mode = p_mode where id = v;
  return v;
end $$;
revoke execute on function public.start_master_demo(text) from public, anon;
grant execute on function public.start_master_demo(text) to authenticated, service_role;
