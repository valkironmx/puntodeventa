// Validaciones compartidas entre el panel web y la sincronización de la app del teléfono.
import { z } from 'zod'

export const amount = z.string().regex(/^\d{1,9}(\.\d{1,2})?$/, 'Monto inválido')
export const uuid = z.string().uuid()

export const saleSchema = z.object({
  items: z.array(z.object({
    product_id: uuid.nullable(), option_ids: z.array(uuid).max(10).default([]),
    title: z.string().max(120).optional(), unit_price: amount.optional(),
    qty: z.string().regex(/^\d{1,6}(\.\d{1,3})?$/, 'Cantidad inválida'), notes: z.string().max(200).optional(),
    unit_override: amount.optional(),
  })).min(1, 'Agrega productos a la venta').max(200),
  payments: z.array(z.object({ method: z.enum(['cash', 'card', 'transfer']), amount })).max(3),
  cash_received: amount.nullable(),
  customer_name: z.string().max(80).nullable(),
  order_type: z.enum(['mostrador', 'comer_aqui', 'para_llevar', 'domicilio', 'envio', 'en_local']),
  table_label: z.string().max(40).nullable(),
  appointment_id: uuid.nullable(),
  extra: z.object({
    preorder: z.literal(true),
    delivery_at: z.string().datetime({ offset: true, message: 'Indica la fecha y hora de entrega' }),
    phone: z.string().trim().regex(/^(\d{10})?$/, 'El teléfono debe tener 10 dígitos'),
    notes: z.string().trim().max(600),
    custom_fields: z.array(z.object({ label: z.string().trim().min(1).max(40), value: z.string().trim().max(160) })).max(12),
  }).nullable().optional(),
})
export type SaleInput = z.input<typeof saleSchema>
export interface SaleResult { sale_id: string; folio: number; subtotal: string; tax: string; total: string; change: string }

export const preorderEdit = z.object({
  customer_name: z.string().trim().min(2, 'Escribe el nombre del cliente').max(80),
  phone: z.string().trim().regex(/^(\d{10})?$/, 'El teléfono debe tener 10 dígitos'),
  delivery_at: z.string().datetime({ message: 'Indica la fecha de entrega' }),
  order_type: z.enum(['mostrador', 'comer_aqui', 'para_llevar', 'domicilio', 'envio', 'en_local']).nullable(),
  notes: z.string().max(600),
  custom_fields: z.array(z.object({ label: z.string().trim().min(1).max(40), value: z.string().trim().max(200) })).max(20),
})

export const quoteSchema = z.object({
  id: uuid.optional(),
  client_name: z.string().trim().max(120), client_phone: z.string().trim().regex(/^(\d{10})?$/, 'El teléfono debe tener 10 dígitos'), client_email: z.string().trim().max(120),
  status: z.enum(['draft', 'pending', 'accepted', 'rejected', 'cancelled']),
  valid_days: z.number().int().min(1).max(365), prices_plus_tax: z.boolean(),
  custom_fields: z.array(z.object({ label: z.string().trim().min(1).max(40), value: z.string().trim().max(160) })).max(12),
  notes: z.string().max(1000),
  items: z.array(z.object({
    product_id: uuid.nullable(), title: z.string().trim().min(1, 'Cada partida necesita un título').max(160), description: z.string().max(400).optional(),
    unit_price: amount, qty: z.string().regex(/^\d{1,6}(\.\d{1,3})?$/, 'Cantidad inválida'), sale_unit: z.string().max(10).optional(),
  })).min(1, 'Agrega al menos una partida').max(100),
})
export type QuoteInput = z.input<typeof quoteSchema>
