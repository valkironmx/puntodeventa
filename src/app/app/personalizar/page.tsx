import { getManageCtx } from '@/lib/auth'
import { loadCustomize } from '@/lib/sections'
import { CustomizeView } from '@/sections/views'

export default async function Customize() { return <CustomizeView {...await loadCustomize(await getManageCtx())} /> }
