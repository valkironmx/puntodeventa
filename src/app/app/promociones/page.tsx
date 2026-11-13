import { getManageCtx } from '@/lib/auth'
import { loadPromotions } from '@/lib/sections'
import { PromotionsView } from '@/sections/views'

export default async function PromotionsPage() { return <PromotionsView {...await loadPromotions(await getManageCtx())} /> }
