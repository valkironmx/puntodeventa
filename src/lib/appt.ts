export const APPT_ST: Record<string, [string, string, string]> = {
  pending: ['ap-pendiente', 'En espera', '#E0A100'], confirmed: ['ap-confirmada', 'Confirmada', 'var(--g)'], completed: ['ap-completada', 'Completada', '#A9B8B2'],
  no_show: ['ap-noasistio', 'No asistió', '#E5484D'], cancelled: ['ap-cancelada', 'Cancelada', '#E5484D'], rejected: ['ap-rechazada', 'Rechazada', '#E5484D'], expired: ['ap-completada', 'Venció', '#A9B8B2'],
}
/** Plantilla de aviso: {cliente} {día} {hora} {servicio} {negocio} {link} */
export function fillTemplate(tpl: string, v: Record<string, string>): string {
  return tpl.replace(/\{(cliente|día|dia|hora|servicio|negocio|link)\}/g, (_, k) => v[k === 'dia' ? 'día' : k] ?? '')
}
