import { getManageCtx } from '@/lib/auth'
import { loadCategories } from '@/lib/sections'
import { CategoriesView } from '@/sections/views'

export default async function Categories() { return <CategoriesView {...await loadCategories(await getManageCtx())} /> }
