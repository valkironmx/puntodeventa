# Catálogo digital + punto de venta (SaaS multi-negocio)

Plan maestro: [docs/PLAN.md](docs/PLAN.md) · Maqueta: `docs/maquetas/maqueta-catalogo.html` · Accesos demo: [CREDENCIALES-LOCAL.md](CREDENCIALES-LOCAL.md)

## Correr en local (sin Docker)

```bash
npm install
npm run dev        # Postgres embebido (puerto 54329) + Next.js en http://localhost:3006
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta la base de datos, aplica migraciones/seed pendientes y arranca Next.js en el 3006 |
| `npm run db:reset` | Borra la base y vuelve a aplicar migraciones + `supabase/seed.sql` |
| `npm test` | Vitest: `tax`, `slug`, `money`, `qr` (margen de 3 mm) |
| `node scripts/smoke.mjs` | 36 pruebas de RLS y RPC con un usuario de cada rol (se revierten solas) |
| `npm run typecheck` | TypeScript estricto |

## Cómo se resolvió "Supabase sin Docker"

El plan pide Supabase, y Supabase local exige Docker. Para trabajar sin Docker se corre **Postgres real embebido**
(`embedded-postgres`, datos en `.pgdata/`) con **las mismas migraciones** que irán a Supabase:

- `supabase/migrations/*.sql`: esquema, **RLS en todas las tablas**, RPC transaccionales. Se aplican tal cual con `supabase db push`.
- `supabase/local/000_auth_shim.sql`: **solo local**. Imita lo mínimo de Supabase Auth (`auth.users`, `auth.uid()`, roles `anon` / `authenticated`).
- `src/lib/db.ts → asUser()`: cada consulta corre con `set local role authenticated` + `auth.uid()`, igual que PostgREST, así que RLS se ejerce de verdad.

| Pieza de Supabase | Sustituto local | Al pasar a la nube |
|---|---|---|
| Auth (correo + contraseña, invitaciones) | `auth.users` + sesión por cookie httpOnly; la invitación se muestra como enlace | `@supabase/ssr` + `inviteUserByEmail` + SMTP |
| Storage | carpeta `storage/` servida en `/storage/...` | buckets `business-assets` y `product-images` |
| `pg_cron` | `src/instrumentation.ts` llama `run_maintenance()` cada 5 min | la migración ya programa `pg_cron` si existe |
| Realtime (citas por aprobar) | refresco cada 10 s | canal Realtime sobre `appointments` |
| `supabase gen types` | tipos escritos a mano donde hacen falta | regenerar `database.types.ts` |

## Agregado después del plan original

- **Promociones** (`/app/promociones`): banners con imagen, título, descripción y botón que agrega un producto al pedido; se activan o desactivan con un interruptor. Tabla `promotions` + RPC `public_promotions`.
- **Planes** (`/super/planes`): el super admin crea y edita planes (precio, días de duración, límites). En cada negocio puede sumar o quitar días, cambiar plan y fecha, suspender, activar o eliminar (con todo su contenido y las cuentas que solo eran de ese negocio). Un negocio suspendido no puede usar su panel.
- **Banner principal**: presenta el negocio (foto de portada, título, texto y botón a catálogo, WhatsApp o agenda). Se edita en Personalizar; las promociones van aparte, debajo.
- **Notificaciones** (`/app/notificaciones`, campana con contador): avisos de la plataforma y novedades del negocio (solicitud o cancelación de cita, producto agotado, plan por vencer). El super admin envía avisos desde `/super/avisos` a todos o por modo. Tablas `announcements`, `notifications`, `notification_reads`.
- **Notificaciones push** (Web Push con llaves VAPID): se activan en `/app/notificaciones` → "Activar". Llegan al teléfono aunque la app esté cerrada (Android con Chrome; iPhone con la app agregada a la pantalla de inicio, iOS 16.4+; computadora). Requieren HTTPS en producción (en local solo funciona en `localhost`). El servidor escucha el canal `push` de Postgres (`src/instrumentation-node.ts`); en Supabase se reemplaza por un Database Webhook o una Edge Function que llame a `src/lib/push-sender.ts`. Cuando exista la app nativa (fase F8, Capacitor), se agrega `@capacitor/push-notifications` con FCM (Android) y APNs (iPhone).
- **Preferencias del usuario** (`user_prefs`): por ahora la barra lateral contraída; se guardan en la cuenta, así que se conservan al cerrar sesión y en otros dispositivos.
- **Paneles maestros** (`/super`): un negocio de demostración por modo (Comida, Productos, Servicios) donde el super admin entra como dueño. RPC `create_master_business`.
- **Diseño**: en PC es web app de pantalla completa con barra lateral; en celular menú desplegable a la izquierda (sin barra inferior). Sin emojis.

## App Android (APK) sin internet
- La app trae su propia interfaz (`src/mobile/`, empaquetada con `node scripts/build-mobile.mjs` en `mobile/www`) y reutiliza los componentes del panel: punto de venta (venta, pedido, cotización, descuentos), pedidos y abonos, ventas y cotizaciones.
- Solo necesita conexión para **iniciar sesión** (`POST /api/mobile/login`). Después guarda todo en el teléfono (IndexedDB) y trabaja sin internet; lo que se registra queda en una cola que se sube sola cuando hay señal (`POST /api/mobile/sync`). Cada movimiento lleva un id propio (`mobile_ops`), así que reenviarlo no duplica nada. Las fotos del catálogo se guardan en el teléfono.
- Los folios de lo hecho sin conexión aparecen como "por asignar" hasta sincronizar. La caja se abre sola al subir la primera venta si no había una abierta.
- **Todas las secciones del panel** están en la app con el mismo diseño: las páginas web y la app usan las mismas vistas (`src/sections/views.tsx`) y las mismas cargas de datos (`src/lib/sections.ts`). El paquete del teléfono trae los datos de cada sección (`pages` en `/api/mobile/sync`).
- Cualquier acción del panel hecha en la app pasa por `src/mobile/actions-proxy.ts` y **se aplica al instante en el teléfono** (`src/mobile/local-actions.ts`: menú, categorías, promociones, personalizar, ticket, impuestos, campos, corte, empleados, cotizaciones, pedidos, citas). Las altas reciben su id en el teléfono y el servidor las crea con ese mismo id. Con conexión se suben al momento; sin conexión, al volver la señal.
- Fotos sin conexión: se guardan en el teléfono (`pendiente/...`) y se suben antes de sincronizar; la ruta real reemplaza a la temporal en lo pendiente. Cambiar contraseña, borrar la cuenta y ver horarios disponibles de citas sí necesitan conexión.
- Compilar: `npm run android:apk` → `dist-android/TuApp-<versión>-android.zip`. El servidor para iniciar sesión queda grabado al compilar (por defecto la IP de esta Mac:3006; producción: `CAP_SERVER_URL=https://tu-dominio.com npm run android:apk`). En la pantalla de inicio de sesión se puede cambiar con "Cambiar servidor".
- Probar la app del teléfono en el navegador: `node scripts/serve-mobile.mjs` (http://localhost:3010).
- Java 21 (Temurin) en `~/Library/Java/JavaVirtualMachines/`, Android SDK en `~/Library/Android/sdk`. Firma: `android/release.jks` + `android/keystore.properties` (respáldalos; sin ellos no se puede actualizar la app instalada).

## Estado por fases

- **F0–F7 hechas en local:** base, multi-negocio y auth, modos + catálogo, personalizar + QR dinámico, cotizaciones, ventas/POS/corte, empleados + PIN, agenda de citas, ticket e impresión web.
- **F8 (app Capacitor, Bluetooth ESC/POS, cámara nativa, push)** y **F9 (Supabase nube, Vercel, SMTP, e2e Playwright)**: pendientes; requieren Android Studio/Xcode y cuentas en la nube.

Decisiones abiertas del plan (§11): se usaron los valores por defecto (el cajero no cierra corte; los abonos en efectivo suman al corte; el stock se descuenta al convertir la cotización; variantes con stock propio).
