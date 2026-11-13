// Dentro de la app Android (Capacitor) una descarga normal no hace nada:
// se guarda el archivo y se abre la ventana del teléfono para guardarlo o compartirlo.
type CapPlugins = {
  Filesystem: { writeFile: (o: { path: string; data: string; directory: string }) => Promise<{ uri: string }> }
  Share: { share: (o: { title?: string; files?: string[]; dialogTitle?: string }) => Promise<unknown> }
}
type Cap = { isNativePlatform?: () => boolean; Plugins: Partial<CapPlugins> }

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  const cap = (window as unknown as { Capacitor?: Cap }).Capacitor
  return !!cap?.isNativePlatform?.()
}

const toBase64 = (blob: Blob) => new Promise<string>((ok, fail) => {
  const r = new FileReader()
  r.onload = () => ok(String(r.result).split(',')[1] ?? '')
  r.onerror = () => fail(r.error)
  r.readAsDataURL(blob)
})

/** Devuelve true si lo resolvió la app nativa; false si hay que usar la descarga del navegador. */
export async function nativeSave(file: Blob | string, filename: string): Promise<boolean> {
  if (!isNativeApp()) return false
  const { Filesystem, Share } = (window as unknown as { Capacitor: Cap }).Capacitor.Plugins
  if (!Filesystem || !Share) return false
  const data = typeof file === 'string' ? file.split(',')[1] ?? '' : await toBase64(file)
  const { uri } = await Filesystem.writeFile({ path: filename, data, directory: 'CACHE' })
  try {
    await Share.share({ title: filename, files: [uri], dialogTitle: 'Guardar o compartir' })
  } catch { /* el usuario cerró la ventana */ }
  return true
}
