// Prueba rápida de RLS y RPC con un usuario de cada rol (requiere la BD arriba). Todo corre en transacciones que se revierten.
import postgres from 'postgres'
const sql = postgres('postgres://postgres:postgres@127.0.0.1:54329/app', { onnotice: () => {} })
let fail = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`); if (!cond) fail++ }
const ROLLBACK = Symbol('rb')
async function as(uid, fn) {
  let out
  try {
    await sql.begin(async (tx) => {
      // cada prueba arranca sin cajas abiertas (se revierte al final)
      await tx`update public.cash_sessions set closed_at = now() where closed_at is null`
      await tx`select set_config('request.jwt.claim.sub', ${uid ?? ''}, true)`
      await tx.unsafe(uid ? 'set local role authenticated' : 'set local role anon')
      out = await fn(tx)
      throw ROLLBACK
    })
  } catch (e) { if (e !== ROLLBACK) return { error: e.message } }
  return { data: out }
}
const uid = async (email) => (await sql`select id from auth.users where email = ${email}`)[0].id
const [b] = await sql`select id from businesses where slug = 'cafelaluna'`
const [other] = await sql`select id from businesses where slug = 'nomadastore'`
const owner = await uid('dueno@cafelaluna.mx'), admin = await uid('admin@cafelaluna.mx'), cashier = await uid('cajero@cafelaluna.mx'), sup = await uid('super@tuapp.com')
const [cap] = await sql`select id from products where business_id = ${b.id} and name = 'Capuchino'`
const [ame] = await sql`select id from products where business_id = ${b.id} and name = 'Americano'`
const [dona] = await sql`select id, stock from products where business_id = ${b.id} and name = 'Dona glaseada'`
const [pastel] = await sql`select id from products where business_id = ${b.id} and name = 'Pastel de chocolate'`

let r = await as(null, (tx) => tx`select * from products`)
ok('anon no puede leer tablas', !!r.error)
r = await as(null, async (tx) => (await tx`select public.public_catalog('cafelaluna') as c`)[0].c)
ok('catálogo público oculta "Cargo por envío"', r.data && !r.data.products.some((p) => p.name === 'Cargo por envío') && r.data.products.length === 7, `${r.data?.products.length} productos`)
r = await as(owner, (tx) => tx`select id from products where business_id = ${other.id}`)
ok('un negocio no ve productos de otro', r.data?.length === 0)
r = await as(cashier, (tx) => tx`update products set price = 1 where id = ${cap.id} returning id`)
ok('cajero NO puede editar productos', r.error || r.data.length === 0)
r = await as(cashier, (tx) => tx`select id from quotes where business_id = ${b.id}`)
ok('cajero NO ve cotizaciones', r.data?.length === 0)
r = await as(admin, (tx) => tx`update products set price = 70 where id = ${cap.id} returning id`)
ok('admin SÍ edita productos', r.data?.length === 1)
r = await as(admin, (tx) => tx`delete from products where id = ${cap.id} returning id`)
ok('admin NO puede DELETE', r.error || r.data.length === 0)
r = await as(admin, (tx) => tx`update products set deleted_at = now() where id = ${cap.id}`)
ok('admin NO puede mandar a papelera', !!r.error, r.error)
r = await as(owner, (tx) => tx`delete from products where id = ${dona.id} returning id`)
ok('dueño SÍ puede DELETE', r.data?.length === 1)
r = await as(owner, (tx) => tx`update businesses set plan = 'pro', slug = 'hack' where id = ${b.id}`)
ok('dueño NO cambia slug/plan', !!r.error, r.error)
r = await as(owner, (tx) => tx`select public.create_business('X', 'equis', 'x@x.mx', '', 'food', 'basico')`)
ok('solo super admin da de alta negocios', !!r.error)
r = await as(sup, async (tx) => { const [{ id }] = await tx`select public.create_business('Tacos El Güero', 'tacoselguero', 'g@x.mx', '5511112222', 'food', 'prueba') as id`; return (await tx`select (select count(*)::int from qr_codes where business_id = ${id}) q, (select count(*)::int from categories where business_id = ${id}) c, (select count(*)::int from ticket_settings where business_id = ${id}) t`)[0] })
ok('alta de negocio crea QR, categorías y ticket', r.data?.q === 1 && r.data?.c === 4 && r.data?.t === 1, JSON.stringify(r.data ?? r.error))
r = await as(sup, (tx) => tx`select public.create_business('App', 'app', 'g@x.mx', '', 'food', 'basico')`)
ok('slug reservado rechazado', !!r.error, r.error)

// POS: venta de la maqueta (2 capuchinos + 1 americano = $155; 133.62 + 21.38; paga 200, cambio 45)
const items = JSON.stringify([{ product_id: cap.id, qty: 2 }, { product_id: ame.id, qty: 1 }])
r = await as(cashier, (tx) => tx`select public.register_pos_sale(${b.id}, ${items}::text::jsonb, '[{"method":"cash","amount":155}]'::jsonb, 200) as r`)
ok('sin caja abierta no se cobra', !!r.error, r.error)
r = await as(cashier, async (tx) => {
  await tx`select public.open_cash_session(${b.id}, 500, 'Caja 1')`
  const [{ r: sale }] = await tx`select public.register_pos_sale(${b.id}, ${items}::text::jsonb, '[{"method":"cash","amount":155}]'::jsonb, 200) as r`
  const [s] = await tx`select status, paid_total, balance from sales where id = ${sale.sale_id}`
  return { sale, s }
})
ok('venta POS: total 155, IVA 21.38, cambio 45, pagada', r.data && Number(r.data.sale.total) === 155 && Number(r.data.sale.tax) === 21.38 && Number(r.data.sale.subtotal) === 133.62 && Number(r.data.sale.change) === 45 && r.data.s.status === 'paid', JSON.stringify(r.data?.sale ?? r.error))
r = await as(cashier, async (tx) => { await tx`select public.open_cash_session(${b.id}, 0, 'Caja 1')`; return tx`select public.register_pos_sale(${b.id}, ${JSON.stringify([{ product_id: cap.id, qty: 1 }])}::text::jsonb, '[{"method":"cash","amount":1}]'::jsonb, 1)` })
ok('pagos que no cuadran se rechazan', !!r.error, r.error)
r = await as(cashier, async (tx) => { await tx`select public.open_cash_session(${b.id}, 0, 'Caja 1')`; return tx`select public.register_pos_sale(${b.id}, ${JSON.stringify([{ product_id: pastel.id, qty: 1 }])}::text::jsonb, '[{"method":"cash","amount":85}]'::jsonb, 85)` })
ok('producto agotado no se vende', !!r.error, r.error)
r = await as(owner, async (tx) => {
  await tx`select public.open_cash_session(${b.id}, 500, 'Caja 1')`
  await tx`select public.register_pos_sale(${b.id}, ${JSON.stringify([{ product_id: dona.id, qty: 3 }])}::text::jsonb, '[{"method":"card","amount":87}]'::jsonb, null)`
  const [after] = await tx`select stock from products where id = ${dona.id}`
  const [sale] = await tx`select id from sales where business_id = ${b.id} order by created_at desc limit 1`
  await tx`select public.cancel_sale(${sale.id})`
  const [back] = await tx`select stock from products where id = ${dona.id}`
  const [ses] = await tx`select id from cash_sessions where business_id = ${b.id} and closed_at is null`
  await tx`select public.add_cash_movement(${ses.id}, 'out', 100, 'Proveedor')`
  const [{ r: close }] = await tx`select public.close_cash_session(${ses.id}, 390, '') as r`
  return { after: Number(after.stock), back: Number(back.stock), close }
})
ok('stock baja al vender y regresa al cancelar', r.data?.after === Number(dona.stock) - 3 && r.data?.back === Number(dona.stock), JSON.stringify(r.data ?? r.error))
ok('corte: esperado = fondo − retiros (500 − 100), faltante 10', r.data && Number(r.data.close.expected) === 400 && Number(r.data.close.difference) === -10)
r = await as(cashier, async (tx) => { const [s] = await tx`select public.open_cash_session(${b.id}, 0, 'Caja 1') as id`; return tx`select public.close_cash_session(${s.id}, 0, '')` })
ok('cajero NO cierra el corte', !!r.error, r.error)

// Cotización → venta con abonos
r = await as(admin, async (tx) => {
  const [{ id }] = await tx`select public.save_quote(${b.id}, null, ${JSON.stringify({ client_name: 'Prueba', prices_plus_tax: true, valid_days: 15, items: [{ title: 'Concepto libre', unit_price: 1000, qty: 1 }] })}::text::jsonb) as id`
  const [q] = await tx`select subtotal, tax, total, expires_at - issued_at as days from quotes where id = ${id}`
  const [{ r: conv }] = await tx`select public.convert_quote_to_sale(${id}, '{"amount":580,"method":"transfer"}'::jsonb) as r`
  const [s1] = await tx`select status, balance from sales where id = ${conv.sale_id}`
  let over = null
  try { await tx.savepoint((sp) => sp`select public.add_payment(${conv.sale_id}, 9999, 'cash', '')`) } catch (e) { over = e.message }
  await tx`select public.add_payment(${conv.sale_id}, 580, 'cash', 'Liquidación')`
  const [s2] = await tx`select status, balance from sales where id = ${conv.sale_id}`
  const [q2] = await tx`select status from quotes where id = ${id}`
  return { q, s1, s2, over, q2 }
})
ok('cotización + IVA: 1000 + 160 = 1160, vigencia 15 días', r.data && Number(r.data.q.total) === 1160 && Number(r.data.q.tax) === 160 && r.data.q.days === 15, JSON.stringify(r.data?.q ?? r.error))
ok('anticipo 50% → parcial; no deja pagar de más; liquidar → pagada', r.data?.s1.status === 'partial' && !!r.data?.over && r.data?.s2.status === 'paid' && Number(r.data.s2.balance) === 0 && r.data.q2.status === 'converted', r.data?.over)

// Variantes con stock propio
const [tenis] = await sql`select p.id, p.business_id from products p where p.name = 'Tenis Trail Runner'`
const opts = await sql`select o.id, o.label, o.stock from product_options o join product_option_groups g on g.id = o.group_id where g.product_id = ${tenis.id}`
const nOwner = await uid('dueno@nomadastore.mx')
const t27 = opts.find((o) => o.label === '27'), t26 = opts.find((o) => o.label === '26')
r = await as(nOwner, async (tx) => { await tx`select public.open_cash_session(${tenis.business_id}, 0, 'Caja 1')`; return tx`select public.register_pos_sale(${tenis.business_id}, ${JSON.stringify([{ product_id: tenis.id, option_ids: [t27.id], qty: 1 }])}::text::jsonb, '[{"method":"card","amount":1499}]'::jsonb, null)` })
ok('talla 27 agotada no se vende', !!r.error, r.error)
r = await as(nOwner, async (tx) => { await tx`select public.open_cash_session(${tenis.business_id}, 0, 'Caja 1')`; await tx`select public.register_pos_sale(${tenis.business_id}, ${JSON.stringify([{ product_id: tenis.id, option_ids: [t26.id], qty: 1 }])}::text::jsonb, '[{"method":"card","amount":1499}]'::jsonb, null)`; return (await tx`select stock from product_options where id = ${t26.id}`)[0].stock })
ok('talla 26 descuenta su propio stock (3 → 2)', Number(r.data) === 2, String(r.data ?? r.error))
const [para] = await sql`select id from products where name = 'Paracord 550'`
r = await as(nOwner, async (tx) => { await tx`select public.open_cash_session(${tenis.business_id}, 0, 'Caja 1')`; return (await tx`select public.register_pos_sale(${tenis.business_id}, ${JSON.stringify([{ product_id: para.id, qty: 1.5 }])}::text::jsonb, '[{"method":"cash","amount":27}]'::jsonb, 50) as r`)[0].r })
ok('1.5 m × $18 = $27', Number(r.data?.total) === 27, JSON.stringify(r.data ?? r.error))

// Agenda
const [bb] = await sql`select id from businesses where slug = 'barberiadonbeto'`
const [svc] = await sql`select id from products where business_id = ${bb.id} and name = 'Corte clásico'`
const beto = await uid('beto@barberiadonbeto.mx'), luis = await uid('luis@barberiadonbeto.mx')
const [mBeto] = await sql`select id from memberships where user_id = ${beto}`
const day = (await sql`select ((now() at time zone 'America/Mexico_City')::date + (case when extract(dow from (now() at time zone 'America/Mexico_City')::date + 2) = 0 then 3 else 2 end))::text as d`)[0].d
r = await as(null, async (tx) => {
  const slots = await tx`select starts_at from public.available_slots(${bb.id}, ${svc.id}, ${mBeto.id}, ${day}::date)`
  const at = slots[0].starts_at
  const [{ t }] = await tx`select public.request_appointment('barberiadonbeto', ${svc.id}, ${mBeto.id}, ${at}, 'Cliente Uno', '3310000001') as t`
  let dup = null
  try { await tx.savepoint((sp) => sp`select public.request_appointment('barberiadonbeto', ${svc.id}, ${mBeto.id}, ${at}, 'Cliente Dos', '3310000002')`) } catch (e) { dup = e.message }
  const after = await tx`select starts_at from public.available_slots(${bb.id}, ${svc.id}, ${mBeto.id}, ${day}::date)`
  const [a] = await tx`select public.public_appointment(${t}) as a`
  return { n: slots.length, dup, gone: !after.some((s) => +s.starts_at === +at), status: a.a.status }
})
ok('reserva pública: queda en espera y aparta el horario', r.data?.status === 'pending' && r.data?.gone, JSON.stringify(r.data ?? r.error))
ok('dos clientes no apartan el mismo horario', !!r.data?.dup, r.data?.dup)
const pend = await sql`select a.id, m.user_id from appointments a join memberships m on m.id = a.membership_id where a.business_id = ${bb.id} and a.status = 'pending' order by a.starts_at`
r = await as(luis, (tx) => tx`select id from appointments where business_id = ${bb.id}`)
const luisCount = (await sql`select count(*)::int n from appointments a join memberships m on m.id = a.membership_id where m.user_id = ${luis}`)[0].n
ok('empleado solo ve sus citas', r.data?.length === luisCount, `${r.data?.length} de ${luisCount}`)
const betoAppt = pend.find((p) => p.user_id === beto), luisAppt = pend.find((p) => p.user_id === luis)
r = await as(luis, (tx) => tx`select public.decide_appointment(${betoAppt.id}, 'accept')`)
ok('empleado NO aprueba citas de otro', !!r.error, r.error)
r = await as(luis, async (tx) => { await tx`select public.decide_appointment(${luisAppt.id}, 'accept')`; return (await tx`select status from appointments where id = ${luisAppt.id}`)[0].status })
ok('empleado SÍ aprueba su cita', r.data === 'confirmed', String(r.data ?? r.error))
r = await sql.begin(async (tx) => { await tx`update appointments set hold_expires_at = now() - interval '1 minute' where id = ${betoAppt.id}`; await tx`select public.run_maintenance()`; const [a] = await tx`select status from appointments where id = ${betoAppt.id}`; await tx`update appointments set status = 'pending', hold_expires_at = now() + interval '3 days' where id = ${betoAppt.id}`; await tx`delete from appointment_events where appointment_id = ${betoAppt.id} and type = 'venció sin respuesta'`; return a.status })
ok('al vencer el tiempo de aprobación pasa a "expired"', r === 'expired')

// QR
const [qr] = await sql`select id, code from qr_codes where business_id = ${b.id} and active`
r = await as(owner, (tx) => tx`select public.regenerate_qr(${qr.id})`)
ok('dueño NO regenera el QR', !!r.error)
r = await as(owner, (tx) => tx`update qr_codes set code = 'AAAAAAA' where id = ${qr.id} returning id`)
ok('dueño NO cambia el código (inmutable)', r.error || r.data.length === 0)
r = await as(owner, async (tx) => { await tx`select public.set_qr_destination(${qr.id}, 'custom', 'https://ejemplo.mx')`; return (await tx`select destination_type from qr_codes where id = ${qr.id}`)[0].destination_type })
ok('dueño SÍ cambia el destino', r.data === 'custom')
r = await as(owner, (tx) => tx`select public.set_qr_destination(${qr.id}, 'custom', 'http://inseguro.mx')`)
ok('destino debe ser https://', !!r.error)
r = await as(sup, async (tx) => { await tx`select public.regenerate_qr(${qr.id})`; const [o] = await tx`select active, replaced_by from qr_codes where id = ${qr.id}`; return o })
ok('super admin regenera: el anterior queda inactivo', r.data?.active === false && !!r.data?.replaced_by)
r = await as(owner, (tx) => tx`select pin_hash from memberships`)
ok('pin_hash no es legible', !!r.error)

// Eliminación de cuenta (requisito de App Store y Google Play)
async function delAccount(uid, confirm, check) {
  let out
  try {
    await sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub', ${uid}, true)`
      await tx.unsafe('set local role authenticated')
      await tx`select public.delete_my_account(${confirm})`
      await tx.unsafe('reset role')
      out = await check(tx)
      throw ROLLBACK
    })
  } catch (e) { if (e !== ROLLBACK) return { error: e.message } }
  return { data: out }
}
const state = (tx, u) => tx`select (select count(*)::int from auth.users where id = ${u}) as usr, (select count(*)::int from public.businesses where id = ${b.id}) as biz,
  (select count(*)::int from public.products where business_id = ${b.id}) as prods, (select count(*)::int from public.memberships where user_id = ${u}) as mems`.then((x) => x[0])
