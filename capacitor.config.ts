import type { CapacitorConfig } from '@capacitor/cli'

// La app trae su propia interfaz (mobile/www) y funciona sin internet.
// Solo se conecta al servidor para iniciar sesión y para subir/bajar datos cuando hay señal.
// El servidor queda grabado al compilar: CAP_SERVER_URL=https://tu-dominio.com npm run android:apk
const server = process.env.CAP_SERVER_URL ?? ''
// Modo desarrollo (npm run android:dev): la app carga las pantallas del servidor de desarrollo de tu Mac y se recarga sola
const devUrl = process.env.CAP_DEV_URL

const config: CapacitorConfig = {
  appId: 'mx.tuapp.pos',
  appName: 'Tu App',
  webDir: 'mobile/www',
  server: devUrl ? { url: devUrl, cleartext: true } : { androidScheme: 'https' },
  android: {
    backgroundColor: '#F8F6F2',
    // Solo para la versión de prueba con servidor http en la red local; con https no se usa
    allowMixedContent: server.startsWith('http://') || !server,
  },
  plugins: {
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover' },
    SplashScreen: { launchShowDuration: 700, backgroundColor: '#1F8A6B', showSpinner: false },
  },
}
export default config
