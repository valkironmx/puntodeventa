# Plan de desarrollo · Plataforma SaaS de catálogo digital + punto de venta sencillo

> Documento maestro para desarrollar en local con Claude Code.
> Maqueta interactiva: `docs/maquetas/maqueta-catalogo.html` (ábrela en el navegador).
> Capturas por pantalla: `docs/maquetas/capturas/`. Referencia visual original: `docs/maquetas/referencia-visual.jpg`.
> Nombre comercial y dominio aún no definidos: usar `tuapp.com` como placeholder vía variable de entorno `NEXT_PUBLIC_APP_DOMAIN`.

---

## 1. Qué es

Plataforma multi-negocio (SaaS) que el super admin (Daniel) da de alta. Cada negocio obtiene:

1. **Catálogo / menú público** en `tuapp.com/{slug}`: una web ligera con portada personalizable y productos. Funciona en **3 modos de negocio**: Comida, Productos y Servicios (ver §6.0).
2. **Panel del negocio** con look de app móvil (Android / iPhone vía Capacitor) para:
   - administrar el catálogo;
   - cobrar con un punto de venta sencillo;
   - hacer cotizaciones y convertirlas en ventas con abonos;
   - hacer el corte de caja;
   - gestionar empleados;
   - imprimir tickets por Bluetooth;
   - gestionar su QR dinámico;
   - en modo Servicios, **agenda de citas con aprobación** (§8.11).
3. **Panel Super Admin** para:
   - dar de alta negocios;
   - controlar planes y vencimientos;
   - administrar los QR de todos los clientes.

**Fuera de alcance** (decidido): SEO y anuncios, modo offline, reportes avanzados, multi-sucursal, escaneo de código de barras, importación de Excel, CRM de clientes, facturación CFDI, **comanda de cocina** (posible fase futura) y recordatorios automáticos por la API de WhatsApp Business (fase futura; por ahora son semiautomáticos, ver §8.11).

---

## 2. Stack y decisiones técnicas

| Pieza | Decisión |
|---|---|
| Web | **Next.js** (App Router, TypeScript estricto, Server Actions), Tailwind CSS |
| UI | Componentes propios con Tailwind (shadcn/ui permitido como base). Tipografía **Plus Jakarta Sans** |
| Backend | **Supabase**: Postgres, Auth, Storage, RLS, funciones SQL (RPC), `pg_cron` |
| Repo | **GitHub**, un solo repo con la app Next.js + proyecto Capacitor |
| Hosting | **Vercel** (después de aprobar en local) |
| App móvil | **Capacitor** sobre la misma app. La app carga la URL desplegada (`server.url`) y añade plugins nativos: cámara/galería, guardar en galería, compartir e impresora Bluetooth |
| Validación | `zod` en cada Server Action |
| Tipos BD | `supabase gen types typescript` → `src/lib/database.types.ts` |
| Dinero | `numeric(12,2)` en BD. En TS usar enteros en centavos o una librería decimal; **nunca** floats para guardar |
| Zona horaria | `America/Mexico_City`. Formato `es-MX` y moneda MXN |
| Tests | Vitest para la lógica pura (IVA, slug, tamaños de QR, totales). Playwright e2e para los flujos clave (fase final) |

**Nota iOS:** Apple puede rechazar apps que solo envuelven una web (guía 4.2). Por eso la app debe usar funciones nativas reales: cámara para fotos de producto, guardar JPG en galería, impresión Bluetooth y compartir.

---

## 3. Roles y permisos

| Función | Cajero | Administrador | Dueño | Super Admin |
|---|:-:|:-:|:-:|:-:|
| Punto de venta (cobrar) | ✓ | ✓ | ✓ | — |
| Catálogo y productos (crear/editar) | — | ✓ | ✓ | ✓ |
| Cotizaciones, ventas y pagos | — | ✓ | ✓ | ✓ |
| Corte de caja | — * | ✓ | ✓ | — |
| Citas: aprobar o rechazar **sus propias** citas | ✓ | ✓ | ✓ | — |
| Citas: ver y aprobar **toda** la agenda, crear o reagendar | — | ✓ | ✓ | ✓ |
| Personalizar negocio, ticket, QR (destino) | — | ✓ | ✓ | ✓ |
| **Eliminar** cualquier cosa | — | — | ✓ | ✓ |
| Empleados y plan | — | — | ✓ | ✓ |
| Alta de negocios, planes, QR de todos (descargar / editar / borrar / regenerar) | — | — | — | ✓ |

\* **Decisión por defecto (confirmar con Daniel):** el cajero no hace el corte; lo cierra dueño o admin.

- El **cajero** al entrar va directo al punto de venta. Su menú lateral solo muestra "Punto de venta" y "Cerrar sesión".
- El **administrador** ve todo igual que el dueño, pero sin botones de eliminar. RLS también bloquea el `DELETE`.
- **PIN de 4 dígitos** por empleado, para turnarse rápido en un celular compartido (modo caja). Ver §8.7.

---

## 4. Rutas

```
/                         Landing de la plataforma (simple, fase final)
/login                    Login (email + contraseña) · /login/pin para modo caja
/{slug}                   Catálogo público del negocio (SSR/ISR)
/{slug}?p={productId}     Deep link que abre la ventana (modal) del producto
/q/{code}                 Redirección del QR dinámico (302, no-store)

/app                      Inicio del negocio (accesos rápidos)
/app/pos                  Punto de venta
/app/ventas, /app/ventas/{id}         Ventas y pagos (abonos)
/app/corte                Corte de caja (+ historial)
/app/catalogo             Lista de productos · /app/catalogo/nuevo · /app/catalogo/{id}
/app/categorias
/app/cotizaciones, /app/cotizaciones/nueva, /app/cotizaciones/{id}
/app/personalizar         Portada, logo, color, datos, contacto, ubicación, horario
/app/qr                   Mi código QR
/app/ticket               Diseño del ticket
/app/impresora            Conexión y configuración de impresora
/app/citas                Agenda: por aprobar + agenda del día (modo Servicios)
/app/citas/nueva · /app/citas/{id}
/app/citas/ajustes        Reglas, horario por persona, bloqueos y recordatorios
/{slug}/agendar           Reserva pública (cliente) → solicitud en espera de aprobación
/{slug}/cita/{token}      Estado de la solicitud y cancelación (link que recibe el cliente)
/app/empleados
/app/ajustes/impuestos    IVA global y tasa
/app/ajustes/campos       Campos personalizados

/super                    Super Admin: negocios
/super/negocios/nuevo     Alta de negocio
/super/negocios/{id}
/super/qr                 QRs de todos los clientes
```

