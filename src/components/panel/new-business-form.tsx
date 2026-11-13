'use client'
import { PhoneInput } from '@/components/inputs'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { checkSlugAction, createBusinessAction } from '@/app/actions/super'
import { Icon } from '@/components/icons'
import { Field, Seg, useAction, useToast } from '@/components/ui'
import { MODE_DEFAULTS } from '@/lib/mode-defaults'
import { TERMS, type Mode } from '@/lib/terms'

export function NewBusinessForm({ domain, plans }: { domain: string; plans: { code: string; name: string; days: number }[] }) {
  const [f, setF] = useState({ name: '', ownerName: '', ownerEmail: '', phone: '', mode: 'food' as Mode, plan: plans.find((p) => p.code === 'basico')?.code ?? plans[0]?.code ?? '' })
  const [slug, setSlug] = useState<{ slug: string; status: string; suggestion: string | null } | null>(null)
  const [done, setDone] = useState<{ id: string; inviteLink: string | null; slug: string } | null>(null)
  const { run, busy } = useAction()
  const toast = useToast()
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }))
  useEffect(() => {
    if (!f.name.trim()) { setSlug(null); return }
    const t = setTimeout(() => checkSlugAction(f.name).then(setSlug), 250)
    return () => clearTimeout(t)
  }, [f.name])
  const finalSlug = slug ? (slug.status === 'available' ? slug.slug : slug.suggestion) : null
  const create = async () => {
    if (!finalSlug) return
    const r = await run(createBusinessAction({ ...f, slug: finalSlug }))
    if (r && r !== true) setDone({ ...r, slug: finalSlug })
  }
  if (done) {
    const link = done.inviteLink ? window.location.origin + done.inviteLink : null
    return (
      <div className="scroll pad" style={{ textAlign: 'center', paddingTop: 40 }}>
        <div className="done" style={{ position: 'static', padding: 0, background: 'none' }}>
          <div className="ok"><Icon name="check" size={44} stroke={3} /></div>
          <div className="dt">Negocio creado</div>
          <p className="mut">{domain}/{done.slug} ya está funcionando, vacío y listo para configurar. Se generó su QR dinámico.</p>
        </div>
        {link ? (
          <div className="box" style={{ textAlign: 'left', marginTop: 16 }}>
            <b style={{ fontSize: 13.5 }}>Invitación del dueño</b>
            <div className="hint">En local no se envía correo. Comparte este enlace para que cree su contraseña:</div>
            <div className="slug" style={{ wordBreak: 'break-all' }}><b>{link}</b></div>
            <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => navigator.clipboard.writeText(link).then(() => toast('Enlace copiado'))}><Icon name="copy" size={15} /> Copiar enlace</button>
          </div>
        ) : <div className="vbox" style={{ marginTop: 16 }}>Ese correo ya tenía cuenta: el dueño entra con su contraseña actual.</div>}
        <Link href={`/super/negocios/${done.id}`} className="btn" style={{ marginTop: 12 }}>Ver negocio</Link>
      </div>
    )
  }
  return (
    <>
      <div className="scroll pad">
        <div className="cols"><div className="col">
        <Field label="Nombre del negocio"><input className="inp" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Café La Luna" maxLength={80} /></Field>
        {slug && slug.slug ? (
          <div className={`slug ${slug.status === 'available' ? '' : 'bad'}`} style={{ marginTop: -6, marginBottom: 14 }}>
            <Icon name={slug.status === 'available' ? 'check' : 'x'} size={15} />
            <span>{domain}/<b>{slug.slug}</b> · {slug.status === 'available' ? 'disponible' : slug.status === 'reserved' ? 'reservado' : slug.status === 'taken' ? 'ocupado' : 'no válido'}
              {slug.status !== 'available' && slug.suggestion ? <> — se usará <b style={{ color: 'var(--g)' }}>{slug.suggestion}</b></> : null}</span>
          </div>
        ) : null}
        <Field label="Nombre del dueño"><input className="inp" value={f.ownerName} onChange={(e) => set('ownerName', e.target.value)} maxLength={60} /></Field>
        <Field label="Correo del dueño"><input className="inp" type="email" value={f.ownerEmail} onChange={(e) => set('ownerEmail', e.target.value)} /></Field>
        <Field label="Teléfono / WhatsApp"><PhoneInput value={f.phone} onChange={(v) => set('phone', v)} /></Field>
        </div><div className="col">
        <div className="sec" style={{ marginTop: 4 }}>Modo del negocio</div>
        {(Object.keys(MODE_DEFAULTS) as Mode[]).map((m) => (
          <button type="button" key={m} className={`mcard ${f.mode === m ? 'on' : ''}`} onClick={() => set('mode', m)}>
            <span className="me"><Icon name={TERMS[m].icon} size={24} /></span>
            <span><b>{MODE_DEFAULTS[m].title}</b><small>{MODE_DEFAULTS[m].description}</small><em>Categorías: {MODE_DEFAULTS[m].categories.join(', ')}</em></span>
            <span className="mr"><Icon name="check" size={14} stroke={3} /></span>
          </button>
        ))}
        <div className="sec">Plan</div>
        <select className="inp" value={f.plan} onChange={(e) => set('plan', e.target.value)}>{plans.map((p) => <option key={p.code} value={p.code}>{p.name} · {p.days} días</option>)}</select>
        <div className="box steps" style={{ marginTop: 16 }}>
          <div>Se reserva el enlace público y se crea su QR dinámico.</div>
          <div>Se crean el ticket, los folios y las categorías sugeridas.</div>
          <div>El dueño recibe su invitación y configura su negocio con el asistente.</div>
        </div>
        </div></div>
      </div>
      <div className="sticky"><button className="btn" disabled={busy || !finalSlug || !f.ownerEmail} onClick={create}><Icon name="check" /> Crear negocio</button></div>
    </>
  )
}
