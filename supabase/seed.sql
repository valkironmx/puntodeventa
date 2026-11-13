-- Seed demo (PLAN §9): 1 super admin + 3 negocios iguales a la maqueta. Contraseña demo y PIN: ver CREDENCIALES-LOCAL.md
set search_path = public, extensions;

create or replace function pg_temp.mkuser(p_email text) returns uuid language plpgsql as $$
declare v uuid;
begin
  return app_auth.create_user(p_email, 'Demo-2026');
end $$;

create or replace function pg_temp.mkmember(p_business uuid, p_email text, p_role text, p_name text) returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into public.memberships (business_id, user_id, role, display_name, pin_hash)
  values (p_business, pg_temp.mkuser(p_email), p_role, p_name, crypt('1234', gen_salt('bf'))) returning id into v;
  return v;
end $$;

create or replace function pg_temp.cat(p_business uuid, p_name text, p_pos int) returns uuid language sql as $$
  insert into public.categories (business_id, name, position) values (p_business, p_name, p_pos) returning id
$$;

create or replace function pg_temp.prod(p_business uuid, p_cat uuid, p_name text, p_emoji text, p_desc text, p_price numeric, p_extra jsonb default '{}')
returns uuid language sql as $$
  insert into public.products (business_id, category_id, name, emoji, description, price, sale_price, sale_unit, kind, price_from, duration_min,
    track_stock, stock, show_in_catalog, featured, custom_fields, position)
  values (p_business, p_cat, p_name, p_emoji, p_desc, p_price, (p_extra->>'sale_price')::numeric, coalesce(p_extra->>'unit', 'pieza'),
    coalesce(p_extra->>'kind', 'product'), coalesce((p_extra->>'from')::boolean, false), (p_extra->>'dur')::int,
    p_extra ? 'stock', coalesce((p_extra->>'stock')::numeric, 0), coalesce((p_extra->>'public')::boolean, true),
    coalesce((p_extra->>'featured')::boolean, false), coalesce(p_extra->'fields', '[]'::jsonb), coalesce((p_extra->>'pos')::int, 0))
  returning id
$$;

do $$
declare
  v_super uuid; b uuid; c1 uuid; c2 uuid; c3 uuid; c4 uuid; p1 uuid; p2 uuid; p3 uuid; g uuid; q uuid; v_owner uuid;
  m_beto uuid; m_luis uuid; d date := (now() at time zone 'America/Mexico_City')::date; tz text := 'America/Mexico_City'; i int; s1 uuid; s2 uuid; s3 uuid;
  sched jsonb := '[{"days":"Lun-Vie","open":"08:00","close":"21:00","enabled":true,"dow":[1,2,3,4,5]},{"days":"Sábado","open":"09:00","close":"21:00","enabled":true,"dow":[6]},{"days":"Domingo","open":"09:00","close":"15:00","enabled":true,"dow":[0]}]';
