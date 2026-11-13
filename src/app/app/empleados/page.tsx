import { getManageCtx } from '@/lib/auth'
import { loadStaff } from '@/lib/sections'
import { StaffView } from '@/sections/views'

export default async function StaffPage() { return <StaffView {...await loadStaff(await getManageCtx())} /> }
