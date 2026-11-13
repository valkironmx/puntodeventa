import type { MetadataRoute } from 'next'
import { APP_NAME } from '@/lib/brand'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME, short_name: APP_NAME, description: 'Catálogo digital, punto de venta, cotizaciones y agenda para tu negocio.',
    start_url: '/app', display: 'standalone', background_color: '#F8F6F2', theme_color: '#1F8A6B', lang: 'es-MX', orientation: 'any',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }, { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }],
  }
}
