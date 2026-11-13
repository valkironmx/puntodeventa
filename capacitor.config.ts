import type { CapacitorConfig } from '@capacitor/cli'

// La app trae su propia interfaz (mobile/www) y funciona sin internet.
// Solo se conecta al servidor para iniciar sesión y para subir/bajar datos cuando hay señal.
// El servidor queda grabado al compilar: CAP_SERVER_URL=https://tu-dominio.com npm run android:apk
const server = process.env.CAP_SERVER_URL ?? ''

const config: CapacitorConfig = {
  appId: 'mx.tuapp.pos',
  appName: 'Tu App',
  webDir: 'mobile/www',
  server: { androidScheme: 'https' },
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