r = await delAccount(cashier, 'no', (tx) => state(tx, cashier))
ok('eliminar cuenta exige escribir ELIMINAR', !!r.error, r.error)
r = await delAccount(cashier, 'eliminar', (tx) => state(tx, cashier))
ok('empleado elimina su cuenta; el negocio sigue', r.data?.usr === 0 && r.data?.mems === 0 && r.data?.biz === 1, JSON.stringify(r.data ?? r.error))
r = await delAccount(owner, 'ELIMINAR', (tx) => state(tx, owner))
ok('único dueño elimina su cuenta y todo su negocio', r.data?.usr === 0 && r.data?.biz === 0 && r.data?.prods === 0, JSON.stringify(r.data ?? r.error))
r = await delAccount(sup, 'ELIMINAR', (tx) => state(tx, sup))
ok('el super admin no se elimina desde la app', !!r.error, r.error)

// Paneles maestros: sin plan, vencimiento ni suspensión
r = await as(sup, async (tx) => {
  const [{ id }] = await tx`select public.create_master_business('retail') as id`
  await tx`update public.businesses set status = 'suspendido', plan_expires_at = current_date - 1 where id = ${id}`
  return (await tx`select status, plan_expires_at from public.businesses where id = ${id}`)[0]
})
ok('panel maestro no vence ni se suspende', r.data?.status === 'activo' && r.data?.plan_expires_at === null, JSON.stringify(r.data ?? r.error))