**Slugs reservados** (no se pueden asignar a negocios): `app, super, q, login, api, admin, www, static, _next, assets, ayuda, soporte, terminos, privacidad, precios, planes` (ampliable).

---

## 5. Modelo de datos (Supabase / Postgres)

Todas las tablas de negocio llevan `business_id uuid not null references businesses(id) on delete cascade`, más `created_at` y `updated_at`. El borrado lógico usa `deleted_at` donde aplica.

```sql
-- Plataforma
platform_admins(user_id uuid pk references auth.users)

businesses(
  id uuid pk, slug text unique not null, name text not null,
  owner_email text not null, phone text,
  mode text not null default 'food' check (mode in ('food','retail','service')),  -- modo del negocio (§6.0)
  features jsonb default '{}',  -- overrides por función: {inventory:true, variants:true, modifiers:false, units:true, ...}
  plan text default 'basico', plan_expires_at date, status text default 'activo', -- activo | por_vencer | suspendido
  tagline text, logo_path text, hero_path text,
  hero_focal_x smallint default 50, hero_focal_y smallint default 50, -- punto de enfoque 0..100
  accent_color text default '#1F8A6B', accent_auto boolean default true,
  address text, maps_url text, lat numeric, lng numeric,
  contact jsonb default '{}',   -- {whatsapp, phone, instagram, facebook, tiktok, email, web}
  schedule jsonb default '[]',  -- [{days:'lun-vie', open:'08:00', close:'21:00', enabled:true}, ...]
  tax_mode_global text default 'included',  -- 'included' | 'plus'
  tax_rate numeric(5,2) default 16,         -- 16 | 8 (frontera) | 0
  custom_domain text unique
)

memberships(
  id uuid pk, business_id, user_id uuid references auth.users,
  role text check (role in ('owner','admin','cashier')),
  display_name text, pin_hash text, active boolean default true,
  unique(business_id, user_id)
)

-- Catálogo
categories(id, business_id, name, position int, visible bool default true)

products(
  id, business_id, category_id, name, description,
  kind text default 'product' check (kind in ('product','service')),   -- en modo Servicios pueden convivir ambos
  sale_unit text default 'pieza' check (sale_unit in ('pieza','kg','g','m','cm','l','ml')),
  price numeric(12,2) not null,            -- precio POR sale_unit (ej. $18 por m, $380 por kg)
  sale_price numeric(12,2),                -- check (sale_price is null or sale_price < price)
  price_from bool default false,           -- servicios: muestra "Desde $X"
  duration_min int,                        -- servicios: duración aproximada
  tax_mode text default 'global',  -- 'global' | 'included' | 'plus' | 'exempt'
  track_stock bool default true, stock numeric(12,3) default 0,   -- 3 decimales para kg, g y m
  show_in_catalog bool default true,       -- false = OCULTO AL PÚBLICO, pero sigue en POS, cotizaciones y sistema
  active bool default true,                -- false = desactivado en todo el sistema (sin borrar)
  featured bool default false, position int,
  custom_fields jsonb default '[]',  -- [{label:'Preparación', value:'5 min'}]
  deleted_at timestamptz
)
product_images(id, business_id, product_id, path text, position smallint check (position between 0 and 2))
  -- trigger: máximo 3 imágenes por producto; position 0 = principal
product_option_groups(id, business_id, product_id, name text, type text default 'modifier')  -- 'modifier' (Comida: tamaño, extras) | 'variant' (Productos: talla, color)
product_options(id, group_id, label text, price_delta numeric(12,2) default 0, position,
                track_stock bool default false, stock numeric(12,3) default 0, sku text)
  -- Productos: cada variante lleva su propio stock (tenis talla 26 = 3 pzas, talla 27 = 0 → agotada esa talla)
inventory_movements(id, business_id, product_id, option_id null, qty numeric(12,3), reason text, -- 'sale' | 'adjust' | 'cancel' | 'quote_sale'
                    ref_table text, ref_id uuid, created_by uuid)
  -- trigger: actualiza products.stock; nunca editar stock directo desde la UI de venta

-- Folios por negocio
business_counters(business_id, kind text, last_value int, primary key(business_id, kind))
  -- función next_folio(business_id, kind) con bloqueo de fila. kinds: 'sale' (V-0001), 'quote' (COT-0001)

-- Cotizaciones
quotes(
  id, business_id, folio int, client_name, client_phone, client_email,
  status text default 'pending', -- draft | pending | accepted | rejected | cancelled | expired | converted
  valid_days int default 15, issued_at date default current_date, expires_at date,
  prices_plus_tax bool default false,
  custom_fields jsonb default '[]',  -- campos especiales: [{label:'Lugar de entrega', value:'...'}]
  notes text, subtotal, tax, total numeric(12,2),
  converted_sale_id uuid, created_by, deleted_at timestamptz
)
quote_items(id, quote_id, product_id null, title, description, unit_price, qty numeric(12,3), sale_unit text default 'pieza', tax_mode, position)
  -- product_id null = "concepto libre" (título, descripción, precio, cantidad)

-- Ventas, pagos y caja
sales(
  id, business_id, folio int, source text,  -- 'pos' | 'quote'
  quote_id uuid, customer_name text,
  order_type text default 'mostrador',      -- 'mostrador' | 'comer_aqui' | 'para_llevar' | 'domicilio' | 'envio' | 'en_local'
  table_label text,                         -- Comida: "Mesa 4" (opcional)
  status text,                               -- 'paid' | 'partial' | 'pending' | 'cancelled'
  subtotal, tax, total, paid_total numeric(12,2) default 0,
  balance numeric(12,2) generated always as (total - paid_total) stored,
  cash_received numeric(12,2), change_given numeric(12,2),
  cash_session_id uuid, created_by uuid
)
sale_items(id, sale_id, product_id, option_id null, title, unit_price, qty numeric(12,3), sale_unit text, options jsonb, notes text, tax_mode, line_subtotal, line_tax, line_total)
payments(id, business_id, sale_id, amount numeric(12,2) check (amount > 0),
         method text check (method in ('cash','card','transfer')),
         note text, cash_session_id uuid, received_by uuid)
  -- trigger: recalcula sales.paid_total y status. Un pago "mixto" en POS = 2 filas
cash_sessions(id, business_id, device_label, opened_by, opened_at, opening_float numeric(12,2),
              closed_by, closed_at, expected_cash, counted_cash, difference, notes)
cash_movements(id, business_id, cash_session_id, type text check (type in ('in','out')), amount, reason, created_by)

-- QR dinámico
qr_codes(
  id, business_id, code text unique not null,     -- inmutable, 7 caracteres base62 sin ambiguos (0,O,1,l,I)
  destination_type text default 'catalog',        -- 'catalog' | 'whatsapp' | 'custom'
  destination_url text,                            -- requerido si custom
  active bool default true, scans_count int default 0,
  replaced_by uuid references qr_codes(id), deleted_at timestamptz
)
qr_scans(id, qr_id, scanned_at, user_agent text)   -- opcional; mínimo incrementar scans_count

-- Agenda de citas (modo Servicios)
booking_settings(
  business_id pk, online_enabled bool default true,
  requires_approval bool default true,          -- default: las citas en línea quedan "en espera de aprobación"
  approvers text default 'owner_admin_assignee', -- 'owner_admin' | 'owner_admin_assignee'
  approval_timeout_min int default 120,          -- si nadie responde, se libera el horario y se avisa
  slot_interval_min int default 30 check (slot_interval_min in (15,30,60)),
  min_notice_min int default 120, max_days_ahead int default 30,
  cancel_until_min int default 120, buffer_min int default 0,
  reminder_24h bool default true, reminder_2h bool default true,
  reminder_template text
)
staff_schedules(id, business_id, membership_id, weekday smallint check (weekday between 0 and 6),
                start_time time, end_time time, break_start time, break_end time, enabled bool default true)
schedule_blocks(id, business_id, membership_id null, starts_at timestamptz, ends_at timestamptz, reason text)
  -- membership_id null = bloqueo para todo el negocio (ej. 25 dic)
appointments(
  id, business_id, product_id,                 -- servicio (products.kind='service')
  membership_id,                               -- persona asignada
  customer_name text, customer_phone text, notes text,
  starts_at timestamptz, ends_at timestamptz,  -- ends_at = starts_at + duration_min
  price numeric(12,2),
  status text default 'pending',               -- pending | confirmed | rejected | cancelled | completed | no_show | expired
  source text default 'online',                -- 'online' | 'panel'
  public_token text unique,                    -- link del cliente para ver o cancelar
  hold_expires_at timestamptz,                 -- pending: fecha límite de aprobación
  decided_by uuid, decided_at timestamptz, reject_reason text,
  sale_id uuid,                                -- si se cobró en el POS
  exclude using gist (membership_id with =, tstzrange(starts_at, ends_at) with &&)
    where (status in ('pending','confirmed'))  -- evita doble reserva (extensión btree_gist)
)
appointment_events(id, appointment_id, type text, created_by uuid null, created_at)  -- historial

-- Ticket
ticket_settings(
  business_id pk,
  show_logo bool default true, header_name text,
  show_address bool default true, address_text text,
  show_phone bool default true, phone_text text,
  show_tax_breakdown bool default true, show_payment bool default true, show_cashier bool default true,
  thanks_message text default '¡Gracias por su compra!',
  show_qr bool default true, qr_text text default 'Escanee para ver nuestro menú',
  footer_text text,
  paper_width smallint default 58 check (paper_width in (58,80)),
  auto_print bool default true, open_cash_drawer bool default false,
  printer_name text, printer_address text
)
```

