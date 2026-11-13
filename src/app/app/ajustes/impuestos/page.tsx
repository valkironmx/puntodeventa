import { getManageCtx } from '@/lib/auth'
import { loadSettings } from '@/lib/sections'
import { TaxView } from '@/sections/views'

export default async function Tax() { return <TaxView {...await loadSettings(await getManageCtx())} /> }
