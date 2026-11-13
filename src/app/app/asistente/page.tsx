import { redirect } from 'next/navigation'
import { Wizard } from '@/components/panel/wizard'
import { getManageCtx } from '@/lib/auth'
import { DEFAULT_SCHEDULE } from '@/lib/hours'

export default async function WizardPage() {
  const ctx = await getManageCtx()
  const b = ctx.business
  if (b.onboarded) redirect('/app')
  return (
    <Wizard newItem={ctx.terms.newItem} b={{
      id: b.id, name: b.name, tagline: b.tagline ?? '', logo_path: b.logo_path, hero_path: b.hero_path, hero_focal_x: b.hero_focal_x, hero_focal_y: b.hero_focal_y,
      hero_title: b.hero_title ?? '', hero_text: b.hero_text ?? '', hero_button: b.hero_button ?? '', hero_action: b.hero_action, hero_links: b.hero_links ?? { show: [], custom: null }, order_types: b.order_types ?? [],
      accent_color: b.accent_color, accent_auto: b.accent_auto, address: b.address ?? '', maps_url: b.maps_url ?? '', lat: null, lng: null, contact: b.contact ?? {},
      schedule: b.schedule?.length ? b.schedule : DEFAULT_SCHEDULE,
    }} mode={b.mode} />
  )
}
