import fs from 'fs'

const path = 'src/pages/RestaurantProfile/RestaurantProfile.jsx'
const broken = fs.readFileSync(path, 'utf8')

const layoutStart = broken.indexOf('<DashboardLayout')
const contentStart = broken.indexOf('>', layoutStart) + 1
const contentEnd = broken.lastIndexOf('</DashboardLayout>')
const content = broken.slice(contentStart, contentEnd).trim()

const tabSvg = `function TabSvg({ name }) {
  switch (name) {
    case 'basic':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      )
    case 'hours':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )
    case 'tax':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      )
    case 'social':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      )
    case 'delivery':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      )
    case 'brand':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      )
    case 'team':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    case 'billing':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      )
    case 'notifications':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      )
    default:
      return null
  }
}`

const componentBody = `function RestaurantProfile() {
  const toast = useToast()

  const [activeTab, setActiveTab] = useState('basic')
  const [saving, setSaving] = useState(false)
  const [displayName, setDisplayName] = useState('Saffron & Fig')
  const [displayStatus, setDisplayStatus] = useState('Downtown · Open')

  const [name, setName] = useState('Saffron & Fig')
  const [legalEntity, setLegalEntity] = useState('Saffron Hospitality Pvt Ltd')
  const [cuisine, setCuisine] = useState('Modern Indian - Mediterranean')
  const [priceRange, setPriceRange] = useState('₹₹₹ · 800–1500 / head')
  const [tagline, setTagline] = useState('A coastal kitchen, with fire and saffron')
  const [yearEstablished, setYearEstablished] = useState('2019')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('14 Bandstand Promenade, Muml')
  const [phone, setPhone] = useState('+91 98200 12345')
  const [email, setEmail] = useState('hello@saffronandfig.in')
  const [website, setWebsite] = useState('saffronandfig.in')
  const [hours, setHours] = useState(defaultHours)
  const [timezone, setTimezone] = useState('Asia/Kolkata (GMT+5:30)')
  const [lastOrderCutoff, setLastOrderCutoff] = useState('22:45')
  const [pauseOrders, setPauseOrders] = useState(false)
  const [honorHolidays, setHonorHolidays] = useState(true)
  const [city, setCity] = useState('Mumbai')
  const [country, setCountry] = useState('India')
  const [gstin, setGstin] = useState('27ABCDE1234F1Z5')
  const [pan, setPan] = useState('ABCDE1234F')
  const [fssai, setFssai] = useState('11522016000123')
  const [cgst, setCgst] = useState('2.5%')
  const [sgst, setSgst] = useState('2.5%')
  const [serviceCharge, setServiceCharge] = useState('0%')
  const [currency, setCurrency] = useState('INR (₹)')
  const [rounding, setRounding] = useState('Nearest ₹1')
  const [invoicePrefix, setInvoicePrefix] = useState('SF-2026-')
  const [instagram, setInstagram] = useState('@saffronandfig')
  const [facebook, setFacebook] = useState('facebook.com/saffronandfig')
  const [twitter, setTwitter] = useState('@saffronandfig')
  const [youtube, setYoutube] = useState('youtube.com/@saffronandfig')
  const [googleBusiness, setGoogleBusiness] = useState('g.page/saffronandfig')
  const [tripadvisor, setTripadvisor] = useState('tripadvisor.com/saffronandfig')
  const [deliveryRadius, setDeliveryRadius] = useState('')
  const [deliveryMinOrder, setDeliveryMinOrder] = useState('')
  const [deliveryBaseFee, setDeliveryBaseFee] = useState('')
  const [deliveryPerKmFee, setDeliveryPerKmFee] = useState('')
  const [deliveryFreeAbove, setDeliveryFreeAbove] = useState('')
  const [deliveryPrepTime, setDeliveryPrepTime] = useState('')
  const [channelInHouse, setChannelInHouse] = useState(true)
  const [channelZomato, setChannelZomato] = useState(true)
  const [channelSwiggy, setChannelSwiggy] = useState(true)
  const [channelDunzo, setChannelDunzo] = useState(false)
  const [logoDataUrl, setLogoDataUrl] = useState(null)
  const [coverPhoto, setCoverPhoto] = useState(null)
  const [ogImage, setOgImage] = useState(null)
  const [emailNotifs, setEmailNotifs] = useState(true)
  const [smsNotifs, setSmsNotifs] = useState(true)
  const [pushNotifs, setPushNotifs] = useState(true)
  const [whatsappNotifs, setWhatsappNotifs] = useState(false)
  const [newOrderAlert, setNewOrderAlert] = useState(true)
  const [cancelOrderAlert, setCancelOrderAlert] = useState(true)
  const [lowStockAlert, setLowStockAlert] = useState(true)
  const [eodReportAlert, setEodReportAlert] = useState(true)

  useEffect(() => {
    api
      .getRestaurant()
      .then(({ restaurant }) => {
        if (restaurant.name) {
          setName(restaurant.name)
          setDisplayName(restaurant.name)
        }
        if (restaurant.cuisine) setCuisine(restaurant.cuisine)
        if (restaurant.description) setDescription(restaurant.description)
        if (restaurant.phone) setPhone(restaurant.phone)
        if (restaurant.website) setWebsite(restaurant.website)
        if (restaurant.email) setEmail(restaurant.email)
        if (restaurant.city) setCity(restaurant.city)
        if (restaurant.country) setCountry(restaurant.country)
        if (restaurant.timezone) setTimezone(restaurant.timezone)
        if (restaurant.address) setAddress(restaurant.address)
        if (restaurant.logo_data_url) setLogoDataUrl(restaurant.logo_data_url)
        if (restaurant.operating_hours) {
          try {
            setHours(JSON.parse(restaurant.operating_hours))
          } catch {
            // keep defaults
          }
        }

        const settings = restaurant.settings || {}
        if (settings.legalEntity) setLegalEntity(settings.legalEntity)
        if (settings.priceRange) setPriceRange(settings.priceRange)
        if (settings.tagline) setTagline(settings.tagline)
        if (settings.yearEstablished) setYearEstablished(settings.yearEstablished)
        if (settings.gstin) setGstin(settings.gstin)
        if (settings.pan) setPan(settings.pan)
        if (settings.fssai) setFssai(settings.fssai)
        if (settings.cgst) setCgst(settings.cgst)
        if (settings.sgst) setSgst(settings.sgst)
        if (settings.serviceCharge !== undefined) setServiceCharge(settings.serviceCharge)
        if (settings.currency) setCurrency(settings.currency)
        if (settings.rounding) setRounding(settings.rounding)
        if (settings.invoicePrefix) setInvoicePrefix(settings.invoicePrefix)
        if (settings.instagram) setInstagram(settings.instagram)
        if (settings.facebook) setFacebook(settings.facebook)
        if (settings.twitter) setTwitter(settings.twitter)
        if (settings.youtube) setYoutube(settings.youtube)
        if (settings.googleBusiness) setGoogleBusiness(settings.googleBusiness)
        if (settings.tripadvisor) setTripadvisor(settings.tripadvisor)
        if (settings.lastOrderCutoff) setLastOrderCutoff(settings.lastOrderCutoff)
        if (settings.pauseOrders !== undefined) setPauseOrders(settings.pauseOrders)
        if (settings.honorHolidays !== undefined) setHonorHolidays(settings.honorHolidays)
        if (settings.deliveryRadius) setDeliveryRadius(settings.deliveryRadius)
        if (settings.deliveryMinOrder) setDeliveryMinOrder(settings.deliveryMinOrder)
        if (settings.deliveryBaseFee) setDeliveryBaseFee(settings.deliveryBaseFee)
        if (settings.deliveryPerKmFee) setDeliveryPerKmFee(settings.deliveryPerKmFee)
        if (settings.deliveryFreeAbove) setDeliveryFreeAbove(settings.deliveryFreeAbove)
        if (settings.deliveryPrepTime) setDeliveryPrepTime(settings.deliveryPrepTime)
        if (settings.channelInHouse !== undefined) setChannelInHouse(settings.channelInHouse)
        if (settings.channelZomato !== undefined) setChannelZomato(settings.channelZomato)
        if (settings.channelSwiggy !== undefined) setChannelSwiggy(settings.channelSwiggy)
        if (settings.channelDunzo !== undefined) setChannelDunzo(settings.channelDunzo)
        if (settings.coverPhoto) setCoverPhoto(settings.coverPhoto)
        if (settings.ogImage) setOgImage(settings.ogImage)
      })
      .catch(() => {})
  }, [])

  const updateHour = (index, field, value) => {
    setHours((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  const setupSections = [
    { key: 'basic', label: 'Basic info', done: true },
    { key: 'hours', label: 'Hours & timezone', done: true },
    { key: 'tax', label: 'Tax & legal', done: true },
    { key: 'social', label: 'Social links', done: false },
    { key: 'delivery', label: 'Delivery radius', done: false },
  ]

  const completedCount = setupSections.filter((section) => section.done).length
  const progressPct = Math.round((completedCount / setupSections.length) * 100)

  const readFileAsDataUrl = (file, setter) => {
    const reader = new FileReader()
    reader.onload = (event) => setter(event.target.result)
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.updateProfile({
        restaurantName: name,
        cuisine,
        description,
        phone,
        website,
        email,
        city,
        country,
        timezone,
        address,
        hours,
      })
      await api.updateSettings({
        legalEntity,
        priceRange,
        tagline,
        yearEstablished,
        gstin,
        pan,
        fssai,
        cgst,
        sgst,
        serviceCharge,
        currency,
        rounding,
        invoicePrefix,
        instagram,
        facebook,
        twitter,
        youtube,
        googleBusiness,
        tripadvisor,
        lastOrderCutoff,
        pauseOrders,
        honorHolidays,
        deliveryRadius,
        deliveryMinOrder,
        deliveryBaseFee,
        deliveryPerKmFee,
        deliveryFreeAbove,
        deliveryPrepTime,
        channelInHouse,
        channelZomato,
        channelSwiggy,
        channelDunzo,
        coverPhoto,
        ogImage,
      })
      if (logoDataUrl) {
        await api.updateBrand({ logoDataUrl })
      }
      setDisplayName(name)
      toast.success('Restaurant profile saved.')
    } catch (err) {
      toast.error(err.message || 'Failed to save profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout pageClassName="restaurant-profile-page" activeNav="restaurant-profile">
${content}
    </DashboardLayout>
  )
}`

const header = `import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import './RestaurantProfile.css'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const defaultHours = [
  { day: 'Mon', open: '', close: '', closed: true },
  { day: 'Tue', open: '11:00', close: '23:30', closed: false },
  { day: 'Wed', open: '11:00', close: '23:30', closed: false },
  { day: 'Thu', open: '11:00', close: '23:30', closed: false },
  { day: 'Fri', open: '11:00', close: '23:30', closed: false },
  { day: 'Sat', open: '11:00', close: '23:30', closed: false },
  { day: 'Sun', open: '11:00', close: '23:30', closed: false },
]

const TABS = [
  { key: 'basic', label: 'Basic info' },
  { key: 'hours', label: 'Hours & timezone' },
  { key: 'tax', label: 'Tax & legal' },
  { key: 'social', label: 'Social links' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'brand', label: 'Brand media' },
  { key: 'team', label: 'Team access' },
  { key: 'billing', label: 'Billing' },
  { key: 'notifications', label: 'Notifications' },
]

`

const output = `${header}${tabSvg}\n\n${componentBody}\n\nexport default RestaurantProfile\n`
fs.writeFileSync(path, output)
console.log('Rebuilt RestaurantProfile.jsx')
