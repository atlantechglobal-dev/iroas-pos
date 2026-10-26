import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { api } from '@/shared/lib/api'
import { restaurantPublicSlug } from '@/shared/utils/guestLinks'
import PosTablesPanel from '@/features/dashboard/Tables/PosTablesPanel'
import PosTableQrPanel from '@/features/dashboard/Tables/PosTableQrPanel'
import AddPosTable from '@/features/dashboard/Tables/AddPosTable'
import '@/features/dashboard/Tables/Tables.css'

function Tables() {
  const [siteSlug, setSiteSlug] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    api
      .getRestaurant()
      .then((res) => {
        if (cancelled || !res?.restaurant) return
        setSiteSlug(restaurantPublicSlug(res.restaurant, 'your-restaurant'))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <DashboardLayout pageClassName="tables-page table-qr-page" activeNav="tables">
      <div className="page-head">
        <div>
          <p className="eyebrow">Dine-in ordering</p>
          <h1>Table QR codes</h1>
          <p className="page-desc">
            Print one QR per POS table. Guests scan → open your live POS menu → order for that table.
          </p>
        </div>
        <AddPosTable onCreated={() => setRefreshKey((key) => key + 1)} />
      </div>

      <PosTablesPanel refreshKey={refreshKey} />
      <PosTableQrPanel siteSlug={siteSlug} refreshKey={refreshKey} />
    </DashboardLayout>
  )
}

export default Tables
