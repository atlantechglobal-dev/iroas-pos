import { useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { useToast } from '@/shared/ui/feedback/ToastProvider'
import { api } from '@/shared/lib/api'
import '@/features/dashboard/PosShift/PosShift.css'

function formatSession(value) {
  if (!value) return ''
  const date = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('en-GB', { hour12: false })
}

function formatNow() {
  return new Date().toLocaleString('en-GB', { hour12: false })
}

function moneyLabel(symbol, amount) {
  const n = Number(amount)
  const value = Number.isFinite(n) ? n.toFixed(2).replace(/\.00$/, '') : '0'
  return `${symbol || 'R'} ${value}`
}

function PosShift() {
  const toast = useToast()
  const [shift, setShift] = useState(null)
  const [amounts, setAmounts] = useState({})
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [clock, setClock] = useState(formatNow)

  const load = () => {
    setStatus('loading')
    setError('')
    api
      .getPosShift()
      .then((res) => {
        const data = res?.data || null
        setShift(data)
        const next = {}
        for (const mode of data?.paymentModes || []) next[mode.mode] = String(mode.openingAmount ?? 0)
        setAmounts(next)
        setStatus('ready')
      })
      .catch((err) => {
        setShift(null)
        setError(err?.message || 'Could not read the POS shift.')
        setStatus('error')
      })
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (shift?.open) return undefined
    const timer = setInterval(() => setClock(formatNow()), 1000)
    return () => clearInterval(timer)
  }, [shift?.open])

  const modes = shift?.paymentModes?.length ? shift.paymentModes : [{ mode: 'Cash', openingAmount: 0 }]
  const symbol = shift?.currencySymbol || 'R'
  const total = useMemo(
    () => modes.reduce((sum, mode) => sum + (Number(amounts[mode.mode]) || 0), 0),
    [modes, amounts],
  )

  const openShift = async () => {
    setBusy(true)
    try {
      const balanceDetails = modes.map((mode) => ({
        mode_of_payment: mode.mode,
        opening_amount: Number(amounts[mode.mode]) || 0,
      }))
      const res = await api.openPosShift({ balanceDetails })
      setShift(res?.data || null)
      toast.success(
        res?.data?.alreadyOpen
          ? `POS session is already open for ${res?.data?.cashier || 'the cashier'}.`
          : `POS session opened for ${res?.data?.cashier || 'the cashier'}.`,
      )
    } catch (err) {
      toast.error(err?.message || 'Could not open the POS session.')
    } finally {
      setBusy(false)
    }
  }

  const closeShift = async () => {
    setBusy(true)
    try {
      const res = await api.closePosShift()
      setShift(res?.data || null)
      toast.success('POS session is closed.')
    } catch (err) {
      toast.error(err?.message || 'Could not close the POS session.')
    } finally {
      setBusy(false)
    }
  }

  const sessionStart = shift?.open ? formatSession(shift.entry?.startedAt || shift.sessionStart) : clock

  return (
    <DashboardLayout pageClassName="pos-shift-page" activeNav="pos-shift">
      <div className="shift-head">
        <div>
          <p className="shift-kicker">POS session</p>
          <h1>{shift?.open && shift.entry?.user === shift.cashier ? 'POS session' : 'Open POS session'}</h1>
          <p className="shift-desc">
            Start a new POS session to begin taking orders. The session is opened for the POS cashier, so it shows in
            URY POS.
          </p>
        </div>
        <span className={`shift-pill${shift?.open && !shift.outdated ? ' is-open' : ''}`}>
          {status === 'loading' ? 'Checking…' : shift?.outdated ? 'Outdated' : shift?.open ? 'Open' : 'Closed'}
        </span>
      </div>

      {status === 'error' ? <p className="shift-error">{error}</p> : null}
      {status === 'ready' && shift?.outdated ? (
        <p className="shift-error">
          This session started on {formatSession(shift.entry?.startedAt || shift.sessionStart)}. The POS will not take orders
          until you close it and open today&apos;s session.
        </p>
      ) : null}

      {status === 'ready' && shift ? (
        <section className="shift-card">
          <h2>Session details</h2>
          <div className="shift-grid">
            <label>
              Company
              <input value={shift.company || ''} readOnly />
            </label>
            <label>
              Branch
              <input value={shift.branch || ''} readOnly />
            </label>
            <label>
              Cashier
              <input value={shift.cashier || ''} readOnly />
            </label>
            <label>
              Session start
              <input value={sessionStart} readOnly />
            </label>
            <label>
              POS profile
              <input value={shift.posProfile || ''} readOnly />
            </label>
            <label>
              Restaurant
              <input value={shift.restaurant || ''} readOnly />
            </label>
          </div>

          <div className="shift-balance">
            <div>
              <h2>Opening balance</h2>
              <strong>{moneyLabel(symbol, shift.open ? modes.reduce((sum, mode) => sum + Number(mode.openingAmount || 0), 0) : total)}</strong>
            </div>
            <p>
              Opening balance is the starting cash and payment amount you declare for this shift. It is used to
              reconcile against sales when you close out.
            </p>
          </div>

          <table>
            <thead>
              <tr>
                <th>Mode of payment</th>
                <th>Opening amount</th>
              </tr>
            </thead>
            <tbody>
              {modes.map((mode) => (
                <tr key={mode.mode}>
                  <td>{mode.mode}</td>
                  <td>
                    {shift.open ? (
                      <span>{moneyLabel(symbol, mode.openingAmount)}</span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={amounts[mode.mode] ?? '0'}
                        onChange={(event) =>
                          setAmounts((current) => ({ ...current, [mode.mode]: event.target.value }))
                        }
                        aria-label={`${mode.mode} opening amount`}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="shift-total">
            Total opening balance <strong>{moneyLabel(symbol, shift.open ? modes.reduce((sum, mode) => sum + Number(mode.openingAmount || 0), 0) : total)}</strong>
          </p>

          {shift.open && shift.entry?.user && shift.entry.user !== shift.cashier ? (
            <p className="shift-note">
              The open entry {shift.entry.name} belongs to {shift.entry.user}. Opening again closes it and starts a
              session for {shift.cashier}, which is the cashier URY POS checks.
            </p>
          ) : null}

          <div className="shift-actions">
            {shift.open && shift.entry?.user !== shift.cashier ? (
              <button className="shift-btn" type="button" disabled={busy || !shift.cashier} onClick={openShift}>
                {busy ? 'Opening…' : `Open for ${shift.cashier}`}
              </button>
            ) : null}
            {shift.open ? (
              <button className="shift-btn shift-btn-outline" type="button" disabled={busy} onClick={closeShift}>
                {busy ? 'Closing…' : 'Close POS session'}
              </button>
            ) : (
              <button className="shift-btn" type="button" disabled={busy || !shift.cashier} onClick={openShift}>
                {busy ? 'Opening…' : 'Open POS session'}
              </button>
            )}
          </div>
        </section>
      ) : null}
    </DashboardLayout>
  )
}

export default PosShift
