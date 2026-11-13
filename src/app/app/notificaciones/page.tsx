import { getCtx } from '@/lib/auth'
import { loadNotifications } from '@/lib/sections'
import { NotificationsView } from '@/sections/views'

export const metadata = { title: 'Notificaciones' }
export default async function NotificationsPage() { return <NotificationsView {...await loadNotifications(await getCtx())} /> }
