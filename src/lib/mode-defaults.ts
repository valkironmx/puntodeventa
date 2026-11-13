// Valores por defecto por modo (PLAN §6.0). El modo NO cambia la base de datos: solo presentación y defaults.
import type { Mode } from './terms'

export interface Features { inventory: boolean; variants: boolean; modifiers: boolean; units: boolean; duration: boolean; booking: boolean }
export const FEATURE_LABELS: Record<keyof Features, [string, string]> = {
  inventory: ['Inventario', 'Controlar existencias y marcar agotado automático'],
  variants: ['Variantes con stock', 'Talla, color o modelo con existencias propias'],
  modifiers: ['Modificadores', 'Tamaño y extras con precio adicional'],
  units: ['Unidades de venta', 'Vender por kg, g, m, cm o litro'],
  duration: ['Duración', 'Mostrar duración aproximada en servicios'],
  booking: ['Agenda de citas', 'Reservas en línea con aprobación'],
}

export const ORDER_TYPE_LABELS: Record<string, string> = {
  mostrador: 'Mostrador', comer_aqui: 'Comer aquí', para_llevar: 'Para llevar', domicilio: 'A domicilio', envio: 'Envío a domicilio', en_local: 'En el local',
}

export const MODE_DEFAULTS: Record<Mode, {
  title: string; description: string; example: string
  categories: string[]; customFields: string[]; orderTypes: string[]; units: string[]
  features: Features; ticketFooter: string | null
}> = {
  food: {
    title: 'Comida', description: 'Restaurantes, cafeterías, taquerías, panaderías, postres, food trucks.', example: 'Menú con tamaños, extras y notas por platillo',
    categories: ['Desayunos', 'Comidas', 'Bebidas', 'Postres'], customFields: ['Preparación', 'Contiene (alérgenos)', 'Picante'],
    orderTypes: ['mostrador', 'comer_aqui', 'para_llevar', 'domicilio'], units: ['pieza', 'kg', 'g', 'l'],
    features: { inventory: false, variants: false, modifiers: true, units: true, duration: false, booking: false }, ticketFooter: null,
  },
  retail: {
    title: 'Productos', description: 'Ropa, tenis, accesorios, ferretería, papelería, regalos, cualquier producto físico.', example: 'Variantes con stock propio, venta por pieza, kg o metro',
    categories: ['Novedades', 'Ofertas'], customFields: ['Material', 'Garantía', 'SKU', 'Medidas'],
    orderTypes: ['mostrador', 'envio'], units: ['pieza', 'kg', 'g', 'm', 'cm'],
    features: { inventory: true, variants: true, modifiers: false, units: true, duration: false, booking: false }, ticketFooter: 'Cambios dentro de 15 días con ticket.',
  },
  service: {
    title: 'Servicios', description: 'Barberías, estéticas, talleres, despachos, lavado de autos.', example: 'Duración, precio "Desde" y agenda de citas',
    categories: ['Cortes', 'Paquetes', 'Productos'], customFields: ['Incluye', 'Recomendado cada…'],
    orderTypes: ['en_local', 'domicilio'], units: ['pieza'],
    features: { inventory: true, variants: false, modifiers: true, units: false, duration: true, booking: true }, ticketFooter: 'Cancelaciones con 2 horas de anticipación.',
  },
}

export function getFeatures(b: { mode: string; features?: Partial<Features> | null }): Features {
  const base = MODE_DEFAULTS[(b.mode as Mode) in MODE_DEFAULTS ? (b.mode as Mode) : 'food'].features
  return { ...base, ...(b.features ?? {}) }
}
export const modeDefaults = (b: { mode: string }) => MODE_DEFAULTS[(b.mode as Mode) in MODE_DEFAULTS ? (b.mode as Mode) : 'food']
