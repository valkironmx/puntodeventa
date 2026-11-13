'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { saveTicketAction } from '@/app/actions/business'
import { Icon } from '@/components/icons'
import { Seg, SwRow, useAction } from '@/components/ui'
import { Ticket, type TicketSettings } from './ticket'
import { SAMPLE } from './ticket-designer'

type T = { settings: TicketSettings & { auto_print: boolean; open_cash_drawer: boolean }; business: { name: string; logo: string | null }; qrUrl: string; qrLabel: string; taxRate: number }

export function PrinterSettings({ t, cashier, device }: { t: T; cashier: string; device: string }) {
  const [s, setS] = useState(t.settings)
  const [web, setWeb] = useState(false)
  const { run } = useAction()
  useEffect(() => { try { setWeb(localStorage.getItem('impresion-web') === '1') } catch { /* */ } }, [])
  const save = (patch: Partial<T['settings']>) => { setS((x) => ({ ...x, ...patch })); run(saveTicketAction(patch as Parameters<typeof saveTicketAction>[0])) }
  return (
    <>
      <div className="box">
        <div className="prn"><span className="qi"><Icon name="printer" /></span><div><b>Impresora de este equipo</b><small>Navegador · impresoras USB instaladas</small></div></div>
        <div className="hint">En la web se imprime con el cuadro de impresión del navegador a {s.paper_width} mm. Elige tu impresora térmica y “sin márgenes”.</div>
      </div>
      <div className="box">
        <div className="prn"><span className="qi"><Icon name="bt" /></span><div><b>Bluetooth (app móvil)</b><small style={{ color: 'var(--mut)' }}>Disponible en la app Android / iPhone</small></div></div>
        <div className="hint">La búsqueda y conexión de impresoras térmicas ESC/POS por Bluetooth se activa en la app nativa (fase 8). Android: Bluetooth clásico y BLE. iPhone: solo BLE.</div>
      </div>
      <div className="sec">Ancho de papel</div>
      <Seg value={String(s.paper_width)} options={[['58', '58 mm'], ['80', '80 mm']]} onChange={(v) => save({ paper_width: Number(v) })} />
      <div className="box" style={{ marginTop: 14 }}>
        <SwRow title="Imprimir automático al registrar venta" on={s.auto_print} onChange={(v) => save({ auto_print: v })} />
        <SwRow title="Imprimir desde este navegador" hint="Abre el cuadro de impresión en este equipo al cobrar." on={web} onChange={(v) => { setWeb(v); try { localStorage.setItem('impresion-web', v ? '1' : '0') } catch { /* */ } }} />
        <SwRow title="Logo en el ticket" hint="Se imprime en blanco y negro." on={s.show_logo} onChange={(v) => save({ show_logo: v })} />
        <SwRow title="Abrir cajón de dinero" hint="Comando ESC p (app móvil)." on={s.open_cash_drawer} onChange={(v) => save({ open_cash_drawer: v })} />
      </div>
      <button className="btn" onClick={() => window.print()}><Icon name="printer" /> Imprimir prueba</button>
      <div className="sec">Vista previa <Link href="/app/ticket" className="lk">Editar diseño</Link></div>
      <div className="qrbox" style={{ padding: '18px 8px' }}>
        <Ticket s={s} sale={SAMPLE} business={t.business} cashier={cashier} device={device} qrUrl={t.qrUrl} qrLabel={t.qrLabel} taxRate={t.taxRate} printable />
      </div>
    </>
  )
}