begin
  -- Super admin
  v_super := pg_temp.mkuser('super@tuapp.com');
  insert into public.platform_admins values (v_super);
  perform set_config('request.jwt.claim.sub', v_super::text, true);

  -- ============ Café La Luna (Comida) ============
  b := public.create_business('Café La Luna', 'cafelaluna', 'dueno@cafelaluna.mx', '7225550101', 'food', 'pro');
  delete from public.categories where business_id = b;
  update public.businesses set tagline = 'Café de especialidad · Toluca', address = 'Av. Hidalgo 210, Centro, Toluca', onboarded = true,
    maps_url = 'https://maps.google.com/?q=Av.+Hidalgo+210+Toluca', schedule = sched, accent_color = '#1F8A6B',
    contact = '{"whatsapp":"7225550101","phone":"7225550101","instagram":"cafelaluna"}' where id = b;
  update public.ticket_settings set address_text = 'Av. Hidalgo 210, Centro, Toluca', phone_text = 'WhatsApp 722 555 0101' where business_id = b;
  v_owner := pg_temp.mkuser('dueno@cafelaluna.mx');
  insert into public.memberships (business_id, user_id, role, display_name, pin_hash) values (b, v_owner, 'owner', 'Daniela', crypt('1234', gen_salt('bf')));
  perform pg_temp.mkmember(b, 'admin@cafelaluna.mx', 'admin', 'Marco');
  perform pg_temp.mkmember(b, 'cajero@cafelaluna.mx', 'cashier', 'Ana');
  c1 := pg_temp.cat(b, 'Café', 1); c2 := pg_temp.cat(b, 'Frappés', 2); c3 := pg_temp.cat(b, 'Postres', 3); c4 := pg_temp.cat(b, 'Desayunos', 4);
  p1 := pg_temp.prod(b, c1, 'Capuchino', '☕', 'Espresso doble con leche texturizada y espuma cremosa.', 69, '{"sale_price":55,"featured":true,"fields":[{"label":"Preparación","value":"5 min"}]}');
  insert into public.product_option_groups (business_id, product_id, name) values (b, p1, 'Tamaño') returning id into g;
  insert into public.product_options (business_id, group_id, label, price_delta, position) values (b, g, 'Chico', 0, 1), (b, g, 'Mediano', 10, 2), (b, g, 'Grande', 18, 3);
  insert into public.product_option_groups (business_id, product_id, name, position) values (b, p1, 'Extras', 2) returning id into g;
  insert into public.product_options (business_id, group_id, label, price_delta, position) values (b, g, 'Shot extra', 12, 1), (b, g, 'Leche de almendra', 15, 2);
  p2 := pg_temp.prod(b, c2, 'Latte helado', '🧋', 'Latte frío sobre hielo. Pídelo con leche de avena o almendra.', 75, '{"featured":true}');
  perform pg_temp.prod(b, c1, 'Americano', '☕', 'Café de altura de Veracruz, tueste medio.', 45);
  perform pg_temp.prod(b, c3, 'Pastel de chocolate', '🍰', 'Rebanada de pastel húmedo con ganache.', 85, '{"stock":0}');
  perform pg_temp.prod(b, c4, 'Chilaquiles verdes', '🍳', 'Con huevo estrellado, crema, queso y cebolla.', 109, '{"fields":[{"label":"Picante","value":"Medio"}]}');
  perform pg_temp.prod(b, c3, 'Dona glaseada', '🍩', 'Horneada todos los días.', 29, '{"stock":18}');
  p3 := pg_temp.prod(b, c1, 'Café en grano Veracruz', '🫘', 'Tueste medio, notas a chocolate. Se vende por kilo.', 380, '{"unit":"kg","stock":12.5}');
  perform pg_temp.prod(b, null, 'Cargo por envío', '🛵', 'Solo en sistema.', 35, '{"public":false}');
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  q := public.save_quote(b, null, jsonb_build_object('client_name', 'Eventos Corporativos MX', 'client_phone', '7221234567', 'valid_days', 15, 'prices_plus_tax', false,
    'custom_fields', '[{"label":"Lugar de entrega","value":"Salón Los Arcos, Metepec"}]'::jsonb,
    'items', jsonb_build_array(jsonb_build_object('product_id', p2, 'title', 'Latte helado', 'unit_price', 75, 'qty', 40),
      jsonb_build_object('title', 'Servicio de barra de café (3 h)', 'description', 'Barista, equipo y montaje', 'unit_price', 2500, 'qty', 1))));
  perform public.convert_quote_to_sale(q, jsonb_build_object('amount', 2750, 'method', 'transfer', 'note', 'Anticipo 50%'));
  perform public.save_quote(b, null, jsonb_build_object('client_name', 'Laura Méndez', 'client_phone', '7229876543', 'valid_days', 15, 'prices_plus_tax', true,
    'items', jsonb_build_array(jsonb_build_object('product_id', p1, 'title', 'Capuchino', 'unit_price', 55, 'qty', 25),
      jsonb_build_object('title', 'Mesa de postres', 'description', '30 piezas surtidas', 'unit_price', 1200, 'qty', 1))));

  -- ============ Nómada Store (Productos) ============
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  b := public.create_business('Nómada Store', 'nomadastore', 'dueno@nomadastore.mx', '5555550202', 'retail', 'basico');
  delete from public.categories where business_id = b;
  update public.businesses set tagline = 'Outdoor y aventura · CDMX', address = 'Av. Insurgentes Sur 1458, CDMX', onboarded = true, accent_color = '#C2562B', accent_auto = false,
    schedule = sched, contact = '{"whatsapp":"5555550202","phone":"5555550202","instagram":"nomadastore"}' where id = b;
  update public.ticket_settings set address_text = 'Av. Insurgentes Sur 1458, CDMX', phone_text = 'WhatsApp 55 5555 0202' where business_id = b;
  v_owner := pg_temp.mkuser('dueno@nomadastore.mx');
  insert into public.memberships (business_id, user_id, role, display_name, pin_hash) values (b, v_owner, 'owner', 'Rodrigo', crypt('1234', gen_salt('bf')));
  perform pg_temp.mkmember(b, 'admin@nomadastore.mx', 'admin', 'Paola');
  perform pg_temp.mkmember(b, 'cajero@nomadastore.mx', 'cashier', 'Iván');
  c1 := pg_temp.cat(b, 'Novedades', 1); c2 := pg_temp.cat(b, 'Calzado', 2); c3 := pg_temp.cat(b, 'Accesorios', 3); c4 := pg_temp.cat(b, 'Ofertas', 4);
  p1 := pg_temp.prod(b, c2, 'Tenis Trail Runner', '👟', 'Suela con agarre para montaña, malla transpirable.', 1899, '{"sale_price":1499,"featured":true,"stock":0,"fields":[{"label":"Material","value":"Malla y hule"},{"label":"Garantía","value":"3 meses"}]}');
  insert into public.product_option_groups (business_id, product_id, name, type) values (b, p1, 'Talla', 'variant') returning id into g;
  insert into public.product_options (business_id, group_id, label, position, track_stock, stock, sku) values
    (b, g, '25', 1, true, 2, 'TTR-25'), (b, g, '26', 2, true, 3, 'TTR-26'), (b, g, '27', 3, true, 0, 'TTR-27'), (b, g, '28', 4, true, 1, 'TTR-28');
  p2 := pg_temp.prod(b, c3, 'Paracord 550', '🪢', 'Cuerda de 7 hilos, 4 mm. Se vende por metro.', 18, '{"unit":"m","stock":250,"featured":true}');
  perform pg_temp.prod(b, c1, 'Mochila 30 L', '🎒', 'Impermeable, con funda para lluvia y soporte lumbar.', 1250, '{"stock":6}');
  perform pg_temp.prod(b, c3, 'Termo 1 L', '🧴', 'Acero inoxidable, 24 h frío / 12 h caliente.', 480, '{"stock":14}');
  perform pg_temp.prod(b, c4, 'Gorra Explorer', '🧢', 'Secado rápido con protección UV.', 320, '{"sale_price":249,"stock":9}');
  perform pg_temp.prod(b, c3, 'Linterna frontal', '🔦', '300 lúmenes, recargable por USB.', 390, '{"stock":3}');
  perform pg_temp.prod(b, null, 'Bolsa de regalo', '🎁', 'Solo en sistema.', 15, '{"public":false,"stock":40}');
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  q := public.save_quote(b, null, jsonb_build_object('client_name', 'Club de Senderismo Ajusco', 'client_phone', '5512345678', 'valid_days', 15, 'prices_plus_tax', false,
    'items', jsonb_build_array(jsonb_build_object('product_id', p2, 'title', 'Paracord 550', 'unit_price', 18, 'qty', 100, 'sale_unit', 'm'),
      jsonb_build_object('title', 'Bordado de logo en 10 gorras', 'description', 'Pedido especial de mayoreo', 'unit_price', 1200, 'qty', 1))));
  perform public.convert_quote_to_sale(q, jsonb_build_object('amount', 1500, 'method', 'cash', 'note', 'Anticipo 50%'));

  -- ============ Barbería Don Beto (Servicios) ============
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  b := public.create_business('Barbería Don Beto', 'barberiadonbeto', 'beto@barberiadonbeto.mx', '3335550303', 'service', 'pro');
  delete from public.categories where business_id = b;
  update public.businesses set tagline = 'Cortes clásicos y barba · Guadalajara', address = 'Av. Chapultepec 480, Guadalajara', onboarded = true, accent_color = '#2F5FD0', accent_auto = false,
    schedule = '[{"days":"Lun-Sáb","open":"09:00","close":"19:00","enabled":true,"dow":[1,2,3,4,5,6]},{"days":"Domingo","open":"10:00","close":"14:00","enabled":false,"dow":[0]}]',
    contact = '{"whatsapp":"3335550303","phone":"3335550303","instagram":"barberiadonbeto"}' where id = b;
  update public.ticket_settings set address_text = 'Av. Chapultepec 480, Guadalajara', phone_text = 'WhatsApp 33 3555 0303' where business_id = b;
  v_owner := pg_temp.mkuser('beto@barberiadonbeto.mx');
  insert into public.memberships (business_id, user_id, role, display_name, pin_hash) values (b, v_owner, 'owner', 'Beto', crypt('1234', gen_salt('bf'))) returning id into m_beto;
  m_luis := pg_temp.mkmember(b, 'luis@barberiadonbeto.mx', 'cashier', 'Luis');
  perform pg_temp.mkmember(b, 'admin@barberiadonbeto.mx', 'admin', 'Sofía');
  c1 := pg_temp.cat(b, 'Cortes', 1); c2 := pg_temp.cat(b, 'Barba', 2); c3 := pg_temp.cat(b, 'Paquetes', 3); c4 := pg_temp.cat(b, 'Productos', 4);
  s1 := pg_temp.prod(b, c1, 'Corte clásico', '💈', 'Corte a tijera o máquina, lavado y peinado.', 150, '{"kind":"service","dur":45,"featured":true,"fields":[{"label":"Incluye","value":"Lavado y peinado"}]}');
  s2 := pg_temp.prod(b, c2, 'Afeitado a navaja', '🪒', 'Toalla caliente, espuma y navaja libre.', 150, '{"kind":"service","dur":30}');
  s3 := pg_temp.prod(b, c3, 'Corte + barba', '🧔', 'Paquete completo con perfilado de barba.', 250, '{"kind":"service","dur":60,"featured":true}');
  perform pg_temp.prod(b, c1, 'Diseño / fade', '✂️', 'El precio depende del diseño.', 180, '{"kind":"service","dur":60,"from":true}');
  perform pg_temp.prod(b, c1, 'Corte niño', '🧒', 'Hasta 12 años.', 100, '{"kind":"service","dur":30}');
  p1 := pg_temp.prod(b, c4, 'Pomada mate', '🧴', 'Fijación fuerte, acabado natural. 100 g.', 220, '{"stock":8}');
  for i in 1..6 loop
    insert into public.staff_schedules (business_id, membership_id, weekday, start_time, end_time, break_start, break_end)
    values (b, m_beto, i, '09:00', '19:00', '15:00', '16:00'), (b, m_luis, i, '10:00', '19:00', '15:00', '16:00');
  end loop;
  insert into public.appointments (business_id, product_id, membership_id, customer_name, customer_phone, starts_at, ends_at, price, status, source, public_token, hold_expires_at, created_at) values
    (b, s1, m_beto, 'Andrés Luna', '3311112222', (d + time '13:00') at time zone tz, (d + time '13:45') at time zone tz, 150, 'pending', 'online', public.gen_code(20), now() + interval '3 days', now() - interval '25 minutes'),
    (b, s2, m_luis, 'Fernando Gil', '3322223333', (d + time '14:00') at time zone tz, (d + time '14:30') at time zone tz, 150, 'pending', 'online', public.gen_code(20), now() + interval '3 days', now() - interval '1 hour'),
    (b, s1, m_beto, 'Carlos Méndez', '3333334444', (d + time '09:00') at time zone tz, (d + time '09:45') at time zone tz, 150, 'completed', 'online', public.gen_code(20), null, now() - interval '1 day'),
    (b, s3, m_luis, 'Jorge Ramírez', '3344445555', (d + time '10:00') at time zone tz, (d + time '11:00') at time zone tz, 250, 'confirmed', 'panel', public.gen_code(20), null, now() - interval '1 day'),
    (b, s3, m_beto, 'Miguel Ángel Soto', '3355556666', (d + time '11:00') at time zone tz, (d + time '12:00') at time zone tz, 250, 'confirmed', 'online', public.gen_code(20), null, now() - interval '2 days'),
    (b, s2, m_beto, 'Raúl Ortega', '3366667777', (d + time '16:30') at time zone tz, (d + time '17:00') at time zone tz, 150, 'confirmed', 'online', public.gen_code(20), null, now() - interval '1 day'),
    (b, s1, m_luis, 'Diego Paredes', '3377778888', (d + time '17:00') at time zone tz, (d + time '17:45') at time zone tz, 150, 'confirmed', 'panel', public.gen_code(20), null, now() - interval '3 hours'),
    (b, s1, m_luis, 'Emilio Vargas', '3388889999', (d + 1 + time '11:00') at time zone tz, (d + 1 + time '11:45') at time zone tz, 150, 'confirmed', 'online', public.gen_code(20), null, now() - interval '3 hours');
  insert into public.appointment_events (business_id, appointment_id, type) select business_id, id, 'solicitada' from public.appointments where business_id = b;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  q := public.save_quote(b, null, jsonb_build_object('client_name', 'Boda Hernández', 'client_phone', '3399990000', 'valid_days', 15, 'prices_plus_tax', false,
    'custom_fields', '[{"label":"Fecha del evento","value":"Sábado 28 de noviembre"}]'::jsonb,
    'items', jsonb_build_array(jsonb_build_object('product_id', s3, 'title', 'Corte + barba', 'unit_price', 250, 'qty', 6),
      jsonb_build_object('title', 'Servicio a domicilio', 'description', 'Traslado y montaje', 'unit_price', 500, 'qty', 1))));
  perform public.convert_quote_to_sale(q, jsonb_build_object('amount', 1000, 'method', 'transfer', 'note', 'Anticipo 50%'));
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

