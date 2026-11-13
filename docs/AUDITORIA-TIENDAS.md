# Auditoría para publicar en Google Play y App Store

Fecha: 11 de noviembre de 2026 · Alcance: todo el repositorio `catalogo-pos-saas` tal como corre en local.

> Las reglas de las tiendas cambian varias veces al año. Antes de enviar, confirma cada punto contra las páginas oficiales:
> [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) y
> [Políticas para desarrolladores de Google Play](https://play.google.com/about/developer-content-policy/).

## Veredicto

**Hoy no se puede enviar a ninguna tienda.** No es por la calidad del código: es porque todavía no existe una app móvil ni un servidor público. Lo que hay es una aplicación web que corre en esta Mac.

Lo que sí depende del código ya quedó resuelto en esta auditoría (sección 1). Lo que falta (sección 2) requiere cuentas, herramientas y decisiones que solo tú puedes dar.

| Área | Estado |
|---|---|
| Requisitos de política que se resuelven en código | Hecho |
| Servidor público con HTTPS (Supabase nube + Vercel) | Falta · fase F9 |
| App nativa Android / iPhone (Capacitor) | Falta · fase F8 |
| Funciones nativas reales (obligatorias en Apple) | Falta · fase F8 |
| Cuentas de desarrollador, marca, ícono, capturas | Falta · lo defines tú |
| Textos legales revisados y con tus datos | Plantilla lista · falta tu revisión |

---

## 1. Lo que se corrigió en esta auditoría

| # | Requisito | Qué exigen las tiendas | Qué se hizo | Dónde |
|---|---|---|---|---|
| 1 | Eliminar cuenta desde la app | Apple 5.1.1(v) y Google (Data safety): si hay cuentas, el usuario debe poder iniciar su eliminación dentro de la app | Pantalla **Mi cuenta → Eliminar mi cuenta**. Pide escribir ELIMINAR y la contraseña. Borra el usuario; si es el único dueño, borra el negocio completo y sus imágenes | `/app/cuenta`, `supabase/migrations/0006_account_deletion.sql` |
| 2 | URL pública de eliminación | Google pide una página web con los pasos y qué datos se borran | Página `/eliminar-cuenta` | `src/app/eliminar-cuenta` |
| 3 | Aviso de privacidad | Obligatorio en ambas, accesible dentro de la app y por URL | Página `/privacidad` (redactada con base en la LFPDPPP) enlazada desde login, Mi cuenta, página del negocio y formulario de citas | `src/app/privacidad` |
| 4 | Términos y soporte | Apple pide URL de soporte; términos recomendados | Páginas `/terminos` y `/soporte` | `src/app/terminos`, `src/app/soporte` |
| 5 | Contenido publicado por terceros | Apple 1.2: forma de reportar contenido y de retirarlo | Enlace **Reportar esta página** en cada negocio. El super admin ya puede suspender negocios | página pública, `/super/negocios/[id]` |
| 6 | Consentimiento al dar datos | Informar para qué se usa el dato en el momento de pedirlo | Aviso bajo el formulario de citas (nombre y WhatsApp) | `public-booking.tsx` |
| 7 | Sesión segura | Datos en tránsito cifrados | Cookie de sesión `Secure` en producción + HSTS | `src/lib/auth.ts`, `next.config.mjs` |
| 8 | Fuerza bruta en login | Buena práctica de seguridad | Bloqueo de 15 min tras 8 intentos fallidos | `src/app/actions/auth.ts` |
| 9 | Cabeceras de seguridad | Buena práctica | `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`; sin `X-Powered-By` | `next.config.mjs` |
| 10 | Dependencias vulnerables | Google escanea librerías con fallas conocidas | `npm audit`: de 2 vulnerabilidades (1 alta) a 0 | `package.json` (`overrides`) |
| 11 | Cambio de contraseña | Control de la cuenta por el usuario | En Mi cuenta; cierra las demás sesiones | `/app/cuenta` |
| 12 | Accesibilidad | Apple y Google revisan zoom y lectura | Se quitó el bloqueo de zoom; campos a 16 px (iOS ya no hace zoom al escribir); foco visible; respeta "reducir movimiento" | `layout.tsx`, `globals.css` |
| 13 | Muesca y barra de inicio | La app no debe quedar tapada por el sistema | Áreas seguras (`safe-area-inset`) en barras y botones fijos | `globals.css` |
| 14 | Pantallas de error | Apple 2.1: sin pantallas rotas ni en blanco | Página 404 y pantalla de error con "Reintentar" | `not-found.tsx`, `error.tsx` |
| 15 | Identidad de la app | Nombre consistente | Nombre, razón social y correo de soporte salen de variables de entorno | `src/lib/brand.ts`, `.env.example` |
| 16 | Compilación de producción | Debe compilar sin errores | `next build` pasa (41 rutas) | — |

Verificación: 16 pruebas unitarias y 41 pruebas de permisos y lógica pasan (`npm test`, `node scripts/smoke.mjs`), incluidas 4 nuevas de eliminación de cuenta.

---

## 2. Lo que falta para poder enviar (bloqueantes)

### 2.1 Servidor público — fase F9
Las tiendas prueban la app desde sus oficinas: necesita una dirección HTTPS que funcione 24 horas.

- Crear el proyecto en **Supabase** (nube) y aplicar `supabase/migrations`.
- **Cambiar el inicio de sesión local por Supabase Auth.** El actual (`supabase/local/000_auth_shim.sql`) es solo para desarrollo. Con eso llegan también los correos de invitación y **"Olvidé mi contraseña"**, que hoy no existe.
- Mover las imágenes de la carpeta `storage/` a **Supabase Storage**.
- Publicar en **Vercel** con dominio propio y definir las variables de `.env.example`.
- Activar `pg_cron` (vencimiento de citas y cotizaciones).

### 2.2 App nativa — fase F8
- Instalar **Xcode** completo (esta Mac solo tiene las herramientas de línea de comandos), **CocoaPods** y **Android Studio** (el SDK de Android está incompleto).
- Crear el proyecto Capacitor (`mobile/`) apuntando a la URL pública.
- Generar el AAB firmado (Android) y el archivo para App Store Connect (iOS).

### 2.3 Funciones nativas reales — riesgo principal en Apple
Apple rechaza apps que solo muestran un sitio web (**regla 4.2, funcionalidad mínima**). El plan ya lo prevé; hay que implementarlo antes de enviar:

| Función | Para qué | Permiso que se declara |
|---|---|---|
| Cámara y galería | Fotos de productos, portada y logo | Cámara, Fotos |
| Guardar y compartir imágenes | Cotización, estado de cuenta y QR en JPG | Fotos (solo agregar) |
| Impresora Bluetooth | Tickets ESC/POS | Bluetooth |
| Notificaciones | Aviso de nueva cita por aprobar | Notificaciones |
| Ubicación (opcional) | "Usar mi ubicación actual" | Ubicación en uso |

Cada permiso necesita un texto que explique el motivo en español (por ejemplo: "Usamos la cámara para tomar fotos de tus productos"). Un permiso sin motivo claro es causa de rechazo.

### 2.4 Cobros y planes — regla 3.1 de Apple
- La app vende **bienes físicos y servicios de los negocios**, y los cobra fuera de la app. Eso está permitido sin usar el sistema de pagos de Apple.
- Los **planes de la plataforma** (Básico, Pro) son un servicio digital. Dentro de la app de iPhone **no debe haber precios, botones de "mejorar plan" ni enlaces para pagarlos**. Hoy la app solo muestra la etiqueta "Plan Pro", lo cual es aceptable; mantenerlo así.
- El **panel Super Admin** no debe ir en la app de las tiendas: es una herramienta interna. Dejarlo solo en web.

### 2.5 Cuentas y materiales que debes aportar
| Qué | Detalle |
|---|---|
| Cuenta Apple Developer | 99 USD al año. Como empresa pide número D-U-N-S |
| Cuenta Google Play Console | 25 USD, pago único. Las cuentas personales nuevas deben hacer una prueba cerrada con 12 personas durante 14 días antes de publicar |
| Nombre comercial y dominio | Hoy dice "Tu App" y `tuapp.com` |
| Ícono 1024 × 1024 y pantalla de inicio | El ícono actual (`src/app/icon.svg`) es provisional |
| Capturas de pantalla | iPhone 6.9" y 6.5", iPad si se ofrece, y teléfono Android. Deben mostrar la app real |
| Razón social, domicilio y correo de soporte | Van en el aviso de privacidad (variables `NEXT_PUBLIC_LEGAL_*`) |
| Revisión legal | El aviso de privacidad y los términos son plantillas: que los revise quien te asesore legalmente |

---

## 3. Lista por tienda

### App Store (Apple)
- [x] Eliminación de cuenta dentro de la app — 5.1.1(v)
- [x] Aviso de privacidad accesible en la app — 5.1.1
- [x] Reporte de contenido y moderación — 1.2
- [x] Sin compras digitales dentro de la app — 3.1.1
- [ ] Funciones nativas suficientes — 4.2
- [ ] **Cuenta demo para el revisor** — 2.1. Dar usuario y contraseña de un negocio de prueba en producción, con datos cargados (sirve un panel maestro)
- [ ] Notas para el revisor: explicar que las cuentas se crean por invitación y que los pedidos se envían por WhatsApp
- [ ] Textos de permisos en español en `Info.plist`
- [ ] Etiquetas de privacidad en App Store Connect (tabla de la sección 4)
- [ ] Cifrado: declarar que solo se usa HTTPS estándar (exento)
- [ ] Clasificación por edad: 4+

### Google Play
- [x] Eliminación de cuenta en la app y por URL (`/eliminar-cuenta`)
- [x] Política de privacidad por URL (`/privacidad`)
- [x] Sin librerías con vulnerabilidades conocidas
- [ ] Formulario **Seguridad de los datos** (tabla de la sección 4)
- [ ] Nivel de API objetivo vigente (el que Google exija ese año; API 35 o superior)
- [ ] Paquete AAB firmado con Play App Signing
- [ ] Clasificación de contenido (cuestionario IARC) y público objetivo: adultos
- [ ] Credenciales de prueba en "Acceso a la app"
- [ ] Prueba cerrada de 12 personas por 14 días, si la cuenta es personal

---

## 4. Respuestas para los formularios de privacidad

Sirve igual para "App Privacy" de Apple y "Seguridad de los datos" de Google.

| Dato | ¿Se recaba? | Para qué | ¿Ligado a la persona? | ¿Rastreo o publicidad? |
|---|---|---|---|---|
| Nombre | Sí | Funcionamiento de la app | Sí | No |
| Correo electrónico | Sí | Cuenta e inicio de sesión | Sí | No |
| Teléfono | Sí | Contacto del negocio y citas | Sí | No |
| Fotos | Sí, las que sube el negocio | Catálogo | Sí | No |
| Ubicación aproximada o precisa | Solo si el negocio toca "Usar mi ubicación" | Dirección del negocio | Sí | No |
| Historial de compras | Ventas que registra el negocio | Funcionamiento de la app | Sí | No |
| Datos de tarjeta o bancarios | **No** | — | — | — |
| Contactos, micrófono, salud, navegación web | **No** | — | — | — |
| Identificadores de publicidad | **No** | — | — | — |

- Los datos se cifran en tránsito (HTTPS).
- El usuario puede pedir que se eliminen.
- No se comparten con terceros para publicidad ni se venden.

---

## 5. Riesgos menores detectados (no bloquean)

| Hallazgo | Recomendación |
|---|---|
| No hay "Olvidé mi contraseña" | Se resuelve al pasar a Supabase Auth (2.1) |
| Citas por aprobar se actualizan cada 10 s | Cambiar a tiempo real de Supabase en producción |
| El límite de solicitudes de cita es por teléfono, no por dispositivo | Agregar límite por IP en producción |
| Las fotos de ejemplo son de Unsplash | Están bien como demo; para las capturas de las tiendas usa fotos propias o de negocios reales |
| No hay pruebas automáticas de pantalla (Playwright) | El plan las pide en F9 |
| `lint` no está configurado | Agregar ESLint antes de producción |

---

## 6. Orden recomendado

1. Definir nombre, dominio, ícono y razón social.
2. F9: Supabase nube, Supabase Auth, Storage y Vercel con HTTPS.
3. Instalar Xcode, CocoaPods y Android Studio.
4. F8: Capacitor con cámara, compartir, impresora Bluetooth y notificaciones.
5. Crear las cuentas de desarrollador (Google puede tardar por la prueba de 14 días: conviene empezarla pronto).
6. Cargar un negocio demo en producción para los revisores.
7. Llenar los formularios de privacidad con la sección 4 y enviar a revisión.
