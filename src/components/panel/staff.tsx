'use client'
import { useState } from 'react'
import { setCashDeviceAction } from '@/app/actions/auth'
import { inviteEmployeeAction, updateEmployeeAction } from '@/app/actions/staff'
import { Icon } from '@/components/icons'
import { Field, Seg, Sheet, Sw, useAction, useToast } from '@/components/ui'
import { initials } from '@/lib/format'
import { ROLE_CLASS, ROLE_LABEL } from '@/lib/permissions'

interface S { id: string; name: string; role: string; active: boolean; hasPin: boolean; email: string; invite: string | null }
const PERMS: [string, boolean, boolean, boolean][] = [
  ['Punto de venta (cobrar)', true, true, true], ['Catálogo y productos', false, true, true], ['Cotizaciones, ventas y pagos', false, true, true],
  ['Corte de caja', false, true, true], ['Aprobar sus propias citas', true, true, true], ['Toda la agenda', false, true, true],
  ['Personalizar, ticket y QR', false, true, true], ['Eliminar', false, false, true], ['Empleados y plan', false, false, true],
]

export function Staff({ staff, canEdit, cashDevice }: { staff: S[]; canEdit: boolean; cashDevice: boolean }) {
  const [add, setAdd] = useState(false)
  const [edit, setEdit] = useState<S | null>(null)
  const [f, setF] = useState({ name: '', email: '', role: 'cashier', pin: '' })
  const [pin, setPin] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const { run, busy } = useAction()
  const toast = useToast()
  const copy = (l: string) => navigator.clipboard.writeText(window.location.origin + l).then(() => toast('Enlace de invitación copiado'))
  return (
    <>
      <div className="box">
        {staff.map((m) => (
          <div className="emp" key={m.id} style={m.active ? undefined : { opacity: 0.5 }}>
            <div className="av">{initials(m.name)}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <b>{m.name}</b><small>{m.email}{m.active ? '' : ' · desactivado'}{m.hasPin ? ' · con PIN' : ''}</small>
              {m.invite ? <button onClick={() => copy(m.invite!)} style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer' }} className="lk">Invitación pendiente · copiar enlace</button> : null}
            </div>
            <span className={`st ${ROLE_CLASS[m.role]}`}>{ROLE_LABEL[m.role]}</span>
            {canEdit ? <button className="ibtn sm" onClick={() => { setEdit(m); setPin('') }} aria-label={`Editar ${m.name}`}><Icon name="edit" size={15} /></button> : null}
          </div>
        ))}
      </div>
      {canEdit ? <button className="btn" onClick={() => { setAdd(true); setLink(null) }}><Icon name="plus" /> Dar acceso a un empleado</button> : <div className="hint">Solo el dueño puede agregar o editar empleados.</div>}

      <div className="sec">Modo caja compartida</div>
      <div className="box">
        <div className="swrow">
          <div><b>Este dispositivo es una caja</b><small>Los empleados cambian de usuario con su PIN de 4 dígitos. Cada venta queda a nombre de quien cobró.</small></div>
          <Sw on={cashDevice} label="Modo caja" onChange={(v) => setCashDeviceAction(v, 'Caja 1')} />
        </div>
      </div>

      <div className="sec">Permisos por rol</div>
      <div className="box">
        <table className="perm">
          <thead><tr><th>Función</th><th>Cajero</th><th>Admin</th><th>Dueño</th></tr></thead>
          <tbody>{PERMS.map(([l, c, a, o]) => (
            <tr key={l}><td>{l}</td>{[c, a, o].map((v, i) => <td key={i} className={v ? 'y' : 'n'}>{v ? <Icon name="check" size={15} stroke={3} /> : '—'}</td>)}</tr>
          ))}</tbody>
        </table>
        <div className="hint">El administrador ve lo mismo que el dueño, pero no puede eliminar. El cajero solo usa el punto de venta.</div>
      </div>

      {add ? (
        <Sheet title="Dar acceso" onClose={() => setAdd(false)} top={120}>
          {link ? (
            <>
              <div className="allok"><Icon name="check" /> Empleado agregado</div>
              <p className="mut">En local no se envía correo. Comparte este enlace para que cree su contraseña:</p>
              <div className="slug" style={{ wordBreak: 'break-all' }}><b>{typeof window !== 'undefined' ? window.location.origin : ''}{link}</b></div>
              <button className="btn" style={{ marginTop: 12 }} onClick={() => copy(link)}><Icon name="copy" /> Copiar enlace</button>
            </>
          ) : (
            <>
              <Field label="Nombre"><input className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={60} /></Field>
              <Field label="Correo"><input className="inp" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
              <Field label="Rol"><Seg value={f.role} options={[['cashier', 'Cajero'], ['admin', 'Administrador']]} onChange={(v) => setF({ ...f, role: v })} /></Field>
              <Field label="PIN de 4 dígitos" hint="Para turnarse rápido en una caja compartida."><input className="inp" inputMode="numeric" value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} /></Field>
              <button className="btn" disabled={busy} onClick={async () => {
                const r = await run(inviteEmployeeAction(f))
                if (r && r !== true) { if (r.inviteLink) setLink(r.inviteLink); else { setAdd(false); toast('Empleado agregado') } setF({ name: '', email: '', role: 'cashier', pin: '' }) }
              }}>Enviar invitación</button>
            </>
          )}
        </Sheet>
      ) : null}
      {edit ? (
        <Sheet title={edit.name} onClose={() => setEdit(null)} top={220}>
          {edit.role === 'owner' ? <p className="mut">El dueño siempre tiene acceso completo.</p> : (
            <>
              <Field label="Rol"><Seg value={edit.role} options={[['cashier', 'Cajero'], ['admin', 'Administrador']]} onChange={async (v) => { if (await run(updateEmployeeAction({ id: edit.id, role: v }), 'Rol actualizado')) setEdit({ ...edit, role: v }) }} /></Field>
              <div className="swrow" style={{ marginBottom: 14 }}><div><b>Activo</b><small>Desactivado no puede entrar ni cobrar.</small></div>
                <Sw on={edit.active} label="Activo" onChange={async (v) => { if (await run(updateEmployeeAction({ id: edit.id, active: v }), v ? 'Activado' : 'Desactivado')) setEdit({ ...edit, active: v }) }} /></div>
            </>
          )}
          <Field label="Nuevo PIN (4 dígitos)"><input className="inp" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} /></Field>
          <button className="btn" disabled={busy || pin.length !== 4} onClick={async () => { if (await run(updateEmployeeAction({ id: edit.id, pin }), 'PIN actualizado')) setEdit(null) }}>Guardar PIN</button>
        </Sheet>
      ) : null}
    </>
  )
}