// Notificaciones y avisos
r = await as(owner, (tx) => tx`insert into public.announcements (title, body) values ('x', 'y')`)
ok('solo el super admin envía avisos', !!r.error)
r = await sql.begin(async (tx) => {
  const [a] = await tx`insert into public.announcements (title, body, audience_modes) values ('Solo servicios QA', 'm', array['service']) returning id`
  const seen = async (u, biz) => { await tx`select set_config('request.jwt.claim.sub', ${u}, true)`; await tx.unsafe('set local role authenticated')
    const [x] = await tx`select public.my_notifications(${biz}) as l`; await tx.unsafe('reset role'); return x.l.some((i) => i.id === a.id) }
  const out = { service: await seen(beto, bb.id), food: await seen(owner, b.id) }
  await tx`delete from public.announcements where id = ${a.id}`
  return out
})
ok('aviso por tipo de negocio: lo ve Servicios y no Comida', r.service === true && r.food === false, JSON.stringify(r))
r = await as(null, async (tx) => {
  const slots = await tx`select starts_at from public.available_slots(${bb.id}, ${svc.id}, ${mBeto.id}, ${day}::date)`
  await tx`select public.request_appointment('barberiadonbeto', ${svc.id}, ${mBeto.id}, ${slots[1].starts_at}, 'Cliente Notif', '3310000009')`
  await tx.unsafe('reset role')
  const count = async (u) => { await tx`select set_config('request.jwt.claim.sub', ${u}, true)`; await tx.unsafe('set local role authenticated')
    const [x] = await tx`select public.my_notifications(${bb.id}) as l`; await tx.unsafe('reset role'); return x.l.filter((i) => i.type === 'cita' && (i.body ?? '').includes('Cliente Notif')).length }
  const o = await count(beto), l = await count(luis)
  await tx`select set_config('request.jwt.claim.sub', ${beto}, true)`; await tx.unsafe('set local role authenticated')
  const [{ n: before }] = await tx`select public.unread_notifications(${bb.id}) as n`
  await tx`select public.mark_notifications_read(${bb.id})`
  const [{ n: after }] = await tx`select public.unread_notifications(${bb.id}) as n`
  return { o, l, before, after }
})
ok('solicitud de cita avisa al dueño y no al empleado que no la atiende', r.data?.o === 1 && r.data?.l === 0, JSON.stringify(r.data ?? r.error))
ok('marcar como leídas deja el contador en cero', r.data?.before > 0 && r.data?.after === 0, JSON.stringify(r.data ?? r.error))
r = await as(owner, async (tx) => {
  await tx`select public.open_cash_session(${b.id}, 0, 'Caja 1')`
  await tx`select public.register_pos_sale(${b.id}, ${JSON.stringify([{ product_id: dona.id, qty: Number(dona.stock) }])}::text::jsonb, ${JSON.stringify([{ method: 'card', amount: Number(dona.stock) * 29 }])}::text::jsonb, null)`
  const [x] = await tx`select public.my_notifications(${b.id}) as l`
  return x.l.filter((i) => i.type === 'stock' && i.title.includes('Dona')).length
})
ok('al agotarse un producto se avisa al negocio', r.data === 1, String(r.data ?? r.error))

