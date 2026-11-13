'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { finishOnboardingAction, setModeAction } from '@/app/actions/business'
import { Icon } from '@/components/icons'
import { useAction } from '@/components/ui'
import { CustomizeForm, type Biz } from './customize-form'
import { ModeCards } from './mode-settings'

const STEPS = ['¿Qué vendes?', 'Portada', 'Logo', 'Contacto', 'Primer producto']

export function Wizard({ b, mode, newItem }: { b: Biz; mode: string; newItem: string }) {
  const [step, setStep] = useState(0)
  const [m, setM] = useState(mode)
  const { run, busy } = useAction()
  const router = useRouter()
  const next = () => { router.refresh(); setStep((s) => s + 1) }
  const finish = async (to: string) => { if (await run(finishOnboardingAction())) router.push(to) }
  return (
    <div className="scroll pad narrow" style={{ paddingTop: 22 }}>
      <div className="mut" style={{ fontWeight: 800 }}>Paso {step + 1} de {STEPS.length}</div>
      <div className="bar2" style={{ margin: '8px 0 16px' }}><i style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
      <div className="hi" style={{ marginBottom: 14 }}>{STEPS[step]}</div>
      {step === 0 ? (
        <>
          <p className="mut" style={{ marginTop: 0 }}>Adaptamos las palabras y funciones a tu negocio. Puedes cambiarlo después en Ajustes.</p>
          <ModeCards mode={m} onPick={setM} />
          <button className="btn" disabled={busy} onClick={async () => { if (m === mode || await run(setModeAction(m))) next() }}>Continuar</button>
        </>
      ) : null}
      {step === 1 ? <CustomizeForm b={b} compact="hero" onSaved={next} /> : null}
      {step === 2 ? <CustomizeForm b={b} compact="logo" onSaved={next} /> : null}
      {step === 3 ? <CustomizeForm b={b} compact="contact" onSaved={next} /> : null}
      {step === 4 ? (
        <>
          <p className="mut" style={{ marginTop: 0 }}>¡Listo! Tu página ya está publicada. Agrega tu primer registro al catálogo o hazlo más tarde.</p>
          <button className="btn" disabled={busy} onClick={() => finish('/app/catalogo/nuevo')}><Icon name="plus" /> {newItem}</button>
          <button className="btn ghost" style={{ marginTop: 10 }} disabled={busy} onClick={() => finish('/app')}>Ir al inicio</button>
        </>
      ) : null}
      {step > 0 && step < 4 ? <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setStep((s) => s + 1)}>Omitir por ahora</button> : null}
    </div>
  )
}
