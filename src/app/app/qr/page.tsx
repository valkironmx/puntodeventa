import { getManageCtx } from '@/lib/auth'
import { loadQr } from '@/lib/sections'
import { QrView } from '@/sections/views'

export default async function QrPage() { return <QrView {...await loadQr(await getManageCtx())} /> }