// Solicitudes de pedido desde la página pública
r = await as(null, async (tx) => {
  const items = JSON.stringify([{ product_id: cap.id, qty: 2, options: ['Grande', 'Shot extra'], notes: '', unit_price: 1 }])
  const [{ t }] = await tx`select public.request_order('cafelaluna', ${items}::text::jsonb, 'Cliente QA', 'mostrador', null) as t`
  const [{ o }] = await tx`select public.public_order(${t}) as o`
  return o
})
ok('solicitud pública queda pendiente y el precio lo calcula el servidor (55+18+12)×2', r.data?.status === 'pending' && Number(r.data?.total) === 170, JSON.stringify(r.data ?? r.error).slice(0, 160))
r = await sql.begin(async (tx) => {
  await tx`update public.businesses set order_types = array['mostrador'] where id = ${b.id}`
  await tx`select set_config('request.jwt.claim.sub', '', true)`; await tx.unsafe('set local role anon')
  let err = null
  try { await tx.savepoint((sp) => sp`select public.request_order('cafelaluna', ${JSON.stringify([{ product_id: cap.id, qty: 1, options: [], notes: '' }])}::text::jsonb, 'Cliente QA', 'domicilio', 'Calle 1 #2')`) } catch (e) { err = e.message }
  await tx.unsafe('reset role'); throw Object.assign(new Error('rb'), { err })
}).catch((e) => e.err ?? e.message)
ok('un tipo de entrega apagado se rechaza', /no disponible/.test(r), r)
r = await as(null, (tx) => tx`select id from public.order_requests`)
ok('el público no puede listar solicitudes', !!r.error)
r = await as(cashier, async (tx) => {
  const [{ t }] = await (async () => { await tx.unsafe('reset role'); await tx.unsafe('set local role anon'); return tx`select public.request_order('cafelaluna', ${JSON.stringify([{ product_id: ame.id, qty: 1, options: [], notes: '' }])}::text::jsonb, 'Cliente QA2', 'mostrador', null) as t` })()
  await tx.unsafe('reset role'); await tx`select set_config('request.jwt.claim.sub', ${cashier}, true)`; await tx.unsafe('set local role authenticated')
  const [o] = await tx`select id from public.order_requests where public_token = ${t}`
  await tx`select public.decide_order(${o.id}, 'confirmed')`
  await tx.unsafe('reset role')  // el aviso es para dueño y administradores; se cuenta sin RLS
  const [n] = await tx`select count(*)::int c from public.notifications where business_id = ${b.id} and type = 'pedido'`
  return { status: (await tx`select status from public.order_requests where id = ${o.id}`)[0].status, notified: n.c }
})
ok('el equipo del negocio confirma la solicitud y se avisa en notificaciones', r.data?.status === 'confirmed' && r.data?.notified >= 1, JSON.stringify(r.data ?? r.error))

