'use client'
import { useState } from 'react'
import { saveTicketAction } from '@/app/actions/business'
import { Icon } from '@/components/icons'
import { Field, Seg, SwRow, useAction } from '@/components/ui'
import { Ticket, type TicketSale, type TicketSettings } from './ticket'

export const SAMPLE: TicketSale = {
  folio: 125, date: new Date().toISOString(), subtotal: '133.62', tax: '21.38', total: '155.00', payments: [{ method: 'cash', amount: '155.00' }], cash_received: '200.00', change: '45.00',
  items: [{ title: 'Capuchino', qty: 2, unit_price: '55', line_total: '110', sale_unit: 'pieza' }, { title: 'Americano', qty: 1, unit_price: '45', line_total: '45', sale_unit: 'pieza' }],
}

export function TicketDesigner({ t, cashier, device }: { t: { settings: TicketSettings; business: { name: string; logo: string | null }; qrUrl: string; qrLabel: string; taxRate: number }; cashier: string; device: string }) {
  const [s, setS] = useState(t.settings)
  const { run, busy } = useAction()
  const set = <K extends keyof TicketSettings>(k: K, v: TicketSettings[K]) => setS((x) => ({ ...x, [k]: v }))
  const text = (k: 'header_name' | 'address_text' | 'phone_text' | 'thanks_message' | 'qr_text' | 'footer_text', label: string, ph = '') => (
    <Field label={label}><input className="inp" value={s[k] ?? ''} placeholder={ph} onChange={(e) => set(k, e.target.value)} /></Field>
  )
  return (
    <>
      <div className="scroll pad">
        <div className="cols tk-cols"><div className="col tk-prev">
        <div className="qrbox" style={{ padding: '18px 8px' }}>
          <Ticket s={s} sale={SAMPLE} business={t.business} cashier={cashier} device={device} qrUrl={t.qrUrl} qrLabel={t.qrLabel} taxRate={t.taxRate} printable />
        </div>
        </div><div className="col">
        <div className="sec" style={{ marginTop: 4 }}>Papel</div>
        <Seg value={String(s.paper_width)} options={[['58', '58 mm (384 puntos)'], ['80', '80 mm (576 puntos)']]} onChange={(v) => set('paper_width', Number(v))} />
        <div className="sec">Qué se muestra</div>
        <div className="box">
          <SwRow title="Logo" on={s.show_logo} onChange={(v) => set('show_logo', v)} />
          <SwRow title="Dirección" on={s.show_address} onChange={(v) => set('show_address', v)} />
          <SwRow title="Teléfono" on={s.show_phone} onChange={(v) => set('show_phone', v)} />
          <SwRow title="Desglose de IVA" on={s.show_tax_breakdown} onChange={(v) => set('show_tax_breakdown', v)} />
          <SwRow title="Pago y cambio" on={s.show_payment} onChange={(v) => set('show_payment', v)} />
          <SwRow title="Código QR" hint="Es tu mismo QR dinámico." on={s.show_qr} onChange={(v) => set('show_qr', v)} />
          <SwRow title="Quién atendió" on={s.show_cashier} onChange={(v) => set('show_cashier', v)} />
        </div>
        <div className="sec">Textos</div>
        {text('header_name', 'Nombre en el ticket', t.business.name)}
        {text('address_text', 'Dirección')}
        {text('phone_text', 'Teléfono')}
        {text('thanks_message', 'Mensaje de agradecimiento')}
        {text('qr_text', 'Texto del QR')}
        {text('footer_text', 'Texto adicional (políticas)')}
        <button className="btn ghost sm" onClick={() => window.print()}><Icon name="printer" size={16} /> Imprimir prueba</button>
        </div></div>
      </div>
      <div className="sticky"><button className="btn" disabled={busy} onClick={() => run(saveTicketAction({ ...s, paper_width: s.paper_width as 58 | 80 }), 'Diseño guardado')}><Icon name="check" /> Guardar diseño</button></div>
    </>
  )
}
