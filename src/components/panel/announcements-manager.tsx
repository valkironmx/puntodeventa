'use client'
import { useState } from 'react'
import { deleteAnnouncementAction, sendAnnouncementAction } from '@/app/actions/super'
import { Icon } from '@/components/icons'
import { Field, useAction } from '@/components/ui'
import { TERMS, type Mode } from '@/lib/terms'

interface Sent { id: string; title: string; body: string; link: string | null; modes: string[] | null; at: string; readers: number }
const MODES: Mode[] = ['food', 'retail', 'service']

export function AnnouncementsManager({ sent, byMode }: { sent: Sent[]; byMode: Record<string, number> }) {
  const [f, setF] = useState({ title: '', body: '', link: '' })
  const [all, setAll] = useState(true)
  const [modes, setModes] = useState<Mode[]>([])
  const { run, busy } = useAction()
  const total = MODES.reduce((a, m) => a + (byMode[m] ?? 0), 0)
  const reach = all ? total : modes.reduce((a, m) => a + (byMode[m] ?? 0), 0)
  const toggle = (m: Mode) => setModes((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]))
  const audience = (m: string[] | null) => (!m ? 'Todos los negocios' : m.map((x) => `Modo ${TERMS[x as Mode].modeName}`).join(' · '))
  const send = async () => {
    if (!confirm(`¿Enviar este aviso a ${reach} ${reach === 1 ? 'negocio' : 'negocios'}? Lo verán todos sus usuarios.`)) return
    if (await run(sendAnnouncementAction({ ...f, modes: all ? [] : modes }), 'Aviso enviado')) { setF({ title: '', body: '', link: '' }); setAll(true); setModes([]) }
  }
  return (
    <div className="cols">
      <div className="col">
        <div className="sec" style={{ marginTop: 4 }}>Nuevo aviso</div>
        <div className="box">
          <Field label="Título"><input className="inp" value={f.title} maxLength={80} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ej. Nueva función: promociones" /></Field>
          <Field label="Mensaje"><textarea className="inp" style={{ height: 120 }} value={f.body} maxLength={600} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="Escribe el aviso o la promoción para tus clientes." /></Field>
          <Field label="Enlace (opcional)" hint="Una página web (https://…) o una sección del panel, por ejemplo /app/promociones.">
            <input className="inp" value={f.link} maxLength={300} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="https://" />
          </Field>
          <div className="sec" style={{ marginTop: 6 }}>¿A quién se envía?</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className={`chip ${all ? 'on' : ''}`} onClick={() => { setAll(true); setModes([]) }}>Todos ({total})</button>
            {MODES.map((m) => (
              <button type="button" key={m} className={`chip ${!all && modes.includes(m) ? 'on' : ''}`} onClick={() => { setAll(false); toggle(m) }}>
                <Icon name={TERMS[m].icon} size={14} style={{ verticalAlign: -2, marginRight: 5 }} />{TERMS[m].modeName} ({byMode[m] ?? 0})
              </button>
            ))}
          </div>
          <div className="hint" style={{ marginBottom: 14 }}>Llegará a {reach} {reach === 1 ? 'negocio' : 'negocios'} y lo verán todos sus usuarios: dueño, administradores y cajeros.</div>
          <button className="btn" disabled={busy || f.title.trim().length < 3 || f.body.trim().length < 3 || (!all && modes.length === 0)} onClick={send}><Icon name="megaphone" /> Enviar aviso</button>
        </div>
      </div>
      <div className="col">
        <div className="sec" style={{ marginTop: 4 }}>Enviados <small className="mut">{sent.length}</small></div>
        {sent.length === 0 ? <div className="empty">Aún no has enviado avisos.</div> : null}
        {sent.map((a) => (
          <div className="qcard" key={a.id}>
            <div className="t"><span className="f">{a.at}</span><span className="st duenio">{audience(a.modes)}</span></div>
            <div className="c">{a.title}</div>
            <p className="mut" style={{ margin: '2px 0 0', whiteSpace: 'pre-wrap' }}>{a.body}</p>
            {a.link ? <div className="hint" style={{ wordBreak: 'break-all' }}>Enlace: {a.link}</div> : null}
            <div className="b">
              <span>Leído por {a.readers} {a.readers === 1 ? 'usuario' : 'usuarios'}</span>
              <button className="ibtn sm" style={{ color: '#C53030' }} disabled={busy} onClick={() => confirm(`¿Eliminar el aviso "${a.title}"? Dejará de verse en todos los paneles.`) && run(deleteAnnouncementAction(a.id), 'Aviso eliminado')} aria-label="Eliminar aviso"><Icon name="trash" size={15} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
