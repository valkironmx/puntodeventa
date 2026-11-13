import { notFound } from 'next/navigation'
import { getManageCtx } from '@/lib/auth'
import { loadQuote, loadQuoteProducts } from '@/lib/sections'
import { QuoteEditView, QuoteView } from '@/sections/views'

export default async function QuotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ editar?: string }> }) {
  const { id } = await params
  const { editar } = await searchParams
  const ctx = await getManageCtx()
  const q = await loadQuote(ctx, id)
  if (!q) notFound()
  if (editar && q.editable) return <QuoteEditView {...q} products={(await loadQuoteProducts(ctx)).products} />
  return <QuoteView {...q} />
}
