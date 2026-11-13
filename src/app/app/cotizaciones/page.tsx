import { getManageCtx } from '@/lib/auth'
import { loadQuotes, QUOTE_FILTERS } from '@/lib/sections'
import { QuotesView } from '@/sections/views'

export default async function Quotes({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f = 'todas' } = await searchParams
  return <QuotesView {...await loadQuotes(await getManageCtx(), f)} filters={QUOTE_FILTERS} />
}
