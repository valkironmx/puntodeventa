'use client'
import { useRouter } from 'next/navigation'
import { setFeaturesAction, setModeAction } from '@/app/actions/business'
import { Icon } from '@/components/icons'
import { SwRow, useAction } from '@/components/ui'
import { FEATURE_LABELS, MODE_DEFAULTS, type Features } from '@/lib/mode-defaults'
import { TERMS, type Mode } from '@/lib/terms'

export function ModeCards({ mode, onPick, busy }: { mode: string; onPick: (m: Mode) => void; busy?: boolean }) {
  return (
    <>
      {(Object.keys(MODE_DEFAULTS) as Mode[]).map((m) => (
        <button type="button" key={m} disabled={busy} className={`mcard ${mode === m ? 'on' : ''}`} onClick={() => onPick(m)}>
          <span className="me"><Icon name={TERMS[m].icon} size={24} /></span>
          <span><b>{MODE_DEFAULTS[m].title}</b><small>{MODE_DEFAULTS[m].description}</small><em>{MODE_DEFAULTS[m].example}</em></span>
          <span className="mr"><Icon name="check" size={14} stroke={3} /></span>
        </button>
      ))}
    </>
  )
}

export function ModeSettings({ mode, features }: { mode: string; features: Features }) {
  const { run, busy } = useAction()
  const router = useRouter()
  return (
    <>
      <div className="sec">Tipo de negocio</div>
      <div className="vbox"><Icon name="settings" size={18} /> Cambiar el tipo solo cambia las palabras, la presentación y los valores por defecto. No borra información.</div>
      <ModeCards mode={mode} busy={busy} onPick={async (m) => { if (m !== mode && confirm(`¿Cambiar a modo ${MODE_DEFAULTS[m].title}?`) && await run(setModeAction(m), 'Tipo de negocio actualizado')) { await run(setFeaturesAction({})); router.refresh() } }} />
      <div className="sec">Funciones</div>
      <div className="box">
        {(Object.keys(FEATURE_LABELS) as (keyof Features)[]).map((k) => (
          <SwRow key={k} title={FEATURE_LABELS[k][0]} hint={FEATURE_LABELS[k][1]} on={features[k]} onChange={(v) => run(setFeaturesAction({ ...features, [k]: v }))} />
        ))}
      </div>
      <div className="hint">Para casos mixtos: enciende o apaga funciones sueltas sin cambiar de tipo de negocio.</div>
    </>
  )
}
