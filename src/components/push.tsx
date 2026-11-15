'use client'
import { useEffect, useState } from 'react'
import { deletePushSubscriptionAction, savePushSubscriptionAction, testPushAction } from '@/app/actions/push'
import { Icon } from './icons'
import { useToast } from './ui'

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
const b64 = (s: string) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))) }
const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
const isIOS = () => typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
const standalone = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true)

async function subscribe(): Promise<boolean> {
  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(KEY) })
  const r = await savePushSubscriptionAction(sub.toJSON(), navigator.userAgent)
  return r.ok
}

/** Registra el service worker y, si ya hay permiso, mantiene al día la suscripción de este dispositivo. */
export function PushSetup() {
  useEffect(() => {
    if (!supported() || !KEY) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
    if (Notification.permission === 'granted') subscribe().catch(() => {})
  }, [])
  return null
}

/** Tarjeta para activar las notificaciones en este dispositivo (requiere que la persona lo toque). */
export function PushToggle() {
  const toast = useToast()
  const [state, setState] = useState<'loading' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on'>('loading')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    (async () => {
      if (!supported() || !KEY) return setState(isIOS() && !standalone() ? 'ios-install' : 'unsupported')
      if (Notification.permission === 'denied') return setState('denied')
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      setState(Notification.permission === 'granted' && sub ? 'on' : 'off')
    })().catch(() => setState('unsupported'))
  }, [])
  const enable = async () => {
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setState(perm === 'denied' ? 'denied' : 'off'); return }
      if (await subscribe()) { setState('on'); const r = await testPushAction(); toast(r.sent ? 'Notificaciones activadas' : 'Activadas. La prueba no llegó; revisa la configuración del dispositivo.') }
    } catch { toast('No se pudieron activar las notificaciones en este dispositivo', true) }
    finally { setBusy(false) }
  }
  const disable = async () => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) { await deletePushSubscriptionAction(sub.endpoint); await sub.unsubscribe() }
      setState('off'); toast('Notificaciones desactivadas en este dispositivo')
    } finally { setBusy(false) }
  }
  if (state === 'loading' || state === 'unsupported') return null
  const text: Record<string, [string, string]> = {
    on: ['Avisos activados', 'Te llegan aunque la app esté cerrada.'],
    off: ['Recibe avisos aquí', 'Pedidos, citas y productos agotados.'],
    denied: ['Avisos bloqueados', 'Actívalos en los ajustes del navegador.'],
    'ios-install': ['Agrégala a tu inicio', 'En iPhone: Compartir → "Agregar a inicio".'],
    unsupported: ['No disponible en este navegador', 'Usa Chrome, Edge, Firefox o Safari actualizado. En producción se necesita HTTPS.'],
  }
  return (
    <div className={`push-card ${state}`}>
      <span className="push-ic"><Icon name="bell" size={22} /></span>
      <div style={{ flex: 1, minWidth: 0 }}><b>{text[state][0]}</b><small>{text[state][1]}</small></div>
      {state === 'off' ? <button className="btn sm" style={{ width: 'auto', padding: '0 16px' }} disabled={busy} onClick={enable}>Activar</button> : null}
      {state === 'on' ? <button className="btn ghost sm" style={{ width: 'auto', padding: '0 14px' }} disabled={busy} onClick={disable}>Desactivar</button> : null}
    </div>
  )
}
