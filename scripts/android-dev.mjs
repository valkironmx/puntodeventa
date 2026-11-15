// Instala en el emulador la versión de DESARROLLO de la app: carga las pantallas desde http://localhost:3010
// (scripts/dev-mobile.mjs) y se recarga sola. No usar para teléfonos reales ni para Google Play.
import { execFileSync, execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = process.cwd()
const javaHome = process.env.JAVA_HOME || execSync('/usr/libexec/java_home -v 21').toString().trim()
const sdk = process.env.ANDROID_HOME || path.join(os.homedir(), 'Library/Android/sdk')
const adb = path.join(sdk, 'platform-tools/adb')
const env = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, CAP_DEV_URL: 'http://localhost:3010', PATH: `${javaHome}/bin:${process.env.PATH}` }
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, env, stdio: 'inherit' })

if (!fs.existsSync(path.join(root, 'mobile/www/index.html'))) { console.error('Primero corre el modo desarrollo: node scripts/dev-mobile.mjs'); process.exit(1) }
fs.writeFileSync(path.join(root, 'android/local.properties'), `sdk.dir=${sdk}\n`)
run('npx', ['cap', 'sync', 'android'])
run('./gradlew', ['--no-daemon', '-q', 'assembleRelease'], path.join(root, 'android'))
run(adb, ['install', '-r', 'android/app/build/outputs/apk/release/app-release.apk'])
// "localhost" dentro del emulador = tu Mac (pantallas en 3010, datos en 3006)
run(adb, ['reverse', 'tcp:3010', 'tcp:3010'])
run(adb, ['reverse', 'tcp:3006', 'tcp:3006'])
run(adb, ['shell', 'am', 'start', '-n', 'mx.tuapp.pos/.MainActivity'])
console.log('\nVersión de desarrollo instalada. Para volver a la normal: npm run android:apk e instala ese APK.')
