# CLAUDE.md

Plataforma SaaS multi-negocio con 3 modos (Comida, Productos, Servicios): catálogo/menú digital público + panel tipo app con punto de venta sencillo, cotizaciones, abonos, corte de caja, empleados, ticket, QR dinámico y agenda de citas con aprobación.

## Antes de escribir código
- Lee **`docs/PLAN.md`** completo. Es la fuente de verdad: modelo de datos, roles, reglas de IVA, QR, ticket y fases.
- Abre `docs/maquetas/maqueta-catalogo.html` y revisa `docs/maquetas/capturas/`: son la referencia visual y de comportamiento.
- Trabaja **por fases (F0 → F9)** en orden. Al terminar cada fase, resume qué quedó y espera confirmación antes de pasar a la siguiente.
- Si algo del plan es ambiguo, usa el default de §11 y anótalo. No inventes funciones fuera de alcance (§1).

## Stack
Next.js (App Router, TS estricto, Server Actions) · Tailwind · Supabase (Postgres, Auth, Storage, RLS, RPC, pg_cron) · GitHub · Vercel · Capacitor (fase 8).

## Convenciones
- UI y textos en **español de México**. Nunca pongas palabras de modo fijas ("Menú", "Productos"): usa `src/lib/terms.ts` (§6.0). Moneda MXN, `es-MX`, zona `America/Mexico_City`.
- Mobile-first (diseña a 375 px). El panel se ve como app: app bar + drawer izquierdo con ☰.
- Dinero en `numeric(12,2)`. Nada de floats para guardar. Toda suma de totales se hace en el servidor (RPC).
- RLS en **todas** las tablas. El admin nunca puede `DELETE`. El cajero solo POS.
- Validación con `zod` en cada Server Action. Service role solo en el servidor.
- Lógica pura con tests (Vitest): `tax.ts`, `slug.ts`, `qr.ts` (margen de 3 mm), `money.ts`.
- Migraciones en `supabase/migrations`, reproducibles con `supabase db reset`. Regenera los tipos después de cada migración.
- Commits pequeños por funcionalidad.

## Comandos
```bash
supabase start          # servicios locales (requiere Docker)
supabase db reset       # migraciones + seed
supabase gen types typescript --local > src/lib/database.types.ts
pnpm dev | pnpm lint | pnpm typecheck | pnpm test
```

## Local sin Docker (estado actual)
- Se usa Postgres embebido en vez de `supabase start`: `npm run dev` (puerto 3006) y `npm run db:reset`. Detalles en `README.md`.
- Gestor de paquetes en esta máquina: `npm` (pnpm no está instalado).
- Al pasar JSON a Postgres con `postgres.js` usar `${JSON.stringify(x)}::text::jsonb` (con `::jsonb` directo se codifica dos veces).
- Antes de dar algo por terminado: `npm test`, `npm run typecheck` y `node scripts/smoke.mjs`.
- App Android sin internet: interfaz propia en `src/mobile/` (reutiliza componentes del panel con alias de `next/link`, `next/navigation` y `@/app/actions/sales`), API en `src/app/api/mobile/*` y `src/lib/mobile.ts`. Si cambias el POS, pedidos o ticket, revisa que siga compilando `node scripts/build-mobile.mjs`. `npm run android:apk` compila y comprime el APK en `dist-android/`. Java 21 en `~/Library/Java/JavaVirtualMachines`, SDK en `~/Library/Android/sdk`.
