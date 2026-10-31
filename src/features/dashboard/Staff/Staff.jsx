import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { useRestaurant } from '@/shared/hooks/useRestaurant'
import { usePosResource } from '@/shared/hooks/usePosResource'
import { api } from '@/shared/lib/api'
import PosStaffView from '@/features/dashboard/Staff/PosStaffView'
import '@/features/dashboard/Staff/Staff.css'

function Staff() {
  const { displayRestaurant } = useRestaurant()
  const posStaff = usePosResource(api.getPosStaff)

  return (
    <DashboardLayout pageClassName="staff-page" activeNav="staff">
      <div className="page-head">
        <div>
          <p className="eyebrow">People</p>
          <h1>Staff</h1>
          <p className="page-desc">Your team at {displayRestaurant}, live from your POS. Add or edit staff in the POS.</p>
        </div>
      </div>
      {posStaff.status === 'not_connected' ? (
        <p className="empty-note">Your POS is not connected yet. Your team will appear here once it is.</p>
      ) : (
        <PosStaffView posStaff={posStaff} />
      )}
    </DashboardLayout>
  )
}

export default Staff
