import { ComingSoon } from '@/shared/ui/ComingSoon'
import '@/features/dashboard/DirectoryListings/DirectoryListings.css'

export default function DirectoryListings() {
  return (
    <ComingSoon
      pageClassName="directory-page"
      activeNav="directory-listings"
      eyebrow="Discoverability"
      title="Directory Listings"
      description="Your BigDot Global listing and its status will appear here once the directory is connected."
    />
  )
}
