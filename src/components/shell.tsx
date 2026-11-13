'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { unreadNotificationsAction } from '@/app/actions/notifications'
import { savePrefsAction } from '@/app/actions/prefs'
import { PushSetup } from './push'
import { logoutAction, setCashDeviceAction } from '@/app/actions/auth'
import { Icon } from './icons'
import { DrawerProvider, NotifCtx } from './ui'
import { initials } from '@/lib/format'
import { ROLE_LABEL } from '@/lib/permissions'

export interface ShellProps {
  business: { name: string; slug: string; logo: string | null; accent: string; plan: string; planName: string }
  role: string; userName: string; isSuper: boolean; cashDevice: boolean; deviceLabel: string
  catalogWord: string; booking: boolean; pending: number; unread: number; orders: number; collapsed: boolean
  children: ReactNode
}

export function Shell(p: ShellProps) {
  const path = usePathname()
  const cashier = p.role === 'cashier'
  // Notificaciones sin leer: valor del servidor + actualización cada minuto
  const [unread, setUnread] = useState(p.unread)
  useEffect(() => setUnread(p.unread), [p.unread])
  useEffect(() => {
    const t = setInterval(() => { unreadNotificationsAction().then(setUnread).catch(() => {}) }, 60000)
    return () => clearInterval(t)
  }, [])
  // Barra lateral contraída (solo computadora y tablet horizontal); se guarda en la cuenta del usuario
  const [collapsed, setCollapsed] = useState(p.collapsed)
  const toggleRail = () => { const v = !collapsed; setCollapsed(v); savePrefsAction({ sidebar_collapsed: v }).catch(() => {}) }
  const clear = useCallback(() => setUnread(0), [])
  const notif = useMemo(() => ({ count: unread, clear }), [unread, clear])
  const item = (close: () => void, href: string, icon: string, label: string, badge?: ReactNode, also: string[] = []) => (
    <Link href={href} onClick={close} title={label} className={`ditem ${path === href || (href !== '/app' && path.startsWith(href)) || also.some((a) => path.startsWith(a)) ? 'on' : ''}`}>
      <Icon name={icon} size={19} /> {label} {badge}
    </Link>
  )
  return (
    <div className={`screen panel wide ${collapsed ? 'collapsed' : ''}`} style={{ ['--g' as string]: p.business.accent }}>
      <NotifCtx.Provider value={notif}>
      <DrawerProvider
        drawer={(close) => (
          <>
            <div className="dh">
              <div className="logo sm" style={p.business.logo ? { background: `#fff url(${p.business.logo}) center/cover` } : undefined}>{p.business.logo ? '' : initials(p.business.name)}</div>
              <div style={{ minWidth: 0 }}><b>{p.business.name}</b><small>{p.userName} · {ROLE_LABEL[p.role]}</small></div>
              <button className="ibtn sm" onClick={close} aria-label="Cerrar menú"><Icon name="x" size={16} /></button>
              <button className="ibtn sm rail-toggle" onClick={toggleRail} aria-label={collapsed ? 'Mostrar barra lateral' : 'Ocultar barra lateral'} title={collapsed ? 'Mostrar barra lateral' : 'Ocultar barra lateral'}>
                <Icon name="back" size={16} style={collapsed ? { transform: 'rotate(180deg)' } : undefined} />
              </button>
            </div>
            <div className="dscroll">
              {cashier ? (
                <>
                  {item(close, '/app/pos', 'pos', 'Punto de venta')}
                  {item(close, '/app/pedidos', 'bag', 'Pedidos', p.orders ? <span className="bd">{p.orders}</span> : null)}
                  {p.booking ? item(close, '/app/citas', 'calendar', 'Mis citas', p.pending ? <span className="bd">{p.pending}</span> : null) : null}
                  {item(close, '/app/cuenta', 'user', 'Mi cuenta')}
                </>
              ) : (
                <>
                  {item(close, '/app', 'grid', 'Inicio')}
                  {p.role === 'super' ? null : item(close, '/app/pos', 'pos', 'Punto de venta')}
                  {item(close, '/app/pedidos', 'bag', 'Pedidos', p.orders ? <span className="bd">{p.orders}</span> : null)}
                  {item(close, '/app/ventas', 'receipt', 'Ventas y pagos')}
                  {item(close, '/app/cotizaciones', 'doc', 'Cotizaciones')}
                  {item(close, '/app/corte', 'cash', 'Corte de caja')}
                  {p.booking ? item(close, '/app/citas', 'calendar', 'Citas', p.pending ? <span className="bd">{p.pending}</span> : null) : null}
                  {item(close, '/app/catalogo', 'tag', p.catalogWord)}
                  {item(close, '/app/negocio', 'store', 'Mi negocio', null, ['/app/personalizar', '/app/promociones', '/app/categorias', '/app/qr', '/app/ticket', '/app/impresora', '/app/empleados', '/app/cuenta'])}
                  {item(close, '/app/ajustes', 'settings', 'Ajustes')}
                </>
              )}
            </div>
            <div className="dfoot">
              {!cashier ? (
                <div className="plan"><Icon name="store" size={18} /><div><b>{p.business.planName === 'Maestro' ? 'Panel maestro' : `Plan ${p.business.planName}`}</b>{process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'tuapp.com'}/{p.business.slug}</div></div>
              ) : null}
              {p.isSuper ? <Link href="/super" className="ditem" onClick={close}><Icon name="back" size={19} /> Volver a Super Admin</Link> : null}
              {p.cashDevice ? (
                <Link href="/login/pin" className="ditem" onClick={close}><Icon name="swap" size={19} /> Cambiar de usuario (PIN)</Link>
              ) : !cashier && p.role !== 'super' ? (
                <form action={setCashDeviceAction.bind(null, true, 'Caja 1')}><button className="ditem" style={{ width: '100%', background: 'none', border: 0 }}><Icon name="lock" size={19} /> Activar modo caja (PIN)</button></form>
              ) : null}
              <form action={logoutAction}><button className="ditem" style={{ width: '100%', background: 'none', border: 0 }}><Icon name="logout" size={19} /> Cerrar sesión</button></form>
            </div>
          </>
        )}
      >
        {p.children}
      </DrawerProvider>
      <PushSetup />
      </NotifCtx.Provider>
    </div>
  )
}
