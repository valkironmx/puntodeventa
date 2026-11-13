'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { cancelPublicAppointmentAction } from '@/app/actions/booking'
import { useToast } from '@/components/ui'

export function CancelButton({ token }: { token: string }) {
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const toast = useToast()
  return (
    <button className="btn ghost rj" style={{ marginTop: 10 }} disabled={busy} onClick={async () => {
      if (!confirm('¿Cancelar tu cita?')) return
      setBusy(true)
      const r = await cancelPublicAppointmentAction(token)
      setBusy(false)
      if (!r.ok) toast(r.error, true); else { toast('Cita cancelada'); router.refresh() }
    }}>Cancelar mi cita</button>
  )
}
