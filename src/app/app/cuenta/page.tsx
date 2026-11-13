import { getCtx } from '@/lib/auth'
import { loadAccount } from '@/lib/sections'
import { AccountView } from '@/sections/views'

export const metadata = { title: 'Mi cuenta' }
export default async function AccountPage() { return <AccountView {...await loadAccount(await getCtx())} /> }
