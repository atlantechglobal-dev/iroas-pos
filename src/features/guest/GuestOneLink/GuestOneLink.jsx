import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { guestSitePath } from '@/shared/utils/guestLinks'

/** Old /l/:slug hub redirects to the single guest website. */
function GuestOneLink() {
  const { slug = 'your-link' } = useParams()
  useEffect(() => {}, [])
  return <Navigate to={guestSitePath(slug, 'website')} replace />
}

export default GuestOneLink