### 5.1 RLS (obligatorio en todas las tablas)

- Funciones helper `security definer`:
  - `is_super_admin()`;
  - `member_role(business_id) returns text`;
  - `is_member(business_id)`.
- **SELECT:** miembros del negocio y super admin. El público (anon) solo lee estos datos, a través de una vista o RPC `public_catalog(slug)`:
  - `businesses`: solo columnas públicas;
  - `categories` visibles y `products` con `show_in_catalog = true`, `active = true` y sin `deleted_at`. **Un producto oculto al público nunca sale en la vista o RPC pública**, aunque sí en el POS y en el panel;
  - `product_images` y `product_options`.
- **INSERT / UPDATE:**
  - owner y admin en catálogo, cotizaciones, personalización, ticket y qr (solo `destination_*`);
  - cashier solo en `sales`, `sale_items` y `payments` de origen POS, vía RPC.
- **DELETE:** solo owner y super admin. El admin **no** puede borrar.
- Columnas sensibles (`qr_codes.code`, `businesses.slug`, `plan*`, `status`): solo super admin, vía RPC.
- Storage:
  - buckets `business-assets` (logo y portada) y `product-images`;
  - ruta `{business_id}/...`;
  - lectura pública;
  - escritura solo para miembros con rol owner o admin.

### 5.2 Lógica en Postgres (RPC, transaccional)

| Función | Qué hace |
|---|---|
| `create_business(name, slug, owner_email, phone, business_type, plan)` | Solo super admin. Crea negocio, `ticket_settings`, contadores, categorías sugeridas según el giro y el QR dinámico. La invitación del dueño se manda desde la Server Action con la service role (`auth.admin.inviteUserByEmail`), y luego se crea su membership `owner` |
| `register_pos_sale(business_id, items, payments, cash_received, customer_name)` | Calcula totales **en servidor**, asigna folio, inserta venta, partidas y pagos, y descuenta inventario. Devuelve folio y totales |
| `convert_quote_to_sale(quote_id, initial_payment jsonb null)` | Crea la venta `source='quote'` con estatus pending o partial, copia partidas, descuenta stock de las partidas con producto, marca la cotización `converted` y guarda `converted_sale_id` |
| `add_payment(sale_id, amount, method, note)` | No permite pagar más del saldo. Actualiza estatus a `paid` cuando el saldo llega a 0 |
| `close_cash_session(session_id, counted_cash, notes)` | Calcula esperado = fondo + pagos en efectivo de la sesión + entradas − retiros. Guarda la diferencia |
| `next_folio(business_id, kind)` | Folio consecutivo por negocio |
| `available_slots(business_id, product_id, membership_id null, date)` | Pública. Calcula horarios libres: horario de la persona, menos descanso, bloqueos, citas `pending` y `confirmed`, anticipación mínima, días máximos e intervalo. Con "cualquiera", une los horarios de todas las personas |
| `request_appointment(slug, product_id, membership_id null, starts_at, name, phone, notes)` | Pública (anon). Revalida disponibilidad dentro de la transacción y crea la cita `pending` con `hold_expires_at`, o `confirmed` si no requiere aprobación. Asigna persona si eligió "cualquiera". Devuelve `public_token`. Límite de solicitudes por teléfono e IP (antispam) |
| `decide_appointment(id, decision, reason)` | Aceptar → `confirmed`; rechazar → `rejected`. Permiso: owner o admin siempre; cashier solo si es la persona asignada y `approvers` lo permite |
| `pg_cron` cada 5 min | Citas `pending` con `hold_expires_at < now()` pasan a `expired` y liberan el horario |
| `regenerate_qr(qr_id)` | Solo super admin. Crea un código nuevo, desactiva el anterior (`active=false`, `replaced_by`) |
| `pg_cron` diario | Cotizaciones `draft` o `pending` con `expires_at < hoy` pasan a `expired`. Papelera: purga cotizaciones con `deleted_at` mayor a 30 días |

