-- Supabase Storage: buckets públicos para fotos (en tu Mac no existe el esquema storage y se omite).
-- Solo el servidor sube archivos (con la service role); el público solo puede verlos.
do $$ begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
      ('product-images', 'product-images', true, 5242880, array['image/webp', 'image/jpeg', 'image/png']),
      ('business-assets', 'business-assets', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
    on conflict (id) do update set public = true;
  end if;
end $$;
