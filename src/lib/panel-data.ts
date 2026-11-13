import 'server-only'
import type { Ctx } from './auth'
import type { TicketSettings } from '@/components/ticket/ticket'
import { appDomain, appUrl, storageUrl } from './format'

/** Datos comunes para imprimir tickets: diseño + QR dinámico del negocio */
export async function ticketData(ctx: Ctx) {
  const b = ctx.business
  const [settings] = await ctx.db((tx) => tx`select * from public.ticket_settings where business_id = ${b.id}`)
  const [qr] = await ctx.db((tx) => tx`select code from public.qr_codes where business_id = ${b.id} and active and deleted_at is null order by created_at desc limit 1`)
  return {
    settings: { ...settings, paper_width: Number(settings.paper_width) } as unknown as TicketSettings & { auto_print: boolean; open_cash_drawer: boolean },
    business: { name: b.name as string, logo: storageUrl(b.logo_path) },
    qrUrl: qr ? `${appUrl()}/q/${qr.code}` : `${appUrl()}/${b.slug}`,
    qrLabel: qr ? `${appDomain()}/q/${qr.code}` : `${appDomain()}/${b.slug}`,
    taxRate: Number(b.tax_rate),
  }
}
