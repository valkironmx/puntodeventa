// Compila el APK de Android firmado y lo deja comprimido en dist-android/.
// Uso: npm run android:apk            (servidor = IP de esta Mac en la red local, puerto 3006)
//      CAP_SERVER_URL=https://tu-dominio.com npm run android:apk   (producción)
import { execFileSync, execSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildMobile } from './build-mobile.mjs'

const root = process.cwd()
const javaHome = process.env.JAVA_HOME || execSync('/usr/libexec/java_home -v 21').toString().trim()
const sdk = process.env.ANDROID_HOME || path.join(os.homedir(), 'Library/Android/sdk')
const env = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, PATH: `${javaHome}/bin:${process.env.PATH}` }
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, env, stdio: 'inherit' })

fs.writeFileSync(path.join(root, 'android/local.properties'), `sdk.dir=${sdk}\n`)

// Llave de firma (se crea una sola vez)
const props = path.join(root, 'android/keystore.properties')
if (!fs.existsSync(props)) {
  const pass = crypto.randomBytes(18).toString('base64url')
  run(path.join(javaHome, 'bin/keytool'), ['-genkeypair', '-v', '-keystore', 'android/release.jks', '-alias', 'app', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
    '-storepass', pass, '-keypass', pass, '-dname', 'CN=Tu App, O=Tu App, C=MX'])
  fs.writeFileSync(props, `storeFile=release.jks\nstorePassword=${pass}\nkeyAlias=app\nkeyPassword=${pass}\n`, { mode: 0o600 })
  console.log('Llave de firma creada en android/release.jks (respáldala junto con android/keystore.properties)')
}

const server = await buildMobile()
env.CAP_SERVER_URL = server
console.log(`App del teléfono empaquetada. Servidor para iniciar sesión y sincronizar: ${server}`)
run('npx', ['cap', 'sync', 'android'])
run('./gradlew', ['--no-daemon', 'assembleRelease'], path.join(root, 'android'))

const ver = execSync(`grep -m1 versionName android/app/build.gradle`).toString().match(/"(.+)"/)?.[1] ?? '1.0'
const out = path.join(root, 'dist-android')
fs.mkdirSync(out, { recursive: true })
const apk = path.join(out, `TuApp-${ver}.apk`)
fs.copyFileSync(path.join(root, 'android/app/build/outputs/apk/release/app-release.apk'), apk)
fs.writeFileSync(path.join(out, 'LEEME.txt'), `Tu App ${ver} para Android\n\n1. Copia TuApp-${ver}.apk al teléfono (WhatsApp, Drive, cable o correo).\n2. Ábrelo y permite "Instalar apps desconocidas" para la app con la que lo abriste.\n3. Si ya tenías la versión anterior, se actualiza encima.\n4. Abre Tu App e inicia sesión (solo esa vez necesitas conexión con el servidor).\n\nDespués funciona sin internet: punto de venta, pedidos, abonos, cotizaciones y ventas se guardan en el teléfono y se suben solos cuando hay conexión.\n\nServidor para iniciar sesión y sincronizar: ${server}\n`)
const zip = path.join(out, `TuApp-${ver}-android.zip`)
fs.rmSync(zip, { force: true })
run('zip', ['-j', '-q', zip, apk, path.join(out, 'LEEME.txt')])
console.log(`\nAPK listo: ${apk}\nComprimido: ${zip}\nServidor configurado: ${server}`)
