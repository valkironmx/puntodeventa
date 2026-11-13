import { getManageCtx } from '@/lib/auth'
import { loadCashCut } from '@/lib/sections'
import { CashCutView } from '@/sections/views'

export default async function CashCutPage() { return <CashCutView {...await loadCashCut(await getManageCtx())} /> }