---

## 6. Reglas de negocio clave

### 6.0 Modos de negocio (Comida · Productos · Servicios)

Una sola plataforma. `businesses.mode` cambia las **palabras**, los **valores por defecto** y qué **funciones** se muestran. **No** cambia la base de datos ni borra información al cambiar de modo.

| | 🍽️ Comida (`food`) | 🛍️ Productos (`retail`) | ✂️ Servicios (`service`) |
|---|---|---|---|
| Para quién | Restaurantes, cafeterías, taquerías, panaderías, postres, food trucks | Ropa, tenis, accesorios, ferretería, papelería, regalos, cualquier producto físico | Barberías, estéticas, talleres, despachos, lavado de autos |
| Palabras | Menú · Platillos | Catálogo · Productos | Servicios · Catálogo de servicios |
| Carrito del cliente | **Mi pedido** | **Mi pedido** | **Mi pedido** |
| Opciones | Modificadores: tamaño, extras (+$), notas por platillo | **Variantes con stock propio**: talla, color, modelo | Opciones (ej. barbero, nivel) |
| Unidad de venta | Pieza, kg, g, L | **Pieza, kg, g, m, cm** | Servicio (y pieza para productos que también vendan) |
| Inventario | Apagado por defecto | Encendido por defecto | Servicios sin inventario; productos con inventario |
| Precio | Normal / rebajado | Normal / rebajado, por unidad | Normal / rebajado y **"Desde $X"** |
| Extra en la ficha | — | "Quedan 3" | Duración aprox. ("45 min") |
| Tipo de entrega / venta | **Mostrador** · Comer aquí · Para llevar · A domicilio | **Mostrador** · Envío a domicilio | En el local · A domicilio |
| POS | Notas por platillo, "Mesa / nombre" opcional | Selector de variante, captura de cantidad con decimales | Selector de opción (barbero) |
| Ticket (pie sugerido) | — | Política de cambios | Política de cancelación |
| Categorías sugeridas | Desayunos, Comidas, Bebidas, Postres | Novedades, Ofertas, + las del giro | Cortes, Paquetes, Productos |
| Campos personalizados sugeridos | Preparación, Contiene (alérgenos), Picante | Material, Garantía, SKU, Medidas | Incluye, Recomendado cada… |
| Cotizaciones | Eventos y banquetes | Mayoreo y pedidos especiales | Paquetes y eventos |

- **Dónde se elige:**
  1. En el alta, por el super admin.
  2. En el **paso 1 del asistente** del dueño ("¿Qué vendes?", 3 tarjetas, preseleccionado).
  3. Después, en **Ajustes → Tipo de negocio** (avisa que solo cambia presentación y valores por defecto).
- **Casos mixtos:** en **Ajustes → Funciones** se encienden o apagan funciones sueltas (inventario, variantes, modificadores, unidades, duración) sin cambiar de modo. Se guarda en `businesses.features`.
- **Implementación:**
  - `src/lib/terms.ts`: diccionario de palabras por modo. **Prohibido** poner textos fijos tipo "Menú" o "Productos" en componentes.
  - `src/lib/mode-defaults.ts`: categorías, campos sugeridos, tipos de entrega, funciones encendidas y pie de ticket.
  - `useBusinessMode()` / `getTerms(business)` en cliente y servidor.

### 6.0.1 Unidades de venta (pieza, kg, g, m, cm, L)
- El `price` es **por unidad**. En el catálogo se muestra "$18 /m" o "$380 /kg".
- En POS, cotizaciones y venta por WhatsApp, si la unidad no es pieza se abre un **teclado numérico con decimales** (1.5 m, 0.250 kg). Para kg y g se ofrece el atajo de capturar el **importe** ("$100 de café") y calcular la cantidad.
- `qty numeric(12,3)`. Redondeo del importe a 2 decimales por línea. El stock se descuenta en la misma unidad.
- Ticket y cotización muestran "1.5 m × $18 = $27".
- Conversión g↔kg: el producto se configura en una sola unidad; no se convierte automático entre unidades distintas.

### 6.0.2 Ocultar al público
- Cada producto, platillo o servicio tiene **"Mostrar en el catálogo público"** (`show_in_catalog`). Apagado:
  - no aparece en `tuapp.com/{slug}`, ni en el buscador, ni en el deep link `?p=` (devuelve 404);
  - **sí aparece** en el punto de venta, las cotizaciones, el panel y los reportes, con un ícono de ojo tachado y la etiqueta "Solo en sistema";
  - ejemplos: "Cargo por envío", "Bolsa de regalo", "Bebida de cortesía".
- Es distinto de **Activo** (`active`): apagado lo desactiva en todo el sistema, sin borrarlo.
- En la lista del catálogo admin hay un interruptor rápido "Público" por fila.

### 6.1 IVA (cálculo único compartido)

- Archivo `src/lib/tax.ts` con tests. El servidor usa la misma lógica, o la equivalente en SQL.
- Tasa del negocio: `tax_rate` (16 por defecto; opciones 16, 8 y 0).
- El modo efectivo de un producto es `product.tax_mode`. Si vale `global`, se usa `business.tax_mode_global`.
- Por línea, con `p` = precio unitario final capturado (rebajado si existe) × cantidad:
  - **included:** `total = p`, `base = p / (1 + r)`, `iva = total − base`.
  - **plus:** `base = p`, `iva = p × r`, `total = base + iva`.
  - **exempt:** `base = p`, `iva = 0`, `total = p`.
