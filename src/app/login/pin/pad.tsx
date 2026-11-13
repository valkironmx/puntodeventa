'use client'
import { useState, useTransition } from 'react'
import { logoutAction, pinLoginAction } from '@/app/actions/auth'
import { NumPad } from '@/components/ui'
import { initials } from '@/lib/format'
import { ROLE_LABEL } from '@/lib/permissions'

export function PinPad({ staff }: { staff: { id: string; name: string; role: string }[] }) {
  const [who, setWho] = useState(staff[0]?.id ?? '')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const change = (v: string) => {
    setError('')
    setPin(v)
    if (v.length === 4) start(async () => { const r = await pinLoginAction(who, v); if (r?.error) { setError(r.error); setPin('') } })
  }
  return (
    <>
      <div className="who" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        {staff.map((m) => (
          <button key={m.id} type="button" className={`whoi ${who === m.id ? 'on' : ''}`} style={{ background: 'none', border: 0 }} onClick={() => { setWho(m.id); setPin(''); setError('') }}>
            <span className="av">{initials(m.name)}</span>{m.name}<small className="mut" style={{ fontSize: 10.5 }}>{ROLE_LABEL[m.role]}</small>
          </button>
        ))}
      </div>
      <div className="pin-dots">{[0, 1, 2, 3].map((i) => <i key={i} className={pin.length > i ? 'on' : ''} />)}</div>
      {error ? <div className="err" style={{ textAlign: 'center' }}>{error}</div> : <p className="mut" style={{ textAlign: 'center', marginTop: 0 }}>{pending ? 'Verificando…' : 'Escribe tu PIN de 4 dígitos'}</p>}
      <NumPad value={pin} onChange={change} decimals={0} />
      <form action={logoutAction}><button className="btn ghost sm" style={{ marginTop: 18 }}>Cerrar sesión del dispositivo</button></form>
    </>
  )
}