// Punto de venta: precio especial y pedidos a futuro con anticipo
r = await as(owner, async (tx) => {
  await tx`select public.open_cash_session(${b.id}, 0, 'Caja 1')`
  const [{ r: v }] = await tx`select public.register_pos_sale(${b.id}, ${JSON.stringify([{ product_id: ame.id, qty: 2, unit_override: '40' }])}::text::jsonb,
    ${JSON.stringify([{ method: 'cash', amount: 50 }, { method: 'card', amount: 30 }])}::text::jsonb, 50, null, 'mostrador', null, null, null) as r`
  const [it] = await tx`select unit_price, list_price from public.sale_items where sale_id = ${v.sale_id}`
  return { total: Number(v.total), unit: Number(it.unit_price), list: Number(it.list_price) }
})
ok('precio especial: cobra $40 c/u, guarda precio de lista $45 y acepta pago mixto', r.data?.total === 80 && r.data?.unit === 40 && r.data?.list === 45, JSON.stringify(r.data ?? r.error))
r = await as(cashier, async (tx) => {
  await tx`select public.open_cash_session(${b.id}, 0, 'Caja 1')`
  const extra = JSON.stringify({ preorder: true, delivery_at: new Date(Date.now() + 2 * 86400000).toISOString(), phone: '7220000000', notes: 'QA', custom_fields: [{ label: 'Lugar', value: 'Salón' }] })
  const [{ r: v }] = await tx`select public.register_pos_sale(${b.id}, ${JSON.stringify([{ product_id: ame.id, qty: 4 }])}::text::jsonb,
    ${JSON.stringify([{ method: 'transfer', amount: 90 }])}::text::jsonb, null, 'Cliente Pedido', 'mostrador', null, null, ${extra}::text::jsonb) as r`
  const [s2] = await tx`select source, status, balance, delivery_at is not null as d, custom_fields from public.sales where id = ${v.sale_id}`
  let err = null
  try { await tx.savepoint((sp) => sp`select public.register_pos_sale(${b.id}, ${JSON.stringify([{ product_id: ame.id, qty: 1 }])}::text::jsonb, ${JSON.stringify([{ method: 'cash', amount: 100 }])}::text::jsonb, 100, 'Cliente X', 'mostrador', null, null, ${extra}::text::jsonb)`) } catch (e) { err = e.message }
  let cashEdit = null
  try { await tx.savepoint((sp) => sp`select public.update_preorder(${v.sale_id}, ${JSON.stringify({ customer_name: 'Otro', delivery_at: new Date().toISOString() })}::text::jsonb)`) } catch (e) { cashEdit = e.message }
  return { ...s2, err, cashEdit }
})
ok('pedido a futuro: anticipo $90 de $180, queda con saldo y fecha de entrega', r.data?.source === 'encargo' && r.data?.status === 'partial' && Number(r.data?.balance) === 90 && r.data?.d, JSON.stringify(r.data ?? r.error).slice(0, 160))
ok('el anticipo no puede ser mayor al total', /anticipo/.test(r.data?.err ?? ''), r.data?.err)
ok('el cajero no puede editar un pedido ya registrado', /permiso/i.test(r.data?.cashEdit ?? ''), r.data?.cashEdit)
r = await as(owner, async (tx) => {
  await tx`select public.open_cash_session(${b.id}, 0, 'Caja 1')`
  const extra = JSON.stringify({ preorder: true, delivery_at: new Date(Date.now() + 86400000).toISOString(), phone: '7220000000', notes: 'QA', custom_fields: [] })
  const [{ r: v }] = await tx`select public.register_pos_sale(${b.id}, ${JSON.stringify([{ product_id: ame.id, qty: 1 }])}::text::jsonb, '[]'::jsonb, null, 'Cliente Pedido', 'mostrador', null, null, ${extra}::text::jsonb) as r`
  const when = new Date(Date.now() + 5 * 86400000).toISOString()
  await tx`select public.update_preorder(${v.sale_id}, ${JSON.stringify({ customer_name: 'Cliente Editado', phone: '5512345678', delivery_at: when, order_type: 'para_llevar', notes: 'Nuevo texto', custom_fields: [{ label: 'Color', value: 'Azul' }] })}::text::jsonb)`
  const [s3] = await tx`select customer_name, customer_phone, order_type, notes, custom_fields, delivery_at = ${when}::timestamptz as d from public.sales where id = ${v.sale_id}`
  const errs = []
  for (const bad of [{ customer_name: 'Cliente', phone: '55123', delivery_at: when }, { customer_name: 'C', delivery_at: when }, { customer_name: 'Cliente' }]) {
    try { await tx.savepoint((sp) => sp`select public.update_preorder(${v.sale_id}, ${JSON.stringify(bad)}::text::jsonb)`); errs.push(null) } catch (e) { errs.push(e.message) }
  }
  const [{ r: n }] = await tx`select public.register_pos_sale(${b.id}, ${JSON.stringify([{ product_id: ame.id, qty: 1 }])}::text::jsonb, ${JSON.stringify([{ method: 'cash', amount: 45 }])}::text::jsonb, 45, null, 'mostrador', null, null, null) as r`
  try { await tx.savepoint((sp) => sp`select public.update_preorder(${n.sale_id}, ${JSON.stringify({ customer_name: 'Cliente', delivery_at: when })}::text::jsonb)`); errs.push(null) } catch (e) { errs.push(e.message) }
  return { ...s3, errs }
})
ok('el dueño edita cliente, teléfono, entrega y características de un pedido', r.data?.customer_name === 'Cliente Editado' && r.data?.customer_phone === '5512345678' && r.data?.order_type === 'para_llevar' && r.data?.d && r.data?.custom_fields?.[0]?.value === 'Azul', JSON.stringify(r.data ?? r.error).slice(0, 200))
ok('editar pedido rechaza teléfono que no es de 10 dígitos, nombre corto y falta de fecha', /10 dígitos/.test(r.data?.errs?.[0] ?? '') && /nombre/.test(r.data?.errs?.[1] ?? '') && /fecha/.test(r.data?.errs?.[2] ?? ''), JSON.stringify(r.data?.errs))
ok('solo los pedidos (no las ventas normales) se editan así', /pedidos/.test(r.data?.errs?.[3] ?? ''), r.data?.errs?.[3])

