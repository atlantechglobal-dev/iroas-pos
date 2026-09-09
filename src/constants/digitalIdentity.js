export const BUSINESS_CATEGORIES = [
  'Restaurant',
  'Retail Store',
  'Salon',
  'Clinic',
  'Consultancy',
  'Freelancer',
  'Professional Services',
  'Real Estate',
  'Education',
  'Fitness/Gym',
  'Local Business',
  'E-commerce Business',
  'Other',
]

export const IDENTITY_STATUS_LABELS = {
  not_started: 'Not Started',
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  needs_info: 'Additional Info Required',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
}

export const PRODUCT_TYPE_LABELS = {
  website: 'Simple Website',
  digital_business_card: 'Digital Business Card',
  mobile_app: 'Mobile Application',
}

export function formatStatus(status) {
  if (!status) return 'Not Started'
  return IDENTITY_STATUS_LABELS[status] || status.replace(/_/g, ' ')
}

export function emptyIdentityForm() {
  return {
    businessName: '',
    category: '',
    categoryOther: '',
    businessType: '',
    description: '',
    yearEstablished: '',
    contactPerson: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    brandName: '',
    primaryBrandInfo: '',
    logoDataUrl: '',
    social: {
      instagram: '',
      facebook: '',
      twitter: '',
      linkedin: '',
      youtube: '',
    },
    onlinePresence: {
      wantsWebsite: true,
      wantsBusinessCard: true,
      wantsMobileApp: false,
      notes: '',
    },
    verticalFields: {},
  }
}

export function identityToForm(identity) {
  if (!identity) return emptyIdentityForm()
  return {
    ...emptyIdentityForm(),
    businessName: identity.businessName || '',
    category: identity.category || '',
    categoryOther: identity.categoryOther || '',
    businessType: identity.businessType || '',
    description: identity.description || '',
    yearEstablished: identity.yearEstablished || '',
    contactPerson: identity.contactPerson || '',
    phone: identity.phone || '',
    email: identity.email || '',
    website: identity.website || '',
    address: identity.address || '',
    city: identity.city || '',
    state: identity.state || '',
    country: identity.country || '',
    postalCode: identity.postalCode || '',
    brandName: identity.brandName || '',
    primaryBrandInfo: identity.primaryBrandInfo || '',
    logoDataUrl: identity.logoDataUrl || '',
    social: { ...emptyIdentityForm().social, ...(identity.social || {}) },
    onlinePresence: {
      ...emptyIdentityForm().onlinePresence,
      ...(identity.onlinePresence || {}),
    },
    verticalFields: { ...(identity.verticalFields || {}) },
  }
}

export function isIdentityEditable(status) {
  return !status || ['draft', 'needs_info', 'rejected'].includes(status)
}

export function isIdentityUnlocked(status) {
  return status === 'approved' || status === 'completed'
}

/** Category-specific fields shown on Digital Identity forms. */
export function getCategoryFieldConfig(category) {
  switch (category) {
    case 'Restaurant':
      return [
        { key: 'cuisine', label: 'Cuisine type', required: true },
        { key: 'openingHours', label: 'Opening hours', required: true, placeholder: 'Mon–Sun 11am–11pm' },
        { key: 'menuNotes', label: 'Menu notes', type: 'textarea' },
      ]
    case 'Salon':
    case 'Clinic':
    case 'Fitness/Gym':
      return [
        { key: 'services', label: 'Services offered', required: true },
        { key: 'openingHours', label: 'Opening hours', required: true },
      ]
    case 'Retail Store':
    case 'E-commerce Business':
      return [
        { key: 'productCategories', label: 'Product categories', required: true },
        { key: 'storeLocation', label: 'Store / warehouse location' },
      ]
    case 'Consultancy':
    case 'Freelancer':
    case 'Professional Services':
      return [
        { key: 'specialization', label: 'Specialization', required: true },
        { key: 'clientTypes', label: 'Typical clients' },
      ]
    case 'Real Estate':
      return [
        { key: 'propertyTypes', label: 'Property types', required: true },
        { key: 'serviceAreas', label: 'Service areas' },
      ]
    case 'Education':
      return [
        { key: 'programs', label: 'Programs / courses', required: true },
        { key: 'openingHours', label: 'Operating hours' },
      ]
    case 'Other':
      return [{ key: 'otherDetails', label: 'Additional business details', type: 'textarea', required: true }]
    default:
      return [{ key: 'notes', label: 'Additional details', type: 'textarea' }]
  }
}

export function validateIdentityFormClient(identity) {
  const errors = {}
  if (!identity.businessName?.trim()) errors.businessName = 'Business name is required.'
  if (!identity.category?.trim()) errors.category = 'Business category is required.'
  if (identity.category === 'Other' && !identity.categoryOther?.trim()) {
    errors.categoryOther = 'Please specify your category.'
  }
  if (!identity.contactPerson?.trim()) errors.contactPerson = 'Contact person is required.'
  if (!identity.email?.trim()) errors.email = 'Email is required.'
  if (!identity.phone?.trim()) errors.phone = 'Phone is required.'

  for (const field of getCategoryFieldConfig(identity.category)) {
    if (field.required && !String(identity.verticalFields?.[field.key] || '').trim()) {
      errors[`vertical.${field.key}`] = `${field.label} is required.`
    }
  }
  return errors
}
