'use client'
import Link from 'next/link'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './icons'

/* ---------- Toast ---------- */
const ToastCtx = createContext<(msg: string, bad?: boolean) => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; bad: boolean; on: boolean }>({ msg: '', bad: false, on: false })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const show = useCallback((msg: string, bad = false) => {
    setT({ msg, bad, on: true })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setT((x) => ({ ...x, on: false })), 2600)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className={`toast ${t.on ? 'show' : ''}`} style={t.bad ? { background: '#C53030' } : undefined} role="status">
        <Icon name={t.bad ? 'x' : 'check'} size={16} /> {t.msg}
      </div>
    </ToastCtx.Provider>
  )
}

/** Ejecuta una Server Action que devuelve {ok,error} mostrando toast. */
export type Res<T = unknown> = { ok: true; data?: T } | { ok: false; error: string }
export function useAction() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const run = useCallback(async <T,>(p: Promise<Res<T>>, okMsg?: string): Promise<T | true | null> => {
    setBusy(true)
    try {
      const r = await p
      if (!r.ok) { toast(r.error, true); return null }
      if (okMsg) toast(okMsg)
      return (r.data ?? true) as T | true
    } catch (e) {
      if (e && typeof e === 'object' && 'digest' in e && String((e as { digest: unknown }).digest).startsWith('NEXT_REDIRECT')) throw e
      toast('Ocurrió un error. Intenta de nuevo.', true); return null
    } finally { setBusy(false) }
  }, [toast])
  return { run, busy }
}

/** true en pantallas de computadora (≥ 900 px) */
export function useIsDesktop(): boolean {
  const [d, setD] = useState(false)
  useEffect(() => {
    const m = window.matchMedia('(min-width: 900px)')
    const f = () => setD(m.matches)
    f()
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return d
}

/* ---------- Notificaciones sin leer (lo provee el panel) ---------- */
export const NotifCtx = createContext<{ count: number; clear: () => void } | null>(null)
export const useNotif = () => useContext(NotifCtx)

/* ---------- Drawer (barra lateral) ---------- */
const DrawerCtx = createContext<() => void>(() => {})
export const useDrawer = () => useContext(DrawerCtx)
export function DrawerProvider({ children, drawer }: { children: ReactNode; drawer: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  return (
    <DrawerCtx.Provider value={() => setOpen(true)}>
      <div className={open ? 'open-d' : ''} style={{ display: 'contents' }}>
        {children}
        <div className="scrim" onClick={close} />
        <aside className="drawer">{drawer(close)}</aside>
      </div>
    </DrawerCtx.Provider>
  )
}

export function AppBar({ title, sub, back, right, children }: { title?: ReactNode; sub?: ReactNode; back?: string; right?: ReactNode; children?: ReactNode }) {
  const openDrawer = useDrawer()
  const notif = useNotif()
  return (
    <header className="appbar">
      <button className="ibtn menu-btn" onClick={openDrawer} aria-label="Menú"><Icon name="menu" /></button>
      {back ? <Link href={back} className="ibtn back-btn" aria-label="Regresar"><Icon name="back" /></Link> : null}
      {children ?? <div className="ttl" style={{ minWidth: 0 }}>{title}{sub ? <small>{sub}</small> : null}</div>}
      {right || notif ? (
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {right}
          {notif ? (
            <Link href="/app/notificaciones" className="ibtn bell" aria-label={notif.count ? `Notificaciones: ${notif.count} sin leer` : 'Notificaciones'}>
              <Icon name="bell" />{notif.count ? <i>{notif.count > 9 ? '9+' : notif.count}</i> : null}
            </Link>
          ) : null}
        </div>
      ) : null}
    </header>
  )
}

export function Sw({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`sw ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />
}

export function SwRow({ title, hint, on, onChange }: { title: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="swrow" style={{ padding: '6px 0' }}>
      <div><b>{title}</b>{hint ? <small>{hint}</small> : null}</div>
      <Sw on={on} onChange={onChange} label={title} />
    </div>
  )
}

export function Seg<T extends string>({ value, options, onChange, mini }: { value: T; options: [T, string][]; onChange: (v: T) => void; mini?: boolean }) {
  return (
    <div className={`seg ${mini ? 'mini' : ''}`}>
      {options.map(([v, l]) => <button type="button" key={v} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  )
}

export function Sheet({ title, onClose, children, top, compact, head, footer, tall }: { title?: ReactNode; onClose: () => void; children: ReactNode; top?: number; compact?: boolean; head?: ReactNode; footer?: ReactNode; tall?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <>
      <div className="dim" onClick={onClose} />
      <div className={`sheet ${compact ? 'compact' : ''} ${tall ? 'tall' : ''}`} style={compact ? { top: 'auto' } : top !== undefined ? { top } : undefined} role="dialog" aria-modal>
        <div className="grab" />
        {title ? (
          <div style={{ display: 'flex', alignItems: 'center', padding: '4px 18px 8px' }}>
            <div className="ttl">{title}</div>
            <button className="ibtn sm" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label="Cerrar"><Icon name="x" size={16} /></button>
          </div>
        ) : null}
        {head ? <div className="sheet-head">{head}</div> : null}
        <div className="sbody">{children}</div>
        {footer ? <div className="sfoot wfoot">{footer}</div> : null}
      </div>
    </>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return <div className="field"><label>{label}</label>{children}{hint ? <div className="hint">{hint}</div> : null}</div>
}

/** Foto o, si no hay, inicial del nombre sobre el tinte del color del negocio */
export function Ph({ src, name, className, style }: { src?: string | null; name?: string | null; className?: string; style?: React.CSSProperties }) {
  const ini = (name ?? '').replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return (
    <div className={`ph ${src ? '' : 'ph-empty'} ${className ?? ''}`} style={style}>
      {src ? <img src={src} alt="" loading="lazy" /> : ini ? <span className="ph-ini">{ini}</span> : <Icon name="image" size={22} />}
    </div>
  )
}

/** Teclado numérico con decimales para cantidades y montos */
export function NumPad({ value, onChange, decimals = 3 }: { value: string; onChange: (v: string) => void; decimals?: number }) {
  const press = (k: string) => {
    if (k === '⌫') return onChange(value.slice(0, -1))
    if (k === '.') { if (decimals === 0 || value.includes('.')) return; return onChange((value || '0') + '.') }
    const [, d] = value.split('.')
    if (d !== undefined && d.length >= decimals) return
    if (value.replace('.', '').length >= 9) return
    onChange(value === '0' ? k : value + k)
  }
  return (
    <div className="numpad">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', decimals === 0 ? '' : '.', '0', '⌫'].map((k, i) =>
        k ? <button type="button" key={i} onClick={() => press(k)} aria-label={k === '⌫' ? 'Borrar' : k}>{k === '⌫' ? <Icon name="back" size={20} /> : k}</button> : <span key={i} />)}
    </div>
  )
}