r = await as(cashier, async (tx) => {
  await tx`select public.open_cash_session(${b.id}, 0, 'Caja 1')`
  const extra = JSON.stringify({ preorder: true, delivery_at: new Date(Date.now() + 86400000).toISOString(), phone: '', notes: '', custom_fields: [] })
  const [{ r: v }] = await tx`select public.register_pos_sale(${b.id}, ${JSON.stringify([{ product_id: ame.id, qty: 4 }])}::text::jsonb, ${JSON.stringify([{ method: 'cash', amount: 100 }])}::text::jsonb, 100, 'Cliente Abonos', 'mostrador', null, null, ${extra}::text::jsonb) as r`
  const [{ r: p1 }] = await tx`select public.add_payment(${v.sale_id}, 50, 'transfer', 'abono 1') as r`
  let over = null
  try { await tx.savepoint((sp) => sp`select public.add_payment(${v.sale_id}, 1000, 'cash', null)`) } catch (e) { over = e.message }
  const [{ r: p2 }] = await tx`select public.add_payment(${v.sale_id}, 30, 'card', 'abono 2') as r`
  const hist = await tx`select amount, is_initial from public.payments where sale_id = ${v.sale_id} order by created_at`
  await tx`select public.set_preorder_delivered(${v.sale_id}, true)`
  const [d] = await tx`select delivered_at is not null as d from public.sales where id = ${v.sale_id}`
  const [{ r: n }] = await tx`select public.register_pos_sale(${b.id}, ${JSON.stringify([{ product_id: ame.id, qty: 2 }])}::text::jsonb, ${JSON.stringify([{ method: 'card', amount: 90 }])}::text::jsonb, null, null, 'mostrador', null, null, null) as r`
  let normal = null
  try { await tx.savepoint((sp) => sp`select public.add_payment(${n.sale_id}, 10, 'cash', null)`) } catch (e) { normal = e.message }
  return { b1: Number(p1.balance), b2: Number(p2.balance), s2: p2.status, n: hist.length, over, delivered: d.d, normal }
})
ok('el cajero cobra abonos de un pedido hasta liquidar (anticipo $100 + $50 + $30 = $180)', r.data?.b1 === 30 && r.data?.b2 === 0 && r.data?.s2 === 'paid' && r.data?.n === 3, JSON.stringify(r.data ?? r.error))
ok('un abono no puede pasar del saldo', /saldo/.test(r.data?.over ?? ''), r.data?.over)
ok('el cajero marca un pedido como entregado', r.data?.delivered === true, JSON.stringify(r.data ?? r.error))
ok('el cajero no registra abonos en ventas que no son pedidos', /permiso/i.test(r.data?.normal ?? ''), r.data?.normal)

await sql.end()
console.log(fail ? `\n${fail} prueba(s) fallaron` : '\nTodo en orden')
process.exit(fail ? 1 : 0)