- Documento: `subtotal = Σ base`, `iva = Σ iva`, `total = Σ total`. Redondear a 2 decimales **por línea** y sumar.
- En el catálogo público el precio mostrado siempre es el **precio final al público** (con IVA). Debajo dice "Precio con IVA incluido".
- Cotización: el switch "Precios + IVA" (`prices_plus_tax`) aplica el modo `plus` a todas sus partidas. Apagado aplica `included`.
- Por defecto todo es **IVA incluido**.

### 6.2 Precio rebajado

- `sale_price` es opcional y debe ser menor que `price`.
- Si existe, se muestra `sale_price` grande, `price` tachado y el badge `-NN%`.
- Ventas y cotizaciones usan `sale_price` cuando existe.

### 6.3 Slug del negocio

- `slugify`: normalizar NFD, quitar diacríticos, minúsculas, eliminar todo lo que no sea `[a-z0-9]`. Sin espacios ni guiones.
  - Ejemplos: `Café La Luna` → `cafelaluna`; `Tacos El Güero` → `tacoselguero`.
- Validar contra los slugs reservados y los existentes. Si está ocupado, sugerir `{slug}2`, `{slug}3`…
- Vista previa en vivo en el alta: "tuapp.com/cafelaluna · disponible".
- El dominio propio (`custom_domain`) es fase posterior: middleware que mapea host → negocio, con dominios agregados vía la API de Vercel.

### 6.4 Imágenes

- **Producto:** máximo **3** fotos. La primera es la principal. Se reordenan arrastrando.
- **Portada (hero):** 1 imagen. `object-fit: cover` con `object-position` en el punto de enfoque elegido. Degradado oscuro automático para que el texto siempre se lea.
- Color de acento automático tomado del color dominante de la portada (`fast-average-color`), o elegido de una paleta.
- **Logo:** PNG con transparencia recomendado.
- Compresión en el cliente antes de subir: producto máx. 1600 px, portada máx. 2000 px, WebP/JPEG calidad ~80 (`browser-image-compression`).

### 6.5 Descargas como imagen (no PDF)

- Cotizaciones, estado de cuenta de una venta y QR se descargan como **JPG o PNG**, para guardarse en la galería.
- Implementación: componente de render dedicado a ancho fijo (1080 px), exportado con `html-to-image` (`toJpeg`).
- Web: descarga directa.
- App: guardar en galería con un plugin de Capacitor de medios/filesystem, y compartir con `@capacitor/share`, por ejemplo a WhatsApp.

---

## 7. Diseño (de la maqueta)

- Tokens:
  - primario `#1F8A6B`;
  - tinta `#16211D`;
  - texto secundario `#6B7A74`;
  - fondo `#F5F7F6`;
  - borde `#E4EAE7`;
  - rojo de oferta `#E5484D`.
- Radios: 12 (inputs), 16–18 (tarjetas), 22–28 (hojas y paneles). Tipografía Plus Jakarta Sans 400–800.
- El color primario de cada negocio se inyecta como variable CSS `--g` (acento) y su tinte `--g2 = color-mix(var(--g) 12%, white)`.
- **Catálogo público (web):**
  - portada a sangre (~310 px de alto) con logo, nombre, eslogan y estado "Abierto/Cerrado" según el horario;
  - el contenido sube con esquinas redondeadas sobre la portada;
  - botones de contacto (WhatsApp, llamar, cómo llegar, Instagram);
  - buscador, chips de categorías y grid de 2 columnas;
  - al tocar un producto se abre una **ventana modal** con galería de 3 fotos, precio y opciones;
  - carrito flotante; "Mi pedido" se envía por **WhatsApp** (`wa.me` con mensaje armado: productos, opciones, cantidades, total, nombre y tipo de entrega).
- **Panel del negocio (app):**
  - barra superior con ☰ que abre la **barra lateral izquierda**;
  - el inicio tiene **solo accesos rápidos**: "Punto de venta" destacado, y Catálogo, Cotizaciones, Ventas y pagos, Corte de caja, Personalizar, Empleados, Impresora y Código QR. Sin métricas ni tarjetas;
  - cada botón lleva a su sección.
- La maqueta HTML es la referencia de layout, textos y comportamiento. Las capturas en `docs/maquetas/capturas/` están numeradas en orden de flujo.

---

## 8. Módulos (requisitos y criterios de aceptación)

### 8.1 Super Admin · alta de negocio
- Campos: nombre, correo del dueño, teléfono, giro (precarga categorías sugeridas) y plan (Básico, Pro o prueba de 15 días).
- Al crear:
  - se reserva el slug;
  - se crea el QR dinámico apuntando al catálogo;
  - se crea `ticket_settings`;
  - se envía la invitación por correo; el dueño crea su contraseña y entra a un panel **en blanco** con un asistente de 5 pasos: **¿qué vendes? (modo)**, portada, logo, contacto y primer producto.
- Lista de negocios con estatus (Activo, Por vencer, Suspendido) y vencimiento. Un negocio suspendido muestra página "no disponible" en su catálogo.
- Campo **Modo del negocio**: Comida, Productos o Servicios. Sustituye al antiguo "giro" y precarga categorías y valores por defecto.
- ✅ Crear "Café La Luna" deja `tuapp.com/cafelaluna` funcionando, vacío y listo para configurar.

### 8.2 Catálogo (admin)
- CRUD de categorías, con orden y visible u oculto.
- CRUD de productos:
  - nombre, categoría, descripción y hasta 3 fotos;
  - **unidad de venta** según el modo (pieza, kg, g, m, cm, L);
  - en Servicios: **duración** y **precio fijo o "Desde"**;
  - precio normal y precio rebajado;
  - modo de IVA: Global, Incluido, + IVA o Exento, con cálculo en vivo y vista previa del precio al público;
  - control de stock y existencias;
  - opciones o variantes con precio extra;
  - **campos personalizados** (etiqueta y valor);
  - **visibilidad**: mostrar en el catálogo público, destacado y activo (§6.0.2);
  - opciones: en Productos son **variantes con stock propio**; en Comida, modificadores.
- Agotado automático cuando `track_stock` está activo y stock ≤ 0: aparece como "Agotado" en catálogo y POS y no se puede agregar.

### 8.3 Catálogo público
- SSR con revalidación por tag cuando cambian productos o personalización.
- Horario: calcula "Abierto · cierra 9:00 pm" o "Cerrado · abre 8:00 am" en zona del negocio.
- Ventana de producto (modal) con galería deslizable de hasta 3 fotos y puntos indicadores. URL `?p=id` compartible.
- Carrito **"Mi pedido"** en `localStorage` por negocio, con tipo de entrega según el modo (§6.0; "Mostrador" disponible en Comida y Productos).
- Solo muestra productos con `show_in_catalog = true` y `active = true`.
- Servicios: el botón dice "Agregar" y el mensaje de WhatsApp sirve para pedir cita. No hay sistema de agenda.
- Meta tags Open Graph (nombre, eslogan, portada) para que se vea bien al compartir.

