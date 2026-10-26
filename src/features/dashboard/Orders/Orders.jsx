import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { ROUTES } from '@/shared/constants/routes'
import { useToast } from '@/shared/ui/feedback/ToastProvider'
import { api } from '@/shared/lib/api'
import { usePosResource } from '@/shared/hooks/usePosResource'
import PosOrdersBoard from '@/features/dashboard/Orders/PosOrdersBoard'
import PosOrderModal from '@/features/dashboard/Orders/PosOrderModal'
import '@/features/dashboard/Orders/Orders.css'

function Orders() {
  const toast = useToast()
  const [filterMode, setFilterMode] = useState('all')
  const posOrders = usePosResource(api.getPosOrders, { refreshMs: 20000 })
  const posLinked = posOrders.status !== 'not_connected' && posOrders.status !== 'loading'
  const [posModalOpen, setPosModalOpen] = useState(false)
  const [shift, setShift] = useState(null)

  const loadShift = () => {
    if (!posLinked) return
    api
      .getPosShift()
      .then((res) => setShift(res?.data || null))
      .catch((err) => {
        setShift(null)
        toast.error(err?.message || 'Could not read the POS shift.')
      })
  }

  useEffect(() => {
    loadShift()
    // Reload when the POS connection state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posLinked])

  return (
    <DashboardLayout pageClassName="orders-page" activeNav="incoming-orders">
      <div className="page-head">
        <div>
          <p className="eyebrow">Live kitchen</p>
          <h1>Orders</h1>
          <p className="page-desc">
            POS kitchen and payment lanes. Advance kitchen status here (Received → Completed); URY tracks Draft /
            Unbilled / Paid. Refreshes every 20s.
          </p>
        </div>
        <div className="head-actions">
          <select
            className="btn btn-outline"
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            aria-label="Filter by service"
          >
            <option value="all">All channels</option>
            <option value="dinein">Dine-in</option>
            <option value="pickup">Takeaway</option>
            <option value="delivery">Delivery</option>
          </select>
          {posLinked ? (
            <Link className="btn btn-outline" to={ROUTES.POS_SHIFT}>
              POS shift
            </Link>
          ) : null}
          {posLinked ? (
            <button className="btn btn-outline" type="button" onClick={() => setPosModalOpen(true)}>
              + New POS order
            </button>
          ) : null}
          <button className="btn btn-primary" type="button" onClick={posOrders.reload}>
            Refresh
          </button>
        </div>
      </div>

      {posLinked && shift ? (
        <p className={`pos-shift-banner${shift.open ? ' is-open' : ''}`}>
          {shift.open
            ? `POS shift open${shift.cashier ? ` for ${shift.cashier}` : ''}${shift.entry?.name ? ` · ${shift.entry.name}` : ''}${shift.entry?.startedAt ? ` · since ${shift.entry.startedAt}` : ''}. Close it from POS Shift so URY POS closes too.`
            : `POS shift is closed. Open it from POS Shift${shift.cashier ? ` as ${shift.cashier}` : ''} so the same session shows in URY POS.`}
        </p>
      ) : null}

      {posOrders.status === 'loading' ? <p className="empty-col">Loading POS orders…</p> : null}

      {posOrders.status === 'not_connected' ? (
        <p className="empty-col">Your POS is not connected yet. Contact IROAS support to link your restaurant&apos;s POS.</p>
      ) : null}

      {posOrders.status !== 'loading' && posOrders.status !== 'not_connected' ? (
        <PosOrdersBoard posOrders={posOrders} filterMode={filterMode} />
      ) : null}

      {posModalOpen ? (
        <PosOrderModal
          onClose={() => setPosModalOpen(false)}
          onPlaced={(result) => {
            setPosModalOpen(false)
            toast.success(
              `Order sent to the kitchen · ${result.table}${result.invoice ? ` · ${result.invoice}` : ''}`,
            )
            posOrders.reload()
          }}
        />
      ) : null}
    </DashboardLayout>
  )
}

export default Orders
