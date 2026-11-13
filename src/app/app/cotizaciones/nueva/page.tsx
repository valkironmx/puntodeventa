import { getManageCtx } from '@/lib/auth'
import { loadQuoteProducts } from '@/lib/sections'
import { NewQuoteView } from '@/sections/views'

export default async function NewQuote() { return <NewQuoteView {...await loadQuoteProducts(await getManageCtx())} /> }
