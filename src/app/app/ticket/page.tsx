import { getManageCtx } from '@/lib/auth'
import { loadTicket } from '@/lib/sections'
import { TicketView } from '@/sections/views'

export default async function TicketPage() { return <TicketView {...await loadTicket(await getManageCtx())} /> }
