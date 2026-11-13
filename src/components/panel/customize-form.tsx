'use client'
import { PhoneInput } from '@/components/inputs'
import { useRef, useState } from 'react'
import { saveBusinessAction } from '@/app/actions/business'
import { Icon } from '@/components/icons'
import { Field, Sw, useAction, useToast } from '@/components/ui'
import { initials, storageUrl } from '@/lib/format'
import type { ScheduleRow } from '@/lib/hours'
import { ORDER_TYPE_LABELS } from '@/lib/mode-defaults'
import { dominantColor, uploadImage } from '@/lib/image'

const PALETTE = ['#1F8A6B', '#2F5FD0', '#C2562B', '#B4233C', '#7A3FC2', '#16211D']
const LINKS: [string, string, string, string, string][] = [
  ['whatsapp', 'wa', 'WhatsApp', 'whatsapp', 'Número a 10 dígitos'],
  ['facebook', 'facebook', 'Facebook', 'facebook', 'Usuario o enlace de tu página'],
  ['tiktok', 'tiktok', 'TikTok', 'tiktok', 'Usuario (sin @)'],
  ['instagram', 'ig', 'Instagram', 'instagram', 'Usuario (sin @)'],
  ['custom', 'link', 'Enlace personalizado', '', ''],
]
const EXTRA: [string, string][] = [['tiktok', 'TikTok'], ['email', 'Correo'], ['web', 'Sitio web']]

export interface Biz {
  id: string; name: string; tagline: string; logo_path: string | null; hero_path: string | null; hero_focal_x: number; hero_focal_y: number
  hero_title: string; hero_text: string; hero_button: string; hero_action: 'catalog' | 'whatsapp' | 'booking' | 'none'
  hero_links: { show: string[]; custom: { label: string; url: string } | null; call?: boolean }
  order_types: string[]
  accent_color: string; accent_auto: boolean; address: string; maps_url: string; lat: number | null; lng: number | null
  contact: Record<string, string>; schedule: ScheduleRow[]
}

