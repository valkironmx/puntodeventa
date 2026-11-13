import { requireSuper } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function SuperLayout({ children }: { children: React.ReactNode }) {
  await requireSuper()
  return <div className="screen wide">{children}</div>
}
