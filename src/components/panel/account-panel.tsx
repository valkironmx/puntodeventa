'use client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { changePasswordAction, deleteAccountAction } from '@/app/actions/auth'
import { Icon } from '@/components/icons'
import { Field, Sheet, useToast } from '@/components/ui'

interface Preview { is_super: boolean; businesses: { name: string; role: string; sole_owner: boolean }[] }

export function AccountPanel({ email, name, role, preview, cashMode }: { email: string; name: string; role: string; preview: Preview; cashMode: boolean }) {
  const toast = useToast()
  const [pending, start] = useTransition()
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [del, setDel] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const owned = preview.businesses.filter((b) => b.sole_owner)
  return (
    <>
      <div className="box">
        <div className="kv"><span>Nombre</span><b>{name}</b></div>
        <div className="kv"><span>Correo</span><b>{email}</b></div>
        <div className="kv"><span>Rol</span><b>{role}</b></div>
      </div>
      <div className="sec">Cambiar contraseña</div>
      <div className="box">
        <Field label="Contraseña actual"><input className="inp" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
        <Field label="Nueva contraseña" hint="Mínimo 8 caracteres."><input className="inp" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
        <button className="btn sm" disabled={pending || !cur || next.length < 8} onClick={() => start(async () => {
          const r = await changePasswordAction(cur, next)
          if (r.ok) { toast('Contraseña actualizada'); setCur(''); setNext('') } else toast(r.error ?? 'Error', true)
        })}>Guardar contraseña</button>
      </div>
      <div className="sec">Privacidad y legal</div>
      <div className="box">
        <Link className="dev" href="/privacidad" target="_blank"><span>Aviso de privacidad</span><Icon name="chevR" size={16} /></Link>
        <Link className="dev" href="/terminos" target="_blank"><span>Términos y condiciones</span><Icon name="chevR" size={16} /></Link>
        <Link className="dev" href="/soporte" target="_blank"><span>Soporte</span><Icon name="chevR" size={16} /></Link>
      </div>
      {preview.is_super ? null : (
        <>
          <div className="sec">Eliminar cuenta</div>
          <div className="box">
            <p className="mut" style={{ margin: '0 0 12px' }}>Borra tu usuario y tus datos personales de forma permanente.{owned.length ? ' Como eres el único dueño, también se borra tu negocio completo.' : ''}</p>
            <button className="btn ghost rj" disabled={cashMode} onClick={() => { setDel(true); setErr(''); setConfirm(''); setPw('') }}><Icon name="trash" size={17} /> Eliminar mi cuenta</button>
            {cashMode ? <div className="hint">Estás en modo caja. Inicia sesión con tu propia cuenta para eliminarla.</div> : null}
          </div>
        </>
      )}
      {del ? (
        <Sheet title="Eliminar mi cuenta" onClose={() => setDel(false)} top={120}>
          <div className="err">Esta acción es inmediata y no se puede deshacer.</div>
          <p className="mut" style={{ marginTop: 0 }}>Se eliminará tu usuario ({email}): nombre, correo, contraseña, PIN y sesiones.</p>
          {owned.length ? (
            <div className="vbox" style={{ display: 'block' }}>
              <b>También se eliminará por completo:</b>
              {owned.map((b) => <div key={b.name}>· {b.name}: catálogo, fotos, promociones, cotizaciones, ventas, cortes, citas, empleados y su página pública.</div>)}
            </div>
          ) : null}
          <Field label="Escribe ELIMINAR para confirmar"><input className="inp" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoCapitalize="characters" /></Field>
          <Field label="Tu contraseña"><input className="inp" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          {err ? <div className="err">{err}</div> : null}
          <button className="btn red" disabled={pending || confirm.trim().toUpperCase() !== 'ELIMINAR' || !pw} onClick={() => start(async () => {
            const r = await deleteAccountAction(confirm, pw)
            if (r && !r.ok) setErr(r.error ?? 'No se pudo eliminar')
          })}>{pending ? 'Eliminando…' : 'Eliminar definitivamente'}</button>
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setDel(false)}>Cancelar</button>
        </Sheet>
      ) : null}
    </>
  )
}
