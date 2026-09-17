import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'

/** Legacy route — payment success now uses the shared /review page. */
function PaymentThanks() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate(ROUTES.SETUP_REVIEW, { replace: true, state: { fromPayment: true } })
  }, [navigate])
  return null
}

export default PaymentThanks