-- Promociones de ejemplo (banners)
insert into public.promotions (business_id, title, description, button_label, product_id)
select b.id, x.title, x.descr, x.btn, (select p.id from public.products p where p.business_id = b.id and p.name = x.prod limit 1)
from (values
  ('cafelaluna', 'Capuchino de la casa', 'Espresso doble con leche texturizada. Esta semana con 20% de descuento.', 'Agregar', 'Capuchino'),
  ('nomadastore', 'Tenis Trail Runner', 'Agarre para montaña y malla transpirable. Precio especial por tiempo limitado.', 'Agregar', 'Tenis Trail Runner'),
  ('barberiadonbeto', 'Corte + barba', 'El paquete completo con perfilado de barba.', 'Agregar', 'Corte + barba')
) as x(slug, title, descr, btn, prod)
join public.businesses b on b.slug = x.slug;

-- Segunda promoción (se muestra como tira de oferta)
insert into public.promotions (business_id, title, description, button_label, product_id, position)
select b.id, x.title, x.descr, x.btn, (select p.id from public.products p where p.business_id = b.id and p.name = x.prod limit 1), 9
from (values
  ('cafelaluna', 'Dona glaseada', 'Recién horneada. Llévala con tu café.', 'Agregar', 'Dona glaseada'),
  ('nomadastore', 'Mochila 30 L', 'Impermeable y con soporte lumbar.', 'Agregar', 'Mochila 30 L'),
  ('barberiadonbeto', 'Pomada mate', 'Fijación fuerte, acabado natural.', 'Agregar', 'Pomada mate')
) as x(slug, title, descr, btn, prod)
join public.businesses b on b.slug = x.slug
where not exists (select 1 from public.promotions pr where pr.business_id = b.id and pr.title = x.title);

-- Banner principal de los negocios demo
update public.businesses set hero_title = 'Café de especialidad en el centro de Toluca', hero_text = 'Granos de Veracruz tostados cada semana, pan del día y desayunos.' where slug = 'cafelaluna';
update public.businesses set hero_title = 'Equipo para tu próxima aventura', hero_text = 'Calzado, mochilas y accesorios outdoor con envío a domicilio.' where slug = 'nomadastore';
update public.businesses set hero_title = 'Cortes clásicos y barba en Guadalajara', hero_text = 'Agenda en línea y te esperamos sin filas.', hero_button = 'Agendar cita', hero_action = 'booking' where slug = 'barberiadonbeto';

-- Redes en el banner principal: las que el negocio ya tiene (máximo 4)
update public.businesses set hero_links = jsonb_build_object('show',
  coalesce((select jsonb_agg(k) from (
     select k from unnest(array['whatsapp','instagram','facebook','tiktok']) with ordinality as t(k, o)
     where coalesce(contact->>k, '') <> '' order by o limit 4) s), '[]'::jsonb), 'custom', null);