export function CustomizeForm({ b, onSaved, compact, booking, catalogWord, availableTypes }: { b: Biz; onSaved?: () => void; compact?: 'hero' | 'logo' | 'contact'; booking?: boolean; catalogWord?: string; availableTypes?: string[] }) {
  const [f, setF] = useState(b)
  const [busyImg, setBusyImg] = useState(false)
  const [extra, setExtra] = useState<string[]>(EXTRA.map(([k]) => k).filter((k) => b.contact[k]))
  const heroRef = useRef<HTMLInputElement>(null), logoRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const { run, busy } = useAction()
  const set = <K extends keyof Biz>(k: K, v: Biz[K]) => setF((x) => ({ ...x, [k]: v }))
  const setC = (k: string, v: string) => setF((x) => ({ ...x, contact: { ...x.contact, [k]: v } }))
  const setLink = (k: string, on: boolean) => setF((x) => {
    const show = on ? (x.hero_links.show.includes(k) || x.hero_links.show.length >= 4 ? x.hero_links.show : [...x.hero_links.show, k]) : x.hero_links.show.filter((y) => y !== k)
    return { ...x, hero_links: { show, custom: k === 'custom' && on && !x.hero_links.custom ? { label: '', url: 'https://' } : x.hero_links.custom } }
  })
  const setCustom = (patch: Partial<{ label: string; url: string }>) => setF((x) => ({ ...x, hero_links: { ...x.hero_links, custom: { label: '', url: '', ...(x.hero_links.custom ?? {}), ...patch } } }))
  const hero = storageUrl(f.hero_path), logo = storageUrl(f.logo_path)

  const upload = async (e: React.ChangeEvent<HTMLInputElement>, kind: 'hero' | 'logo') => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusyImg(true)
    try {
      const path = await uploadImage(file, kind, b.id)
      if (kind === 'hero') {
        const color = f.accent_auto ? await dominantColor(file) : f.accent_color
        setF((x) => ({ ...x, hero_path: path, hero_focal_x: 50, hero_focal_y: 50, accent_color: color }))
      } else set('logo_path', path)
    } catch (err) { toast(err instanceof Error ? err.message : 'No se pudo subir', true) }
    setBusyImg(false)
  }
  const focal = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hero) return heroRef.current?.click()
    const r = e.currentTarget.getBoundingClientRect()
    setF((x) => ({ ...x, hero_focal_x: Math.round(((e.clientX - r.left) / r.width) * 100), hero_focal_y: Math.round(((e.clientY - r.top) / r.height) * 100) }))
  }
  const locate = () => navigator.geolocation?.getCurrentPosition(
    (p) => setF((x) => ({ ...x, lat: p.coords.latitude, lng: p.coords.longitude, maps_url: `https://maps.google.com/?q=${p.coords.latitude},${p.coords.longitude}` })),
    () => toast('No pudimos obtener tu ubicación', true))
  const save = async () => {
    const contact = Object.fromEntries(Object.entries(f.contact).map(([k, v]) => [k, (v ?? '').trim()]).filter(([, v]) => v))
    const hero_links = { show: f.hero_links.show, custom: f.hero_links.show.includes('custom') ? f.hero_links.custom : null, call: f.hero_links.call !== false }
    const order_types = compact ? undefined : f.order_types
    const ok = await run(saveBusinessAction({ ...f, order_types, hero_links, id: undefined, tagline: f.tagline || null, hero_title: f.hero_title || null, hero_text: f.hero_text || null, hero_button: f.hero_button || null, address: f.address || null, maps_url: f.maps_url || null, contact } as Parameters<typeof saveBusinessAction>[0]), 'Cambios guardados')
    if (ok) onSaved?.()
  }

  const heroBox = (
    <>
      <div className="hp" onClick={focal}>
        {hero ? <img src={hero} alt="" style={{ objectPosition: `${f.hero_focal_x}% ${f.hero_focal_y}%` }} /> : null}
        {hero ? <span className="fp" style={{ left: `${f.hero_focal_x}%`, top: `${f.hero_focal_y}%` }} /> : null}
        <button type="button" className="hpb" style={{ border: 0, cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); heroRef.current?.click() }}><Icon name="image" size={14} /> {busyImg ? 'Subiendo…' : hero ? 'Cambiar' : 'Subir portada'}</button>
        <div className="hpi"><div className="logo" style={logo ? { background: `#fff url(${logo}) center/cover` } : { color: f.accent_color }}>{logo ? '' : initials(f.name)}</div><b>{f.name}</b></div>
      </div>
      <div className="hint">{hero ? 'Toca la imagen para elegir el punto de enfoque.' : 'Sube una foto horizontal de tu negocio.'}</div>
      {compact ? null : (
        <div className="box" style={{ marginTop: 12 }}>
          <b style={{ fontSize: 13.5 }}>Botones del banner principal</b>
          <div className="hint" style={{ margin: '2px 0 10px' }}>El banner muestra el nombre de tu negocio, el horario de hoy y hasta 4 botones. Activa los que quieras y escribe a dónde llevan.</div>
          <div className={`hl-row ${f.hero_links.call !== false ? 'on' : ''}`}>
            <div className="hl-top">
              <span className="hl-ic"><Icon name="phone" size={18} /></span>
              <b>Llamar <small className="mut" style={{ fontWeight: 500 }}>· solo en celular</small></b>
              <Sw on={f.hero_links.call !== false} label="Botón Llamar" onChange={(v) => setF((x) => ({ ...x, hero_links: { ...x.hero_links, call: v } }))} />
            </div>
            {f.hero_links.call !== false ? (
              <PhoneInput style={{ marginTop: 8 }} placeholder="Teléfono a 10 dígitos" value={f.contact.phone ?? ''} onChange={(v) => setC('phone', v)} />
            ) : null}
            <div className="hint" style={{ margin: '4px 0 0 44px' }}>Viene activado. No cuenta dentro de los 4 botones y en computadora no se muestra.</div>
          </div>
          {LINKS.map(([k, icon, label, field, ph]) => {
            const on = f.hero_links.show.includes(k)
            const full = !on && f.hero_links.show.length >= 4
            return (
              <div key={k} className={`hl-row ${on ? 'on' : ''}`}>
                <div className="hl-top">
                  <span className="hl-ic"><Icon name={icon} size={18} /></span>
                  <b>{label}</b>
                  <Sw on={on} label={label} onChange={(v) => setLink(k, v)} />
                </div>
                {on ? (k === 'custom' ? (
                  <div className="g2" style={{ marginTop: 8 }}>
                    <input className="inp" placeholder="Texto (ej. Mi tienda)" maxLength={24} value={f.hero_links.custom?.label ?? ''} onChange={(e) => setCustom({ label: e.target.value })} />
                    <input className="inp" placeholder="https://" inputMode="url" value={f.hero_links.custom?.url ?? ''} onChange={(e) => setCustom({ url: e.target.value })} />
                  </div>
                ) : k === 'whatsapp' ? (
                  <PhoneInput style={{ marginTop: 8 }} placeholder={ph} value={f.contact[field] ?? ''} onChange={(v) => setC(field, v)} />
                ) : (
                  <input className="inp" style={{ marginTop: 8 }} placeholder={ph} value={f.contact[field] ?? ''} onChange={(e) => setC(field, e.target.value)} />
                )) : full ? <div className="hint" style={{ margin: '4px 0 0 44px' }}>Ya tienes 4 botones. Apaga uno para activar este.</div> : null}
              </div>
            )
          })}
          <div className="hint" style={{ marginTop: 8 }}>{f.hero_links.show.length} de 4 botones activos. Si un botón no tiene dato, no se muestra.</div>
        </div>
      )}
      <input ref={heroRef} type="file" accept="image/*" hidden onChange={(e) => upload(e, 'hero')} />
    </>
  )
  const logoBox = (
    <div className="box">
      <div className="lgrow">
        <div className="logo" style={logo ? { background: `#fff url(${logo}) center/cover` } : { color: f.accent_color }}>{logo ? '' : initials(f.name)}</div>
        <div style={{ flex: 1 }}><b style={{ fontSize: 13.5 }}>Logo</b><div className="hint" style={{ marginTop: 2 }}>PNG con transparencia recomendado.</div></div>
        <button type="button" className="btn ghost sm" style={{ width: 'auto', padding: '0 14px' }} onClick={() => logoRef.current?.click()}>{logo ? 'Cambiar' : 'Subir'}</button>
      </div>
      <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => upload(e, 'logo')} />
    </div>
  )
  const contactBox = (
    <>
      <Field label="WhatsApp (10 dígitos)"><PhoneInput value={f.contact.whatsapp ?? ''} onChange={(v) => setC('whatsapp', v)} /></Field>
      <Field label="Teléfono (10 dígitos)"><PhoneInput value={f.contact.phone ?? ''} onChange={(v) => setC('phone', v)} /></Field>
      <div className="g2">
        <Field label="Instagram"><input className="inp" value={f.contact.instagram ?? ''} placeholder="usuario" onChange={(e) => setC('instagram', e.target.value)} /></Field>
        <Field label="Facebook"><input className="inp" value={f.contact.facebook ?? ''} placeholder="pagina" onChange={(e) => setC('facebook', e.target.value)} /></Field>
      </div>
      {EXTRA.filter(([k]) => extra.includes(k)).map(([k, l]) => <Field key={k} label={l}><input className="inp" value={f.contact[k] ?? ''} onChange={(e) => setC(k, e.target.value)} /></Field>)}
      {EXTRA.some(([k]) => !extra.includes(k)) ? (
        <button type="button" className="addl" style={{ border: 0, background: 'none' }} onClick={() => setExtra((x) => [...x, EXTRA.find(([k]) => !x.includes(k))![0]])}><Icon name="plus" size={16} /> Agregar otro</button>
      ) : null}
    </>
  )

  if (compact) {
    return (
      <>
        {compact === 'hero' ? heroBox : compact === 'logo' ? logoBox : contactBox}
        <button className="btn" style={{ marginTop: 16 }} disabled={busy || busyImg} onClick={save}>Guardar y continuar</button>
      </>
    )
  }
  return (
    <>
      <div className="scroll pad">
        <div className="cols"><div className="col">
        {heroBox}
        <div style={{ height: 14 }} />
        {logoBox}
        <div className="box">
          <b style={{ fontSize: 13.5 }}>Color de acento</b>
          <div className="sws" style={{ marginTop: 10 }}>
            <button type="button" className={`swc auto ${f.accent_auto ? 'on' : ''}`} onClick={() => set('accent_auto', true)} aria-label="Automático (de la portada)" title="Automático" />
            {PALETTE.map((c) => <button type="button" key={c} className={`swc ${!f.accent_auto && f.accent_color.toLowerCase() === c.toLowerCase() ? 'on' : ''}`} style={{ background: c }} onClick={() => setF((x) => ({ ...x, accent_color: c, accent_auto: false }))} aria-label={`Color ${c}`} />)}
          </div>
          <div className="hint">Automático toma el color dominante de tu portada al subirla.</div>
        </div>
        <Field label="Nombre del negocio"><input className="inp" value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={80} /></Field>
        <Field label="Eslogan"><input className="inp" value={f.tagline} onChange={(e) => set('tagline', e.target.value)} maxLength={120} /></Field>
        </div><div className="col">
        {availableTypes?.length ? (
          <>
            <div className="sec" style={{ marginTop: 4 }}>Tipos de entrega en el pedido</div>
            <div className="box">
              <div className="hint" style={{ marginTop: 0, marginBottom: 6 }}>Elige qué opciones ve tu cliente en "¿Cómo lo quieres?". Si solo dejas una, ya no se le pregunta.</div>
              {availableTypes.map((t) => {
                const on = f.order_types.includes(t)
                const last = on && f.order_types.length === 1
                return (
                  <div className="swrow" key={t} style={{ padding: '7px 0' }}>
                    <div><b>{ORDER_TYPE_LABELS[t]}</b>{last ? <small>Debe quedar al menos una opción</small> : null}</div>
                    <Sw on={on} label={ORDER_TYPE_LABELS[t]} onChange={(v) => !last && set('order_types', v ? availableTypes.filter((x) => x === t || f.order_types.includes(x)) : f.order_types.filter((x) => x !== t))} />
                  </div>
                )
              })}
            </div>
          </>
        ) : null}
        <div className="sec">Contacto</div>
        {contactBox}
        <div className="sec">Ubicación</div>
        <Field label="Dirección"><input className="inp" value={f.address} onChange={(e) => set('address', e.target.value)} maxLength={200} /></Field>
        <Field label="Link de Google Maps"><input className="inp" value={f.maps_url} onChange={(e) => set('maps_url', e.target.value)} placeholder="https://maps.google.com/…" /></Field>
        <button type="button" className="btn ghost sm" onClick={locate}><Icon name="pin" size={16} /> Usar mi ubicación actual</button>
        <div className="sec">Horario</div>
        <div className="box">
          {f.schedule.map((r, i) => {
            const upd = (patch: Partial<ScheduleRow>) => set('schedule', f.schedule.map((y, j) => (j === i ? { ...y, ...patch } : y)))
            return (
              <div className="hr" key={i}>
                <b>{r.days}</b>
                {r.enabled ? (
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="time" className="inp" style={{ height: 36, padding: '0 6px', fontSize: 12.5 }} value={r.open} onChange={(e) => upd({ open: e.target.value })} aria-label={`Abre ${r.days}`} />
                    <input type="time" className="inp" style={{ height: 36, padding: '0 6px', fontSize: 12.5 }} value={r.close} onChange={(e) => upd({ close: e.target.value })} aria-label={`Cierra ${r.days}`} />
                  </span>
                ) : <span>Cerrado</span>}
                <Sw on={r.enabled} label={`Abierto ${r.days}`} onChange={(v) => upd({ enabled: v })} />
              </div>
            )
          })}
        </div>
        </div></div>
      </div>
      <div className="sticky"><button className="btn" disabled={busy || busyImg} onClick={save}><Icon name="check" /> Guardar cambios</button></div>
    </>
  )
}
