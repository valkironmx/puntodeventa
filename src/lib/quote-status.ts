export const QUOTE_ST: Record<string, [string, string]> = {
  draft: ['borrador', 'Borrador'], pending: ['espera', 'En espera'], accepted: ['aceptada', 'Aceptada'], rejected: ['rechazada', 'Rechazada'],
  cancelled: ['cancelada', 'Cancelada'], expired: ['vencida', 'Vencida'], converted: ['convertida', 'Convertida'],
}
export const QUOTE_FILTERS: [string, string][] = [['todas', 'Todas'], ['pending', 'En espera'], ['accepted', 'Aceptadas'], ['converted', 'Convertidas'], ['expired', 'Vencidas'], ['cancelled', 'Canceladas'], ['papelera', 'Papelera']]
