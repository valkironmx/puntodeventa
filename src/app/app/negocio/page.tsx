import { getManageCtx } from '@/lib/auth'
import { BusinessHubView } from '@/sections/views'

export const metadata = { title: 'Mi negocio' }
export default async function BusinessHub() { await getManageCtx(); return <BusinessHubView /> }
