import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { useRestaurant } from '@/shared/hooks/useRestaurant'
import { api } from '@/shared/lib/api'
import { guestSiteUrl, restaurantPublicSlug } from '@/shared/utils/guestLinks'
import PosMenuView from '@/features/dashboard/Menu/PosMenuView'
import PosMenuActions from '@/features/dashboard/Menu/PosMenuActions'
import { usePosMenu } from '@/features/dashboard/Menu/usePosMenu'
import '@/features/dashboard/Menu/Menu.css'

function Menu() {
  const { displayRestaurant } = useRestaurant()
  const posMenu = usePosMenu()
  const [menuSlug, setMenuSlug] = useState(() =>
    restaurantPublicSlug(displayRestaurant, 'your-restaurant'),
  )
  const previewUrl = guestSiteUrl(menuSlug, 'menu')

  useEffect(() => {
    let cancelled = false
    api
      .getRestaurant()
      .then((res) => {
        if (cancelled || !res?.restaurant) return
        setMenuSlug(restaurantPublicSlug(res.restaurant, 'your-restaurant'))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <DashboardLayout pageClassName="menu-page" activeNav="menu">
      <div className="page-head">
        <div>
          <p className="eyebrow">Menu management</p>
          <h1>Menu</h1>
          <p className="page-desc">
            Live menu from your POS for {displayRestaurant}. Items and prices are managed in your POS.
          </p>
        </div>
        <div className="head-actions">
          {posMenu.status !== 'loading' && posMenu.status !== 'not_connected' ? (
            <PosMenuActions onCreated={(data) => (data ? posMenu.replaceData(data) : posMenu.reload())} />
          ) : null}
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
          >
            👁 Preview
          </button>
        </div>
      </div>

      {posMenu.status === 'loading' ? <p className="empty-note">Loading menu…</p> : null}
      {posMenu.status !== 'loading' ? <PosMenuView posMenu={posMenu} /> : null}
    </DashboardLayout>
  )
}

export default Menu