### 8.4 Personalizar negocio
- Portada: subir y cambiar imagen, y **tocar para elegir el punto de enfoque** (se guardan `hero_focal_x` y `hero_focal_y`).
- Logo, color de acento (automático o paleta), nombre y eslogan.
- Contacto: WhatsApp, teléfono, Instagram y Facebook, más "agregar otro" (TikTok, correo, web).
- Ubicación: dirección, "usar mi ubicación actual" y link de Google Maps.
- Horario por días, con switch de abierto o cerrado.

### 8.5 QR dinámico
- **Uno por negocio, se genera una sola vez** al crear el negocio. El `code` es inmutable.
- URL impresa: `tuapp.com/q/{code}`. La ruta `/q/[code]`:
  - busca el código activo y no borrado;
  - responde **302** al destino con `Cache-Control: no-store`;
  - incrementa `scans_count` sin bloquear la respuesta;
  - si el código no existe o está inactivo, muestra la página "Este código ya no está activo".
- Destinos:
  - `catalog`, que resuelve `https://{dominio}/{slug}` en el momento;
  - `whatsapp` (`wa.me/52…`);
  - `custom` (URL validada `https://`).
- **Dueño o admin:** solo pueden cambiar el destino, ver los escaneos y descargar. No pueden borrar ni regenerar.
- **Super Admin (`/super/qr`):** ve los QR de todos los negocios con buscador, y puede **descargar, editar el destino, borrar (lógico) y generar uno nuevo**. Generar uno nuevo pide confirmación con el texto "los QR ya impresos dejarán de funcionar".
- **Descarga en PNG, SVG o JPG con margen blanco de protección de 3 mm SIEMPRE**:
  - generar la matriz con la librería `qrcode`, nivel de corrección **M**, `margin: 0`, y añadir nosotros el margen;
  - tamaños: 3, 5 o 10 cm de QR; el lado total es `S×10 + 6` mm (3 mm por lado);
  - **SVG:** `width/height` en `mm`, `viewBox` con el margen incluido y fondo blanco explícito (`<rect>`);
  - **PNG / JPG:** a 300 dpi, `px = round(mm / 25.4 × 300)`; margen = `round(3 / 25.4 × 300)` = 35 px por lado (proporcional si cambia el dpi). JPG con fondo blanco sólido; PNG también blanco, sin transparencia.
  - Test unitario que verifique el margen en los 3 formatos y tamaños.
  - ⚠️ Nota técnica: el estándar QR recomienda un margen de 4 módulos. En un QR de 3 cm, 3 mm queda por debajo de eso, aunque en la práctica escanea bien. El requisito de Daniel es 3 mm fijos: respetarlo, y probar el escaneo con varios teléfonos.
- El QR del ticket es este mismo QR dinámico.

### 8.6 Cotizaciones
- Folio `COT-0001` por negocio. Cliente (nombre, teléfono, correo) y **campos especiales** (etiqueta y valor).
- Partidas: del catálogo o **concepto libre** (título, descripción, precio, cantidad).
- Switch "Precios + IVA" con desglose: subtotal, IVA y total.
- Estatus: Borrador, En espera, Aceptada, Rechazada, Cancelada, Vencida (automática) y Convertida (automática).
- Vigencia en días (15 por defecto), con fecha de vencimiento visible. Al vencer cambia sola a "Vencida".
- Acciones:
  - **Convertir en venta**;
  - Descargar **JPG**;
  - enviar por WhatsApp (compartir la imagen);
  - duplicar y editar;
  - eliminar (solo dueño), que manda a la **papelera 30 días**.
- Lista con filtros por estatus: Todas, En espera, Aceptadas, Convertidas, Vencidas, Canceladas y Papelera.

### 8.7 Punto de venta (sencillo)
- Grid de productos de 3 columnas con buscador y chips de categoría. **Incluye los productos ocultos al público.** Tocar un producto suma 1 (badge de cantidad). Si se vende por kg, g, m o cm, abre el teclado de cantidad con decimales.
- Tipo de venta por defecto: **Mostrador**. Se puede cambiar según el modo (§6.0).
  - Si el producto tiene opciones, abre un selector rápido.
  - Tile "Monto libre" para cobrar un concepto y monto libres.
- Barra inferior "Cobrar $X". Hoja de cobro:
  - ajustar cantidades;
  - método: efectivo, tarjeta, transferencia o mixto;
  - en efectivo: monto recibido, botones rápidos (Exacto, $200, $500) y **cambio** calculado;
  - desglose de IVA y total.
- **Registrar venta** → pantalla **"Venta registrada"** con folio, total y cambio, y botones Reimprimir, WhatsApp y Nueva venta. **Regresa sola a una venta nueva en 3 s.**
- Si la impresión automática está activa, imprime el ticket al registrar.
- Requiere una sesión de caja abierta. Si no hay, pide abrir caja con el fondo inicial.
- **Modo caja compartida (PIN):** el dueño inicia sesión en el dispositivo y lo marca como "caja". Los empleados cambian de usuario con su PIN de 4 dígitos (`pin_hash` con bcrypt vía `pgcrypto`, verificado en RPC con límite de intentos). Cada venta registra `created_by` con el empleado activo.

### 8.8 Ventas y pagos (abonos)
- Lista de ventas con filtro: todas, pagadas, con saldo y canceladas.
- Detalle de venta (de POS o convertida de una cotización):
  - tarjeta con **Falta por liquidar**, barra de avance, total, pagado y porcentaje;
  - **Registrar pago**: monto (no más que el saldo), botón "Liquidar todo", método y nota;
  - historial de pagos (fecha, método, nota y quién lo recibió);
  - estado de cuenta en **JPG**.
- Estatus automático: pendiente, pago parcial o liquidada.
- Cancelar una venta (solo dueño): estatus `cancelled` y movimientos de inventario de reversa.

