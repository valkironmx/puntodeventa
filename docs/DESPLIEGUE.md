# Publicar en la web (GitHub + Supabase + Vercel)

Destinos de este proyecto:
- **GitHub:** https://github.com/valkironmx/puntodeventa
- **Supabase:** https://arznbsatmhwlhntqxkbt.supabase.co
- **Vercel:** equipo valkirion web apps · proyecto puntodeventa · https://ventasvalkirion.vercel.app

## 1. Supabase (base de datos y fotos)
1. Llena `.env.supabase` (ya existe, no se sube a GitHub):
   - `DATABASE_URL_DIRECT`: Project Settings → Database → Connection string → **Direct connection** (puerto 5432), con tu contraseña.
   - `SUPABASE_SERVICE_ROLE_KEY`: Project Settings → API → `service_role` (secreta).
   - `SUPER_ADMIN_EMAIL` y `SUPER_ADMIN_PASSWORD`: tu cuenta de Super Admin en la nube.
2. Crear tablas, funciones, seguridad y tareas automáticas:
   ```bash
   node --env-file=.env.supabase scripts/migrate-remote.mjs --super
   ```
   Agrega `--demo` si quieres los negocios de demostración. Después borra `SUPER_ADMIN_PASSWORD` del archivo.
3. Subir las fotos que hoy están en tu Mac (opcional):
   ```bash
   node --env-file=.env.supabase scripts/upload-storage.mjs
   ```

## 2. Vercel (página web)
Importa el repositorio de GitHub y captura estas variables (Settings → Environment Variables):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Supabase → Connection string → **Transaction pooler** (puerto 6543) |
| `SUPABASE_URL` | `https://arznbsatmhwlhntqxkbt.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | la `service_role` de Supabase |
| `NEXT_PUBLIC_APP_URL` | `https://<tu-dominio>` (o la dirección `.vercel.app`) |
| `NEXT_PUBLIC_APP_DOMAIN` | `<tu-dominio>` sin `https://` |
| `NEXT_PUBLIC_APP_NAME` | nombre de la plataforma |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` (nuevas para producción) |
| `VAPID_SUBJECT` | `mailto:<correo de soporte>` |
| `PUSH_WEBHOOK_SECRET` | texto largo al azar (el mismo que en `.env.supabase`) |

Región de funciones: `iad1` (Washington, junto a Supabase East US), ya configurada en `vercel.json`.

## 3. Avisos push
Con la dirección final, llena `APP_URL` y `PUSH_WEBHOOK_SECRET` en `.env.supabase` y corre:
```bash
node --env-file=.env.supabase scripts/migrate-remote.mjs --push-webhook
```

## Qué cambia respecto a tu Mac
- Sesiones, intentos de inicio de sesión e invitaciones viven en el esquema `app_auth`; los usuarios en `auth.users` de Supabase (misma contraseña cifrada).
- Fotos en Supabase Storage (`product-images`, `business-assets`); `/storage/...` redirige a ellas.
- Mantenimiento y avisos diarios con `pg_cron`; avisos push con `pg_net` → `/api/push/webhook`.
- Actualizaciones del esquema: vuelve a correr `migrate-remote.mjs` (solo aplica las nuevas).
