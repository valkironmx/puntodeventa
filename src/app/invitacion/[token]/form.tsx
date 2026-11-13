'use client'
import { useActionState } from 'react'
import { acceptInviteAction } from '@/app/actions/auth'

export function InviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInviteAction, null)
  return (
    <form action={action}>
      {state?.error ? <div className="err">{state.error}</div> : null}
      <input type="hidden" name="token" value={token} />
      <div className="field"><label htmlFor="password">Nueva contraseña</label>
        <input id="password" name="password" type="password" className="inp" minLength={8} autoComplete="new-password" required />
        <div className="hint">Mínimo 8 caracteres.</div>
      </div>
      <button className="btn" disabled={pending}>{pending ? 'Guardando…' : 'Crear contraseña y entrar'}</button>
    </form>
  )
}
