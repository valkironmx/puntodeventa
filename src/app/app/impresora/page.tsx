import { getManageCtx } from '@/lib/auth'
import { loadTicket } from '@/lib/sections'
import { PrinterView } from '@/sections/views'

export default async function PrinterPage() { return <PrinterView {...await loadTicket(await getManageCtx())} /> }
