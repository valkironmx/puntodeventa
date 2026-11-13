'use client'
import { useActionState } from 'react'
import { loginAction } from '@/app/actions/auth'

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null)
  return (
    <form action={action}>
      {state?.error ? <div className="err">{state.error}</div> : null}
      <div className="field"><label htmlFor="email">Correo</label>
        <input id="email" name="email" type="email" className="inp" autoComplete="username" placeholder="tucorreo@negocio.mx" required />
      </div>
      <div className="field"><label htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" className="inp" autoComplete="current-password" required />
      </div>
      <button className="btn" disabled={pending}>{pending ? 'Entrando…' : 'Entrar'}</button>
    </form>
  )
}
