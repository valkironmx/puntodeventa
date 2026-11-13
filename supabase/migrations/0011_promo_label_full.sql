-- Botón de promociones: "Agregar promoción".
alter table public.promotions alter column button_label set default 'Agregar promoción';
update public.promotions set button_label = 'Agregar promoción' where button_label = 'Agregar promo';
