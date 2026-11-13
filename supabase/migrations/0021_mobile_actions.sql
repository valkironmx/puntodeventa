-- App del teléfono: cualquier cambio del panel hecho sin conexión se guarda como 'action'
alter table public.mobile_ops drop constraint mobile_ops_kind_check;
alter table public.mobile_ops add constraint mobile_ops_kind_check
  check (kind in ('sale', 'payment', 'delivered', 'preorder_update', 'quote', 'convert_quote', 'action'));
