import { getManageCtx } from '@/lib/auth'
import { loadSettings } from '@/lib/sections'
import { SettingsView } from '@/sections/views'

export default async function Settings() { return <SettingsView {...await loadSettings(await getManageCtx())} /> }
