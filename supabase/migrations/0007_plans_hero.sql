-- Planes administrables por el super admin y banner principal del negocio (no es promoción).
set search_path = public, extensions;

-- ---------- Planes ----------
alter table public.plans add column duration_days int not null default 30 check (duration_days between 1 and 3650);
alter table public.plans add column description text;
alter table public.plans add column active boolean not null default true;
alter table public.plans add column position int not null default 0;
alter table public.plans add column created_at timestamptz not null default now();
alter table public.plans add column updated_at timestamptz not null default now();
create trigger set_updated_at before update on public.plans for each row execute function public.set_updated_at();
update public.plans set duration_days = 15, position = 1, description = 'Para conocer la plataforma' where code = 'prueba';
update public.plans set duration_days = 30, position = 2, description = 'Lo esencial para vender' where code = 'basico';
update public.plans set duration_days = 30, position = 3, description = 'Más empleados y sin límite de productos' where code = 'pro';
-- Si un plan se borra no debe quedar ningún negocio sin plan: se bloquea el borrado mientras esté en uso (FK existente).

-- ---------- Banner principal del negocio (giro, no promoción) ----------
alter table public.businesses add column hero_title text;
alter table public.businesses add column hero_text text;
alter table public.businesses add column hero_button text;
alter table public.businesses add column hero_action text not null default 'catalog' check (hero_action in ('catalog','whatsapp','booking','none'));

-- El catálogo público ahora incluye los textos del banner principal
create or replace function public.public_catalog(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b public.businesses; r jsonb;
begin
  select * into b from public.businesses where slug = p_slug;
  if not found then return null; end if;
  if b.status = 'suspendido' then return jsonb_build_object('suspended', true, 'name', b.name); end if;
  select jsonb_build_object(
    'business', jsonb_build_object('id', b.id, 'slug', b.slug, 'name', b.name, 'mode', b.mode, 'features', b.features, 'tagline', b.tagline,
      'logo_path', b.logo_path, 'hero_path', b.hero_path, 'hero_focal_x', b.hero_focal_x, 'hero_focal_y', b.hero_focal_y,
      'hero_title', b.hero_title, 'hero_text', b.hero_text, 'hero_button', b.hero_button, 'hero_action', b.hero_action,
      'accent_color', b.accent_color, 'address', b.address, 'maps_url', b.maps_url, 'lat', b.lat, 'lng', b.lng,
      'contact', b.contact, 'schedule', b.schedule, 'tax_mode_global', b.tax_mode_global, 'tax_rate', b.tax_rate,
      'booking_enabled', coalesce((select online_enabled from public.booking_settings where business_id = b.id), false)
                         and (b.mode = 'service' or coalesce((b.features->>'booking')::boolean, false))),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.position, c.name)
                            from public.categories c where c.business_id = b.id and c.visible), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(public.product_json(p.id, true) order by p.featured desc, p.position, p.name)
                          from public.products p left join public.categories c on c.id = p.category_id
                          where p.business_id = b.id and p.show_in_catalog and p.active and p.deleted_at is null
                            and (c.id is null or c.visible)), '[]'::jsonb)
  ) into r;
  return r;
end $$;

-- Textos de ejemplo del banner principal en los negocios demo
update public.businesses set hero_title = 'Café de especialidad en el centro de Toluca', hero_text = 'Granos de Veracruz tostados cada semana, pan del día y desayunos.' where slug = 'cafelaluna' and hero_title is null;
update public.businesses set hero_title = 'Equipo para tu próxima aventura', hero_text = 'Calzado, mochilas y accesorios outdoor con envío a domicilio.' where slug = 'nomadastore' and hero_title is null;
update public.businesses set hero_title = 'Cortes clásicos y barba en Guadalajara', hero_text = 'Agenda en línea y te esperamos sin filas.', hero_button = 'Agendar cita', hero_action = 'booking' where slug = 'barberiadonbeto' and hero_title is null;
