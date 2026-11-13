-- Texto del botón de las promociones: corto, "Agregar promo".
alter table public.promotions alter column button_label set default 'Agregar promo';
update public.promotions set button_label = 'Agregar promo' where button_label in ('Agregar al pedido', 'Pedir ahora', 'Lo quiero', 'Agregar');