### 8.9 Corte de caja
- Turno: quién abrió, a qué hora y en qué caja.
- Ventas del turno por método y total.
- Abonos recibidos.
- **Decisión por defecto (confirmar):** los abonos en efectivo **sí suman** al efectivo esperado del turno en que se reciben.
- Efectivo esperado = fondo + efectivo de ventas + abonos en efectivo + entradas − retiros.
- Registrar entrada o retiro con motivo.
- Efectivo contado: muestra la **diferencia** al instante (cuadra, sobrante o faltante).
- Cerrar caja: guarda la sesión e imprime el ticket de corte. Historial de cortes.

### 8.10 Empleados
- Lista con rol (Dueño, Administrador, Cajero) y estado.
- Dar acceso: nombre, correo o teléfono, rol y PIN. Se manda invitación.
- Tabla de permisos visible (la de §3). Activar o desactivar empleado.
- Límite de empleados según el plan (ej. Básico 2, Pro 5).

### 8.11 Agenda de citas (modo Servicios) — ver la sección 3 de la maqueta
- Se activa con el modo Servicios. En otros modos se puede encender desde Ajustes → Funciones.
- **Cliente (web):**
  - en el catálogo aparece el botón **"Agendar cita"**;
  - 5 pasos: servicio → con quién ("Cualquiera" o persona) → día (tira de 7 días) → hora → nombre y WhatsApp;
  - **solo se muestran horarios libres**, de `available_slots`;
  - al enviar aparece **"¡Solicitud enviada!"** con la etiqueta **"En espera de aprobación"** y el aviso "Apartamos este horario para ti";
  - el cliente recibe un link (`/{slug}/cita/{token}`) para ver el estado o cancelar hasta X horas antes.
- **Dueño o empleado (app) — lista grande y simple, sin calendario de columnas:**
  - tira de días arriba y filtro por persona;
  - sección **"Por aprobar"** con tarjetas amarillas grandes: hora, servicio, precio, cliente, "solicitada hace N min" y botones grandes **Rechazar / Aceptar**;
  - debajo, **"Agenda del día"** en lista cronológica, con color por estatus y la línea "Ahora";
  - el empleado ve y aprueba sus citas; dueño y admin ven y aprueban todo;
  - **detalle de cita:**
    - si está pendiente: Aceptar o Rechazar (motivo opcional) y escribir por WhatsApp;
    - si está confirmada: **Cobrar en punto de venta** (abre el POS con el servicio cargado y liga `sale_id`), marcar como completada, reagendar, no asistió o cancelar;
    - historial de eventos;
  - **nueva cita desde el panel:** cliente, servicio, persona, día y horarios libres (los ocupados aparecen tachados). Queda `confirmed` directamente;
  - **badge** con el número de solicitudes por aprobar en el menú lateral y en el botón "Agenda" del inicio.
- **Configurar agenda:**
  - citas en línea encendidas o apagadas;
  - "Requieren aprobación" (default) o "Se aceptan solas";
  - quién aprueba;
  - tiempo para responder (2 h por defecto, después se libera);
  - intervalo de 15, 30 o 60 min;
  - anticipación mínima, días hacia adelante, límite para cancelar y tiempo entre citas;
  - horario y descanso por persona;
  - días bloqueados.
- **Notificaciones (decidido: semiautomáticas, sin costo):**
  - al negocio: notificación push en la app (Capacitor Push / FCM) y badge, más correo opcional, cuando llega una solicitud;
  - al cliente: al aceptar, rechazar o recordar, el panel muestra **"Avisar por WhatsApp"**, que abre `wa.me` con el mensaje ya escrito desde la plantilla (`{cliente}`, `{día}`, `{hora}`, `{servicio}`, `{negocio}`, `{link}`);
  - lista "Recordatorios de hoy" para mandarlos con un toque.
  - **Fase futura (plan Pro):** envío automático con la API de WhatsApp Business (Meta), que cobra por mensaje y requiere registrar un número.
- ✅ Una solicitud del cliente aparece al instante en "Por aprobar" (Supabase Realtime). Dos clientes no pueden apartar el mismo horario (constraint `exclude`). Al vencer el tiempo de aprobación, el horario vuelve a estar libre.

### 8.12 Ticket (diseño editable, control total)
- Diseño moderno en **blanco y negro**, según la maqueta:
  - logo opcional, nombre y dirección/teléfono;
  - folio y fecha/hora en líneas simples (sin tabla);
  - partidas con la cantidad como número simple (sin cuadro de fondo), nombre, precio unitario e importe;
  - desglose de IVA;
  - **TOTAL en barra negra** con texto blanco;
  - pago y cambio;
  - pie con QR dinámico + mensaje + texto del QR + URL;
  - texto adicional (ej. políticas) y "le atendió".
- Pantalla `/app/ticket` con vista previa en vivo y controles:
  - mostrar u ocultar logo, dirección, teléfono, desglose de IVA, pago/cambio, QR y quién atendió;
  - editar nombre en ticket, dirección, teléfono, mensaje de agradecimiento, texto del QR y texto adicional.
- Anchos: 58 mm (384 dots) y 80 mm (576 dots).
- El mismo componente sirve también para el ticket de corte de caja (variante).

### 8.13 Impresión
- **App (Capacitor) por Bluetooth:**
  - el ticket se renderiza como **imagen** (canvas al ancho en dots), se convierte a monocromo con dithering y se envía como raster ESC/POS (`GS v 0`). Así salen el logo, la tipografía y la barra negra;
  - fallback a modo texto ESC/POS con codepage para acentos y ñ (CP858/CP1252);
  - abrir cajón: `ESC p`.
- **Compatibilidad:**
  - impresoras térmicas **ESC/POS** de 58 y 80 mm (la gran mayoría: PT-210, MTP-II, Xprinter, Epson móviles, etc.);
  - **Android:** Bluetooth clásico (SPP) y BLE;
  - **iPhone:** solo **BLE** o MFi (muchas impresoras baratas solo son SPP y no funcionan en iOS);
  - evaluar plugin: `@capacitor-community/bluetooth-le` para BLE, más un plugin o módulo nativo propio para SPP en Android;
  - documentar 1 o 2 modelos recomendados que funcionen en ambos.
- **Web (escritorio):** imprimir con `window.print()` y CSS `@page { size: 58mm auto }` o 80mm, para impresoras USB instaladas en la computadora.
- Pantalla `/app/impresora`:
  - buscar impresoras, conectar y olvidar;
  - ancho de papel;
  - imprimir automático al registrar venta;
  - logo en el ticket (se imprime en B/N);
  - abrir cajón;
  - imprimir prueba;
  - vista previa con link a "Editar diseño".

---

## 9. Desarrollo local (Mac)

