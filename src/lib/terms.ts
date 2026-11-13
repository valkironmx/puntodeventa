// Diccionario de palabras por modo (PLAN §6.0). PROHIBIDO poner "Menú" o "Productos" fijos en componentes.
export type Mode = 'food' | 'retail' | 'service'

export interface Terms {
  catalog: string        // "Menú"
  catalogLower: string
  item: string           // "platillo"
  items: string          // "platillos"
  Item: string
  Items: string
  newItem: string
  searchPh: string
  featured: string
  optionsGroup: string   // nombre sugerido para grupo de opciones
  optionsTitle: string
  qrText: string
  editCatalog: string
  icon: string
  modeName: string
  quoteHint: string
  waGreeting: string
}

export const TERMS: Record<Mode, Terms> = {
  food: {
    catalog: 'Menú', catalogLower: 'menú', item: 'platillo', items: 'platillos', Item: 'Platillo', Items: 'Platillos', newItem: 'Nuevo platillo',
    searchPh: 'Buscar en el menú...', featured: 'Lo más pedido', optionsGroup: 'Tamaño', optionsTitle: 'Modificadores (tamaño, extras)',
    qrText: 'Escanee para ver nuestro menú', editCatalog: 'Editar menú', icon: 'utensils', modeName: 'Comida',
    quoteHint: 'Eventos y banquetes', waGreeting: 'Hola, quiero hacer este pedido:',
  },
  retail: {
    catalog: 'Catálogo', catalogLower: 'catálogo', item: 'producto', items: 'productos', Item: 'Producto', Items: 'Productos', newItem: 'Nuevo producto',
    searchPh: 'Buscar productos...', featured: 'Destacados', optionsGroup: 'Talla', optionsTitle: 'Variantes con stock propio (talla, color)',
    qrText: 'Escanee para ver nuestro catálogo', editCatalog: 'Editar catálogo', icon: 'bag', modeName: 'Productos',
    quoteHint: 'Mayoreo y pedidos especiales', waGreeting: 'Hola, quiero hacer este pedido:',
  },
  service: {
    catalog: 'Servicios', catalogLower: 'catálogo de servicios', item: 'servicio', items: 'servicios', Item: 'Servicio', Items: 'Servicios', newItem: 'Nuevo servicio',
    searchPh: 'Buscar servicios...', featured: 'Los más solicitados', optionsGroup: 'Opción', optionsTitle: 'Opciones (ej. nivel, barbero)',
    qrText: 'Escanee para ver nuestros servicios', editCatalog: 'Editar servicios', icon: 'scissors', modeName: 'Servicios',
    quoteHint: 'Paquetes y eventos', waGreeting: 'Hola, me interesa agendar / pedir:',
  },
}

export function getTerms(business: { mode: string }): Terms {
  return TERMS[(business.mode as Mode) in TERMS ? (business.mode as Mode) : 'food']
}
