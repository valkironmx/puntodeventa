// Datos de la plataforma. Definir en variables de entorno ANTES de publicar en las tiendas (ver docs/AUDITORIA-TIENDAS.md).
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Tu App'
export const LEGAL_NAME = process.env.NEXT_PUBLIC_LEGAL_NAME ?? '[Razón social o nombre del responsable]'
export const LEGAL_ADDRESS = process.env.NEXT_PUBLIC_LEGAL_ADDRESS ?? '[Domicilio del responsable]'
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'soporte@tuapp.com'
export const LEGAL_UPDATED = '10 de noviembre de 2026'