**Requisitos:** Node 20+, pnpm, Git, **Docker Desktop**, **Supabase CLI** (`brew install supabase/tap/supabase`).

```bash
pnpm create next-app@latest .      # TS, App Router, Tailwind, src/, alias @/*
supabase init
supabase start                      # levanta Postgres/Auth/Storage locales (Studio en http://localhost:54323)
# copiar API URL, anon key y service_role key a .env.local
supabase migration new init         # SQL en supabase/migrations/
supabase db reset                   # aplica migraciones + supabase/seed.sql
supabase gen types typescript --local > src/lib/database.types.ts
pnpm dev
```

**`.env.local`**
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # solo servidor
NEXT_PUBLIC_APP_DOMAIN=localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Seed (`supabase/seed.sql`):**
- 1 super admin;
- 2 negocios demo iguales a la maqueta:
  - **Café La Luna** (`cafelaluna`, modo Comida): incluye café en grano por kg y "Cargo por envío" oculto al público;
  - **Nómada Store** (`nomadastore`, modo Productos): incluye paracord por metro, tenis con variantes de talla con stock y "Bolsa de regalo" oculta;
  - **Barbería Don Beto** (`barberiadonbeto`, modo Servicios): servicios con duración y "Desde", más pomada como producto; 2 barberos (Beto y Luis) con horarios, citas del día y 2 solicitudes por aprobar;
- cada uno con categorías, opciones, 1 cotización y 1 venta convertida con anticipo del 50%;
- usuarios demo: dueño, admin y cajero (PIN 1234);
- los correos locales se ven en Inbucket o Mailpit (`supabase status`).

**Estructura sugerida**
```
src/app/(public)/[slug]/...     catálogo público
src/app/q/[code]/route.ts       redirección QR
src/app/app/...                 panel del negocio (layout con drawer)
src/app/super/...               super admin
src/components/ui|catalog|pos|ticket|qr/...
src/lib/{supabase,tax,slug,qr,money,format,permissions}.ts
supabase/{migrations,seed.sql}
mobile/ (capacitor.config.ts, android/, ios/)   ← fase 8
docs/                                            ← este plan y maquetas
```

**Despliegue (al aprobar):**
1. `supabase link` + `supabase db push` al proyecto en la nube.
2. Importar el repo en Vercel con las variables de entorno.
3. Configurar SMTP propio en Supabase Auth para las invitaciones.
4. `pg_cron` activado en el proyecto.

---

## 10. Fases (en orden, cada una termina funcionando y probada)

- [ ] **F0 · Base:**
  - repo, Next.js, Tailwind, tokens de diseño, fuente;
  - Supabase local, cliente server/browser, middleware de sesión;
  - layout del panel (app bar + drawer izquierdo) y layout público.
- [ ] **F1 · Multi-tenant y auth:**
  - tablas `businesses`, `memberships` y `platform_admins` con RLS y helpers;
  - login;
  - Super Admin: lista y alta de negocio (slug en vivo, reservados, invitación), asistente inicial del negocio.
- [ ] **F2 · Modos + catálogo:**
  - `mode` y `features`, `terms.ts`, `mode-defaults.ts`, paso "¿Qué vendes?";
  - categorías y productos (3 fotos, unidad de venta, rebajado, IVA, stock, modificadores o variantes con stock, duración, campos personalizados, ocultar al público);
  - `src/lib/tax.ts` con tests;
  - catálogo público con portada, modal de producto y pedido por WhatsApp.
- [ ] **F3 · Personalizar + QR dinámico:**
  - portada con punto de enfoque, logo, color, contacto, ubicación y horario;
  - `qr_codes`, ruta `/q/[code]`;
  - pantalla "Mi código QR";
  - `/super/qr`;
  - exportación PNG/SVG/JPG con 3 mm (con tests).
- [ ] **F4 · Cotizaciones:**
  - CRUD, conceptos libres, campos especiales, estatus, vigencia y `pg_cron`;
  - papelera, exportación JPG y WhatsApp.
- [ ] **F5 · Ventas:**
  - sesiones de caja, POS completo con pantalla "Venta registrada" y regreso en 3 s;
  - `register_pos_sale`, `convert_quote_to_sale`, `add_payment`;
  - ventas y pagos, corte de caja.
- [ ] **F6 · Empleados:**
  - invitaciones, roles, permisos en UI y RLS (admin sin borrar, cajero solo POS);
  - modo caja con PIN.
- [ ] **F6.5 · Agenda de citas:**
  - `booking_settings`, `staff_schedules`, `schedule_blocks`, `appointments`, `available_slots`, `request_appointment`, `decide_appointment`, cron de vencimiento;
  - reserva pública, panel "Por aprobar" + lista del día, detalle, nueva cita y configuración;
  - Realtime y avisos semiautomáticos por WhatsApp.
- [ ] **F7 · Ticket:**
  - componente de ticket, pantalla de diseño editable, `ticket_settings`;
  - impresión web por `@page`.
- [ ] **F8 · App móvil:**
  - Capacitor (Android primero);
  - cámara, galería y compartir;
  - impresión Bluetooth ESC/POS raster;
  - build de APK de prueba. Después iOS.
- [ ] **F9 · Producción:**
  - Supabase nube, Vercel, SMTP;
  - pruebas e2e de los flujos clave;
  - checklist de seguridad (RLS revisada con usuarios de cada rol).

**Definición de terminado por fase:**
- lint y typecheck sin errores;
- tests de la lógica nueva pasando;
- flujo probado a mano en móvil (DevTools 375 px);
- RLS probada con un usuario de cada rol;
- migraciones reproducibles con `supabase db reset`.

---

## 11. Decisiones abiertas (usar el default y confirmar con Daniel)

1. ¿El cajero puede cerrar su propio corte? → **Default: no** (dueño o admin).
2. ¿Los abonos en efectivo suman al corte del día? → **Default: sí.**
3. Nombre comercial y dominio de la plataforma → **Placeholder** `tuapp.com`.
4. Límites por plan (productos, empleados) y precio → **Placeholders** configurables en una tabla `plans`.
5. ¿Al convertir una cotización se descuenta stock de inmediato? → **Default: sí**, al convertir.
6. Variantes en modo Productos con stock propio por variante → **Default: sí.**
7. Comanda de cocina para el modo Comida → **Default: no** (fase futura).
8. Agenda de citas → **Sí, incluida** (§8.11): con aprobación por defecto y recordatorios semiautomáticos por WhatsApp. Automáticos con la API de WhatsApp Business: fase futura.
