// Descargas como imagen JPG (PLAN §6.5): render a ancho fijo de 1080 px con html-to-image.
import { toJpeg } from 'html-to-image'
import { nativeSave } from './native-save'

export async function exportJpg(node: HTMLElement, filename: string, share = false): Promise<void> {
  const width = node.offsetWidth
  const dataUrl = await toJpeg(node, { quality: 0.92, backgroundColor: '#ffffff', pixelRatio: 1080 / width, cacheBust: true })
  if (await nativeSave(dataUrl, filename)) return
  const blob = await (await fetch(dataUrl)).blob()
  const file = new File([blob], filename, { type: 'image/jpeg' })
  if (share && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return } catch { /* cancelado: descarga */ }
  }
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}
