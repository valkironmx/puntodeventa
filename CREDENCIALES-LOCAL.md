# Credenciales demo (solo local)

App: http://localhost:3006 · Entrar: http://localhost:3006/login

**Contraseña de todos los usuarios demo:** `Demo-2026`
**PIN de todos los empleados (modo caja):** `1234`

| Rol | Correo | Entra a |
|---|---|---|
| Super Admin | super@tuapp.com | /super |
| **Café La Luna** (Comida) · Dueño | dueno@cafelaluna.mx | /app |
| Café La Luna · Administrador | admin@cafelaluna.mx | /app |
| Café La Luna · Cajero | cajero@cafelaluna.mx | /app/pos |
| **Nómada Store** (Productos) · Dueño | dueno@nomadastore.mx | /app |
| Nómada Store · Administrador | admin@nomadastore.mx | /app |
| Nómada Store · Cajero | cajero@nomadastore.mx | /app/pos |
| **Barbería Don Beto** (Servicios) · Dueño | beto@barberiadonbeto.mx | /app |
| Barbería Don Beto · Administrador | admin@barberiadonbeto.mx | /app |
| Barbería Don Beto · Barbero (cajero) | luis@barberiadonbeto.mx | /app/pos |

Páginas públicas: `/cafelaluna` · `/nomadastore` · `/barberiadonbeto` (y `/barberiadonbeto/agendar`).

Base de datos local: `postgres://postgres:postgres@127.0.0.1:54329/app` (Postgres embebido, datos en `.pgdata/`).

> Son datos de prueba definidos en `supabase/seed.sql`. No usar en producción.
