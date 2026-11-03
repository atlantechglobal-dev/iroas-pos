const PAGE_LINKS = [
  { key: 'menu', name: 'Digital Menu', meta: 'Live menu with prices', icon: '/images/menu.png' },
  { key: 'order', name: 'Order Online', meta: 'Takeaway and dine-in', icon: '/images/order online.png' },
  { key: 'book', name: 'Book a Table', meta: 'Live availability', icon: '/images/table book.png' },
]

const web = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`)

/**
 * The buttons on the hub: what the owner switched on in One Link. Before they save anything,
 * the site pages plus a review link. Call, directions and socials have their own spots on the page.
 */
export function hubLinks(site) {
  const saved = site?.oneLink?.destinations
  if (Array.isArray(saved) && saved.length) {
    return saved.filter((d) => d.live && d.key && d.key !== 'website' && d.href)
  }
  const review = site?.restaurant?.socials?.googleReview
  return [
    ...PAGE_LINKS,
    ...(review ? [{ key: 'review', name: 'Leave a Review', meta: 'Google reviews', href: web(review), icon: '/images/review.svg' }] : []),
  ]
}
