import { getManageCtx } from '@/lib/auth'
import { loadCatalog } from '@/lib/sections'
import { CatalogView } from '@/sections/views'

export default async function CatalogAdmin() { return <CatalogView {...await loadCatalog(await getManageCtx())} /> }
