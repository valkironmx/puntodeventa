import { notFound } from 'next/navigation'
import { getManageCtx } from '@/lib/auth'
import { loadProduct } from '@/lib/sections'
import { ProductView } from '@/sections/views'

export default async function ProductEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const p = await loadProduct(await getManageCtx(), id)
  if (!p) notFound()
  return <ProductView {...p} />
}
