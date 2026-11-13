-- Banner principal: nombre, horario y hasta 4 botones de redes (WhatsApp, Facebook, TikTok, Instagram o un enlace propio).
-- Promociones: botón "Agregar".
set search_path = public, extensions;

alter table public.businesses add column hero_links jsonb not null default '{"show": [], "custom": null}'
  check (jsonb_typeof(hero_links->'show') = 'array' and jsonb_array_length(hero_links->'show') <= 4);
-- Por defecto se muestran las redes que el negocio ya tiene capturadas (máximo 4)
update public.businesses set hero_links = jsonb_build_object('show',
  coalesce((select jsonb_agg(k) from (
     select k from unnest(array['whatsapp','instagram','facebook','tiktok']) with ordinality as t(k, o)
     where coalesce(contact->>k, '') <> '' order by o limit 4) s), '[]'::jsonb), 'custom', null);

alter table public.promotions alter column button_label set default 'Agregar';
update public.promotions set button_label = 'Agregar' where button_label in ('Agregar promoción', 'Agregar promo');

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
      'hero_title', b.hero_title, 'hero_text', b.hero_text, 'hero_button', b.hero_button, 'hero_action', b.hero_action, 'hero_links', b.hero_links,
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
