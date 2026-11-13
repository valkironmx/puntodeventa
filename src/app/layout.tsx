import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/plus-jakarta-sans'
import './globals.css'
import { ToastProvider } from '@/components/ui'
import { APP_NAME } from '@/lib/brand'

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: 'default' },
  icons: { apple: '/icon-192.png' },
  formatDetection: { telephone: false },
  description: 'Catálogo o menú digital, punto de venta sencillo, cotizaciones y agenda para tu negocio.',
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#F8F6F2', interactiveWidget: 'resizes-content' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  )
}
