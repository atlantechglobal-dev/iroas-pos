import { ComingSoon } from '@/shared/ui/ComingSoon'
import '@/features/dashboard/Marketing/Marketing.css'

export default function Marketing() {
  return (
    <ComingSoon
      pageClassName="marketing-page"
      activeNav="marketing"
      eyebrow="Growth"
      title="Marketing"
      description="Campaigns, coupons and reminders are planned for the next phase."
    />
  )
}
