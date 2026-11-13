import { notFound } from 'next/navigation'
import { getManageCtx } from '@/lib/auth'
import { loadSale } from '@/lib/sections'
import { SaleView } from '@/sections/views'

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const p = await loadSale(await getManageCtx(), id)
  if (!p) notFound()
  return <SaleView {...p} />
}
