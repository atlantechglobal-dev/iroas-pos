import { useCallback, useEffect, useState } from 'react'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { usePosResource } from '@/shared/hooks/usePosResource'
import { api } from '@/shared/lib/api'
import PosCustomersView from '@/features/dashboard/Customers/PosCustomersView'
import '@/features/dashboard/Customers/Customers.css'

function Customers() {
  const posCustomers = usePosResource(api.getPosCustomers)
  const [guests, setGuests] = useState(null)

  const loadGuests = useCallback(() => {
    api
      .getGuests()
      .then((data) => setGuests(data.guests || []))
      .catch(() => setGuests([]))
  }, [])

  useEffect(() => {
    loadGuests()
  }, [loadGuests])

  const reload = () => {
    loadGuests()
    posCustomers.reload()
  }

  return (
    <DashboardLayout pageClassName="customers-page" activeNav="customers">
      <div className="page-head">
        <div>
          <p className="eyebrow">People</p>
          <h1>Customers</h1>
          <p className="page-desc">Guests who have booked or ordered at your restaurant.</p>
        </div>
      </div>
      <PosCustomersView posCustomers={posCustomers} guests={guests} reload={reload} />
    </DashboardLayout>
  )
}

export default Customers
