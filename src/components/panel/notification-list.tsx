'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { markNotificationsReadAction } from '@/app/actions/notifications'
import { Icon } from '@/components/icons'
import { useNotif } from '@/components/ui'
import { ago, fmtDateTime } from '@/lib/format'

interface Item { kind: 'a' | 'n'; id: string; type: string; title: string; body: string | null; link: string | null; at: string; read: boolean }
const ICON: Record<string, string> = { aviso: 'megaphone', cita: 'calendar', stock: 'tag', plan: 'clock', sistema: 'bell' }

export function NotificationList({ items }: { items: Item[] }) {
  const notif = useNotif()
  const [tab, setTab] = useState<'all' | 'a' | 'n'>('all')
  // Al abrir se marcan como leídas; el resaltado se queda hasta la siguiente visita
  useEffect(() => {
    if (items.some((i) => !i.read)) markNotificationsReadAction().then(() => notif?.clear()).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const list = items.filter((i) => tab === 'all' || i.kind === tab)
  const unread = items.filter((i) => !i.read).length
  return (
    <>
      <div className="chips" style={{ paddingLeft: 0, paddingRight: 0, paddingTop: 0 }}>
        <button className={`chip ${tab === 'all' ? 'on' : ''}`} onClick={() => setTab('all')}>Todas</button>
        <button className={`chip ${tab === 'n' ? 'on' : ''}`} onClick={() => setTab('n')}>Negocio</button>
        <button className={`chip ${tab === 'a' ? 'on' : ''}`} onClick={() => setTab('a')}>Plataforma</button>
      </div>
      {list.map((i) => {
        const inner = (
          <>
            <span className={`ni ${i.type}`}><Icon name={ICON[i.type] ?? 'bell'} size={20} /></span>
            <div className="nb">
              <div className="nt"><b>{i.title}</b><small title={fmtDateTime(i.at)}>{ago(i.at)}</small></div>
              {i.body ? <p>{i.body}</p> : null}
            </div>
            {i.read ? null : <i className="ndot" aria-label="Sin leer" />}
            {i.link ? <span className="ngo"><Icon name="chevR" size={16} stroke={2.4} /></span> : null}
          </>
        )
        const cls = `notif ${i.read ? '' : 'unread'}`
        return i.link
          ? (i.link.startsWith('/') ? <Link key={i.kind + i.id} href={i.link} className={cls}>{inner}</Link> : <a key={i.kind + i.id} href={i.link} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>)
          : <div key={i.kind + i.id} className={cls}>{inner}</div>
      })}
      {list.length === 0 ? (
        <div className="cart-empty" style={{ paddingTop: 50 }}>
          <span><Icon name="bell" size={26} /></span><b>Todo al día</b>
          <small>Aquí verás lo nuevo.</small>
        </div>
      ) : null}
    </>
  )
}
