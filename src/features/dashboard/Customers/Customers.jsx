import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { usePosResource } from '@/shared/hooks/usePosResource'
import { api } from '@/shared/lib/api'
import PosCustomersView from '@/features/dashboard/Customers/PosCustomersView'
import '@/features/dashboard/Customers/Customers.css'

function Customers() {
  const posCustomers = usePosResource(api.getPosCustomers)

  return (
    <DashboardLayout pageClassName="customers-page" activeNav="customers">
      <div className="page-head">
        <div>
          <p className="eyebrow">People</p>
          <h1>Customers</h1>
          <p className="page-desc">Guests who have ordered at your restaurant, live from your POS bills.</p>
        </div>
      </div>
      {posCustomers.status === 'not_connected' ? (
        <p className="empty-note">Your POS is not connected yet. Guests will appear here once it is.</p>
      ) : (
        <PosCustomersView posCustomers={posCustomers} />
      )}
    </DashboardLayout>
  )
}

export default Customers
