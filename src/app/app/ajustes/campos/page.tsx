import { getManageCtx } from '@/lib/auth'
import { loadSettings } from '@/lib/sections'
import { FieldsView } from '@/sections/views'

export default async function CustomFields() { return <FieldsView {...await loadSettings(await getManageCtx())} /> }
