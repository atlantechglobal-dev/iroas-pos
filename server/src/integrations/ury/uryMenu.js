// URY Menu READ for a mapped URY Restaurant. Verified chain (docs/ury/URY_MENU_API_DISCOVERY.md):
//   getdoc URY Restaurant <mapped>  -> active_menu, branch, room_wise_menu, order_type_wise_menu
//   getdoc URY Menu <active_menu>   -> branch, enabled, price_list, items[] (URY Menu Item rows)
//   getdoc Price List <price_list>  -> currency
// One getdoc returns every child row, so there is no per-item request and no pagination.
//   get_list Item (name in <menu item codes>) -> image, disabled  (one request)

import { UryError, getUryBaseUrl } from './uryClient.js'
import { IntegrationError } from './uryTenant.js'

const CACHE_TTL_MS = 60_000
const MAX_PRICE = 10_000_000
const MAX_STOCK = 100_000
const cache = new Map()

/** URY stores either absolute image URLs or site paths such as /files/x.jpg. */
export function absoluteImageUrl(value, baseUrl = getUryBaseUrl()) {
  const src = String(value || '').trim()
  if (!src) return null
  if (/^https?:\/\//i.test(src)) return src
  if (src.startsWith('/') && baseUrl) return `${baseUrl.replace(/\/+$/, '')}${src}`
  return null
}

/**
 * Groups URY Menu Item rows by `course`, keeping URY's row order (`idx`).
 * `availabilityByCode` is URY's get_item_availability result (sellable + available_qty),
 * which is what the POS register uses. Warehouse Bin qty is only a fallback.
 */
export function mapUryMenuToIroasMenu(menuDoc, itemInfo = new Map(), stockByCode = null, availabilityByCode = null) {
  const rows = (menuDoc.items || []).filter((row) => row.parent === menuDoc.name)

  const categories = []
  const byCourse = new Map()
  for (const row of rows) {
    const courseName = row.course || ''
    if (!byCourse.has(courseName)) {
      const category = { id: courseName || 'uncategorized', name: courseName || 'Uncategorized', items: [] }
      byCourse.set(courseName, category)
      categories.push(category)
    }
    const info = itemInfo.get(row.item) || {}
    const avail = availabilityByCode?.get(row.item) || null
    const stockQty = avail
      ? avail.availableQty
      : stockByCode && row.item
        ? (stockByCode.get(row.item) ?? 0)
        : null
    const inStock = avail ? avail.sellable : stockQty === null || stockQty > 0
    const enabled = row.disabled !== 1 && info.disabled !== 1
    byCourse.get(courseName).items.push({
      id: row.name,
      code: row.item || '',
      name: row.item_name || row.item || '',
      price: typeof row.rate === 'number' ? row.rate : null,
      available: enabled && inStock,
      onMenu: enabled,
      stockQty,
      special: row.special_dish === 1,
      image: info.image || null,
    })
  }
  return categories
}

async function readCurrency(client, priceList) {
  if (!priceList) return null
  try {
    const body = await client.getDoc('Price List', priceList)
    return body.docs[0].currency || null
  } catch (err) {
    if (err instanceof UryError && (err.code === 'not_found' || err.code === 'forbidden')) return null
    throw err
  }
}

/** Item image + disabled flag per item code. Missing permission leaves items without images. */
async function readItemInfo(client, rows) {
  const codes = [...new Set(rows.map((r) => r.item).filter(Boolean))]
  if (!codes.length) return new Map()
  try {
    const items = await client.getList('Item', {
      fields: ['name', 'image', 'disabled'],
      filters: [['name', 'in', codes]],
      limit: codes.length,
    })
    return new Map(items.map((it) => [it.name, { image: absoluteImageUrl(it.image), disabled: it.disabled }]))
  } catch (err) {
    if (err instanceof UryError && err.code === 'forbidden') return new Map()
    throw err
  }
}

/**
 * Same check the POS register runs per item:
 * GET ury.ury.api.ury_availability.get_item_availability
 * Returns null when this URY build has no availability API, so callers can
 * fall back to warehouse quantity.
 */
export async function sellableByCode(client, { posProfile, branch, company, codes }) {
  const unique = [...new Set((codes || []).filter(Boolean))]
  if (!unique.length) return null
  let resolvedBranch = branch || ''
  let resolvedCompany = company || ''
  if (posProfile && (!resolvedBranch || !resolvedCompany)) {
    try {
      const profile = (await client.getDoc('POS Profile', posProfile)).docs[0]
      resolvedBranch = resolvedBranch || profile.branch || ''
      resolvedCompany = resolvedCompany || profile.company || ''
    } catch (err) {
      if (!(err instanceof UryError && (err.code === 'not_found' || err.code === 'forbidden'))) throw err
    }
  }
  if (!resolvedBranch || !resolvedCompany) return null

  const rows = await Promise.all(
    unique.map(async (code) => {
      try {
        const body = await client.get('ury.ury.api.ury_availability.get_item_availability', {
          item_code: code,
          branch: resolvedBranch,
          company: resolvedCompany,
        })
        const message = body?.message
        if (!message || typeof message.sellable !== 'boolean') return null
        const qty = Number(message.available_qty)
        return { code, sellable: message.sellable === true, availableQty: Number.isFinite(qty) ? qty : 0 }
      } catch (err) {
        if (err instanceof UryError && (err.code === 'not_found' || err.status === 404 || err.code === 'forbidden')) return null
        throw err
      }
    }),
  )
  const known = rows.filter(Boolean)
  return known.length ? new Map(known.map((row) => [row.code, row])) : null
}

/** Register menu order, names, and images. Null when this call is not available. */
async function readRegisterMenu(client, posProfile) {
  if (!posProfile) return null
  try {
    const body = await client.get('ury.ury_pos.api.getRestaurantMenu', {
      pos_profile: posProfile,
      order_type: 'Take Away',
    })
    return Array.isArray(body?.message?.items) ? body.message.items : null
  } catch (err) {
    if (err instanceof UryError && (err.code === 'not_found' || err.status === 404 || err.code === 'forbidden')) return null
    throw err
  }
}

function alignMenuRows(rows, register) {
  if (!register?.length) return rows
  const order = new Map(register.map((item, index) => [item.item, index]))
  const byCode = new Map(register.map((item) => [item.item, item]))
  return [...rows]
    .map((row) => {
      const live = byCode.get(row.item)
      if (!live) return row
      return {
        ...row,
        item_name: live.item_name || row.item_name,
        rate: typeof live.rate === 'number' ? live.rate : row.rate,
        course: live.course_label || live.course || row.course,
        special_dish: live.special_dish === 1 ? 1 : row.special_dish,
        disabled: live.disabled === 1 ? 1 : row.disabled,
        item_image: absoluteImageUrl(live.item_image),
      }
    })
    .sort((a, b) => (order.get(a.item) ?? 999) - (order.get(b.item) ?? 999))
}

/**
 * Stock at the POS Profile warehouse (Bin.actual_qty). Returns null when the
 * warehouse cannot be read so callers keep disabled-only availability.
 */
async function readPosWarehouseStock(client, posProfileName, rows) {
  const codes = [...new Set(rows.map((r) => r.item).filter(Boolean))]
  if (!posProfileName || !codes.length) return null
  try {
    const profile = (await client.getDoc('POS Profile', posProfileName)).docs[0]
    const warehouse = String(profile?.warehouse || '').trim()
    if (!warehouse) return null
    const bins = await client.getList('Bin', {
      fields: ['item_code', 'actual_qty'],
      filters: [
        ['warehouse', '=', warehouse],
        ['item_code', 'in', codes],
      ],
      limit: codes.length,
    })
    const stock = new Map(codes.map((code) => [code, 0]))
    for (const bin of bins) {
      const qty = Number(bin.actual_qty)
      stock.set(bin.item_code, Number.isFinite(qty) ? qty : 0)
    }
    return stock
  } catch (err) {
    if (err instanceof UryError && (err.code === 'forbidden' || err.code === 'not_found')) return null
    throw err
  }
}

async function loadActiveMenuDoc({ client, uryRestaurant, branch }) {
  let restaurant
  try {
    restaurant = (await client.getDoc('URY Restaurant', uryRestaurant)).docs[0]
  } catch (err) {
    if (err instanceof UryError && err.code === 'not_found') {
      throw new IntegrationError('mapping_invalid', 'Mapped POS restaurant does not exist.', { reason: 'restaurant_not_found' })
    }
    throw err
  }
  if (restaurant.name !== uryRestaurant || restaurant.branch !== branch) {
    throw new IntegrationError('mapping_invalid', 'Mapped POS restaurant does not match.', { reason: 'restaurant_branch_mismatch' })
  }
  if (!restaurant.active_menu) return { restaurant, menu: null }
  const menu = (await client.getDoc('URY Menu', restaurant.active_menu)).docs[0]
  if (menu.name !== restaurant.active_menu || menu.branch !== branch) {
    throw new IntegrationError('mapping_invalid', 'Active POS menu does not belong to the mapped restaurant.', { reason: 'menu_branch_mismatch' })
  }
  return { restaurant, menu }
}

export class MenuEditError extends Error {
  constructor(code, message, { status = 400 } = {}) {
    super(message)
    this.name = 'MenuEditError'
    this.code = code
    this.status = status
  }
}

/**
 * Updates availability and/or price of one row of the tenant's active URY menu.
 * The row must belong to the mapped restaurant's active menu; nothing else is writable.
 *   POST frappe.client.set_value { doctype: "URY Menu Item", name: <row>, fieldname: { disabled?, rate? } }
 */
export async function updateUryMenuItem(tenant, rowId, changes = {}) {
  const values = {}
  if (changes.available !== undefined) {
    if (typeof changes.available !== 'boolean') throw new MenuEditError('invalid_available', 'Availability must be true or false.')
    values.disabled = changes.available ? 0 : 1
  }
  if (changes.price !== undefined) {
    const price = Number(changes.price)
    if (!Number.isFinite(price) || price <= 0 || price > MAX_PRICE) throw new MenuEditError('invalid_price', 'Enter a price greater than 0.')
    values.rate = Math.round(price * 100) / 100
  }
  if (!Object.keys(values).length) throw new MenuEditError('nothing_to_update', 'Nothing to update.')

  const rowIdText = String(rowId || '')
  const { menu } = await loadActiveMenuDoc(tenant)
  let row = menu?.items?.find((entry) => entry.name === rowIdText && entry.parent === menu.name)
  if (!row) {
    const menus = await branchMenus(tenant.client, tenant.branch)
    for (const listed of menus) {
      if (listed.name === menu?.name) continue
      let doc
      try {
        doc = (await tenant.client.getDoc('URY Menu', listed.name)).docs[0]
      } catch (err) {
        if (err instanceof UryError && (err.code === 'not_found' || err.code === 'forbidden')) continue
        throw err
      }
      row = (doc.items || []).find((entry) => entry.name === rowIdText && entry.parent === listed.name)
      if (row) break
    }
  }
  if (!row) throw new MenuEditError('item_not_found', 'Menu item not found.', { status: 404 })

  try {
    await tenant.client.post('frappe.client.set_value', { doctype: row.doctype || 'URY Menu Item', name: row.name, fieldname: values })
  } catch (err) {
    if (err instanceof UryError && err.code === 'validation') throw new MenuEditError('rejected', err.message, { status: 422 })
    throw err
  }
  clearUryMenuCache()
  return getUryMenu(tenant)
}

async function readMenuCatalog(client, branch, knownDocs = new Map()) {
  const menus = await branchMenus(client, branch)
  let courseRows = []
  try {
    courseRows = await client.getList('URY Menu Course', { fields: ['name', 'course'], limit: 200 })
  } catch (err) {
    if (!(err instanceof UryError && (err.code === 'forbidden' || err.code === 'not_found'))) throw err
  }
  const items = []
  for (const menu of menus) {
    let doc = knownDocs.get(menu.name)
    if (!doc) {
      try {
        doc = (await client.getDoc('URY Menu', menu.name)).docs[0]
      } catch (err) {
        if (err instanceof UryError && (err.code === 'not_found' || err.code === 'forbidden')) continue
        throw err
      }
    }
    const rows = [...(doc.items || [])]
      .filter((row) => !row.parent || row.parent === menu.name)
      .sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0))
    for (const row of rows) {
      if (!row.item) continue
      const enabled = row.disabled !== 1
      items.push({
        id: row.name,
        menu: menu.name,
        code: row.item,
        name: row.item_name || row.item,
        course: row.course || '',
        price: typeof row.rate === 'number' ? row.rate : null,
        available: enabled,
        onMenu: enabled,
        stockQty: null,
        special: row.special_dish === 1,
        image: absoluteImageUrl(row.item_image),
      })
    }
  }
  const itemInfo = await readItemInfo(client, items.map((item) => ({ item: item.code })))
  for (const item of items) {
    const info = itemInfo.get(item.code) || {}
    if (!item.image && info.image) item.image = info.image
    if (info.disabled === 1) {
      item.onMenu = false
      item.available = false
    }
  }
  const courses = []
  const seenCourses = new Set()
  for (const name of [...courseRows.map((row) => row.course || row.name), ...items.map((item) => item.course)]) {
    const course = String(name || '').trim()
    if (!course || seenCourses.has(course)) continue
    seenCourses.add(course)
    courses.push(course)
  }
  return {
    menus: menus.map((row) => ({ name: row.name, enabled: row.enabled === 1 })),
    courses,
    items,
  }
}

async function loadMenu(tenant) {
  const { client } = tenant
  const { restaurant, menu } = await loadActiveMenuDoc(tenant)
  const knownDocs = new Map()
  if (menu) knownDocs.set(menu.name, menu)
  const catalog = await readMenuCatalog(client, tenant.branch, knownDocs)
  const meta = {
    roomWiseMenus: restaurant.room_wise_menu === 1,
    orderTypeMenus: restaurant.order_type_wise_menu === 1,
  }
  const catalogCodes = catalog.items.map((item) => item.code)
  if (!menu) {
    return { menu: null, reason: 'no_active_menu', currency: null, categories: [], meta, catalog, codes: catalogCodes }
  }
  if (menu.enabled !== 1) {
    return { menu: { name: menu.name }, reason: 'menu_disabled', currency: null, categories: [], meta, catalog, codes: catalogCodes }
  }

  const ordered = [...(menu.items || [])]
    .filter((row) => row.parent === menu.name)
    .sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0))
  const rows = alignMenuRows(ordered, await readRegisterMenu(client, tenant.posProfile))
  const codes = rows.map((row) => row.item)
  const [currency, itemInfo] = await Promise.all([
    readCurrency(client, menu.price_list),
    readItemInfo(client, rows),
  ])
  for (const row of rows) {
    if (!row.item_image) continue
    const info = itemInfo.get(row.item) || {}
    if (!info.image) itemInfo.set(row.item, { ...info, image: row.item_image })
  }
  const stockByCode = await readPosWarehouseStock(client, tenant.posProfile, rows)
  return {
    menu: { name: menu.name },
    reason: null,
    currency,
    categories: mapUryMenuToIroasMenu({ ...menu, items: rows }, itemInfo, stockByCode, null),
    meta,
    catalog,
    codes: [...new Set([...codes, ...catalogCodes])],
  }
}

/** Menu structure is cached. Sellable quantity is read live so each day follows that day's plan. */
export async function getUryMenu(tenant) {
  const key = `${tenant.restaurantId}\u0000${tenant.uryRestaurant}\u0000${tenant.branch}`
  const hit = cache.get(key)
  let shell
  if (hit && hit.expires > Date.now()) shell = hit.data
  else {
    shell = await loadMenu(tenant)
    cache.set(key, { data: shell, expires: Date.now() + CACHE_TTL_MS })
  }
  const availability = await sellableByCode(tenant.client, {
    posProfile: tenant.posProfile,
    branch: tenant.branch,
    company: shell.company,
    codes: shell.codes || [],
  })
  const { codes, company, ...data } = applyLiveAvailability(shell, availability)
  return { ...data, fetchedAt: new Date().toISOString() }
}

function applyItemAvailability(item, availabilityByCode) {
  const avail = availabilityByCode.get(item.code)
  if (!avail) return item
  return {
    ...item,
    available: item.onMenu !== false && avail.sellable,
    stockQty: avail.availableQty,
  }
}

function applyLiveAvailability(data, availabilityByCode) {
  if (!availabilityByCode) return data
  return {
    ...data,
    categories: (data.categories || []).map((category) => ({
      ...category,
      items: (category.items || []).map((item) => applyItemAvailability(item, availabilityByCode)),
    })),
    catalog: data.catalog
      ? { ...data.catalog, items: (data.catalog.items || []).map((item) => applyItemAvailability(item, availabilityByCode)) }
      : data.catalog,
  }
}

function cleanName(value, max = 140) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function itemCodeFromName(name) {
  const code = name.normalize('NFKD').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 20)
  return code || 'ITEM'
}

async function uniqueItemCode(client, base) {
  for (let n = 0; n < 50; n += 1) {
    const code = n === 0 ? base : `${base.slice(0, 16)}${n + 1}`
    try {
      await client.getDoc('Item', code)
    } catch (err) {
      if (err instanceof UryError && err.code === 'not_found') return code
      throw err
    }
  }
  throw new MenuEditError('item_exists', 'Choose a different item name.')
}

function decodeImage(image) {
  if (!image) return null
  const mime = String(image.mime || '')
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)) {
    throw new MenuEditError('invalid_image', 'Upload a JPEG, PNG, or WebP image.')
  }
  const bytes = Buffer.from(String(image.dataBase64 || ''), 'base64')
  if (!bytes.length || bytes.length > 2_000_000) throw new MenuEditError('invalid_image', 'Image must be under 2 MB.')
  const filename = cleanName(image.filename, 80).replace(/[^\w.()-]+/g, '_') || 'menu-item'
  return { filename, bytes, mime }
}

async function stockUom(client) {
  try {
    const rows = await client.getList('UOM', {
      fields: ['name'],
      filters: [['name', 'in', ['Nos', 'Unit', 'Kg']]],
      limit: 5,
    })
    return ['Nos', 'Unit', 'Kg'].find((name) => rows.some((row) => row.name === name)) || 'Nos'
  } catch (err) {
    if (err instanceof UryError && (err.code === 'forbidden' || err.code === 'not_found')) return 'Nos'
    throw err
  }
}

async function branchMenus(client, branch) {
  return client.getList('URY Menu', {
    fields: ['name', 'enabled', 'price_list'],
    filters: [['branch', '=', branch]],
    limit: 50,
  })
}

/** Menus, courses, and existing items the menu forms can use. */
export async function getUryMenuOptions(tenant) {
  const { restaurant, menu } = await loadActiveMenuDoc(tenant)
  const [menus, courses] = await Promise.all([
    branchMenus(tenant.client, tenant.branch),
    tenant.client.getList('URY Menu Course', { fields: ['name', 'course'], limit: 100 }).catch((err) => {
      if (err instanceof UryError && (err.code === 'forbidden' || err.code === 'not_found')) return []
      throw err
    }),
  ])
  return {
    activeMenu: menu?.name || '',
    branch: tenant.branch,
    currency: menu ? await readCurrency(tenant.client, menu.price_list) : null,
    restaurant: restaurant.name,
    menus: menus.map((row) => ({ name: row.name, enabled: row.enabled === 1 })),
    courses: [...new Set(courses.map((row) => row.course || row.name).filter(Boolean))],
    icons: COURSE_ICONS,
    items: await menuCatalog(tenant.client, menus),
  }
}

async function menuCatalog(client, menus) {
  const items = []
  const seen = new Set()
  for (const menu of menus) {
    let doc
    try {
      doc = (await client.getDoc('URY Menu', menu.name)).docs[0]
    } catch (err) {
      if (err instanceof UryError && (err.code === 'not_found' || err.code === 'forbidden')) continue
      throw err
    }
    for (const row of doc.items || []) {
      if (!row.item || seen.has(row.item)) continue
      seen.add(row.item)
      items.push({
        code: row.item,
        name: row.item_name || row.item,
        rate: typeof row.rate === 'number' ? row.rate : 0,
        course: row.course || '',
      })
    }
  }
  return items.sort((a, b) => a.name.localeCompare(b.name))
}

function stockAmount(value) {
  if (value === undefined || value === null || value === '') return 0
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_STOCK) {
    throw new MenuEditError('invalid_stock', `Enter a quantity between 0 and ${MAX_STOCK.toLocaleString('en')}.`)
  }
  return Math.round(amount * 1000) / 1000
}

/** Makes an item sellable (production setup) and adds stock, through iroas_ury_ext. */
async function receiveStock(tenant, code, amount) {
  try {
    await tenant.client.post('iroas_ury_ext.api.menu.stock_menu_item', { item_code: code, qty: amount })
  } catch (err) {
    if (err instanceof UryError && err.code === 'validation') throw new MenuEditError('rejected', err.message, { status: 422 })
    if (err instanceof UryError && err.status === 404) throw new MenuEditError('item_not_found', 'Menu item not found.', { status: 404 })
    throw err
  }
}

export async function addUryItemStock(tenant, code, qty) {
  const item = cleanName(code, 140)
  if (!item) throw new MenuEditError('item_required', 'Choose an item.')
  await receiveStock(tenant, item, stockAmount(qty))
  clearUryMenuCache()
  return getUryMenu(tenant)
}

/** Creates an Item, then adds it to the chosen URY Menu. Same sequence as the URY menu screen. */
export async function createUryMenuItem(tenant, input = {}) {
  const menuName = cleanName(input.menu, 140)
  const itemName = cleanName(input.name, 140)
  const course = cleanName(input.course, 140)
  const rate = Number(input.rate)
  if (!menuName) throw new MenuEditError('menu_required', 'Choose a menu.')
  if (!itemName) throw new MenuEditError('name_required', 'Enter an item name.')
  if (!Number.isFinite(rate) || rate <= 0 || rate > MAX_PRICE) throw new MenuEditError('invalid_price', 'Enter a price greater than 0.')
  const openingStock = stockAmount(input.openingStock)

  const menus = await branchMenus(tenant.client, tenant.branch)
  if (!menus.some((row) => row.name === menuName)) throw new MenuEditError('menu_not_found', 'Menu not found.', { status: 404 })

  const image = decodeImage(input.image)
  let imageUrl = ''
  if (image) imageUrl = await tenant.client.uploadFile(image.filename, image.bytes, image.mime)

  const code = await uniqueItemCode(tenant.client, itemCodeFromName(itemName))
  try {
    await tenant.client.post('frappe.client.insert', {
      doc: {
        doctype: 'Item',
        item_code: code,
        item_name: itemName,
        item_group: 'Products',
        stock_uom: await stockUom(tenant.client),
        is_stock_item: 1,
        standard_rate: Math.round(rate * 100) / 100,
        ...(imageUrl ? { image: imageUrl } : {}),
      },
    })
  } catch (err) {
    if (err instanceof UryError && err.code === 'validation') throw new MenuEditError('rejected', err.message, { status: 422 })
    throw err
  }

  const doc = (await tenant.client.getDoc('URY Menu', menuName)).docs[0]
  doc.items = [
    ...(doc.items || []),
    {
      doctype: 'URY Menu Item',
      parent: doc.name,
      parentfield: 'items',
      parenttype: 'URY Menu',
      item: code,
      item_name: itemName,
      rate: Math.round(rate * 100) / 100,
      course,
      disabled: 0,
      special_dish: 0,
    },
  ]
  doc.doctype = 'URY Menu'
  try {
    await tenant.client.post('frappe.client.save', { doc })
  } catch (err) {
    if (err instanceof UryError && err.code === 'validation') throw new MenuEditError('rejected', err.message, { status: 422 })
    throw err
  }
  clearUryMenuCache()
  try {
    await receiveStock(tenant, code, openingStock)
  } catch {
    throw new MenuEditError(
      'item_setup_failed',
      'The item was added but is not ready to sell yet. Use "Add stock" on the item to finish.',
      { status: 502 },
    )
  }
  clearUryMenuCache()
  return getUryMenu(tenant)
}

const COURSE_ICONS = [
  'Apple', 'Banana', 'Beef', 'Beer', 'Blender', 'BottleWine', 'Broccoli', 'Cake', 'CakeSlice', 'Candy',
  'CandyCane', 'Carrot', 'ChefHat', 'Cherry', 'Citrus', 'Coffee', 'Cookie', 'CookingPot', 'Croissant',
  'CupSoda', 'Dessert', 'Donut', 'Drumstick', 'Egg', 'EggFried', 'Fish', 'FishSymbol', 'GlassWater',
  'Grape', 'Hamburger', 'HandPlatter', 'Hop', 'IceCreamBowl', 'IceCreamCone', 'LeafyGreen', 'Lollipop',
  'Martini', 'Microwave', 'Milk', 'Nut', 'PaperBag', 'Pizza', 'Popcorn', 'Popsicle', 'Refrigerator',
  'Salad', 'Sandwich', 'Shell', 'Shrimp', 'Snail', 'Soup', 'Taco', 'Torus', 'Utensils', 'UtensilsCrossed',
  'Vegan', 'Wheat', 'Wine',
]

/** Creates a URY Menu Course, which is the Course dropdown on Add Menu Item. */
export async function createUryCourse(tenant, input = {}) {
  const name = cleanName(input.name, 140)
  const icon = cleanName(input.icon, 40)
  if (!name) throw new MenuEditError('name_required', 'Enter a course name.')
  if (icon && !COURSE_ICONS.includes(icon)) throw new MenuEditError('invalid_icon', 'Choose an icon from the list.')
  const doc = { doctype: 'URY Menu Course', course: name }
  if (icon) doc.icon = icon
  try {
    await tenant.client.post('frappe.client.insert', { doc })
  } catch (err) {
    if (err instanceof UryError && err.code === 'validation') throw new MenuEditError('rejected', err.message, { status: err.status === 409 ? 409 : 422 })
    throw err
  }
  return getUryMenuOptions(tenant)
}

/** Creates a URY Menu for this branch, with the chosen items and prices. */
export async function createUryMenuDoc(tenant, input = {}) {
  const name = cleanName(input.name, 140)
  if (!name) throw new MenuEditError('name_required', 'Enter a menu name.')
  const existing = await branchMenus(tenant.client, tenant.branch)
  if (existing.some((row) => row.name === name)) throw new MenuEditError('menu_exists', 'A menu with that name already exists.')
  const catalog = await menuCatalog(tenant.client, existing)
  const byCode = new Map(catalog.map((item) => [item.code, item]))
  const chosen = []
  const seen = new Set()
  for (const line of Array.isArray(input.items) ? input.items : []) {
    const code = cleanName(line?.item ?? line?.code, 140)
    const rate = Number(line?.rate)
    const known = byCode.get(code)
    if (!known) throw new MenuEditError('item_not_found', 'Choose an item that already exists in the POS.')
    if (!(rate > 0) || rate > MAX_PRICE) throw new MenuEditError('invalid_price', `Enter a price greater than 0 for ${known.name}.`)
    if (seen.has(code)) continue
    seen.add(code)
    chosen.push({ ...known, rate: Math.round(rate * 100) / 100 })
  }
  if (!chosen.length) throw new MenuEditError('items_required', 'Add at least one item to this menu.')

  const { menu } = await loadActiveMenuDoc(tenant)
  try {
    await tenant.client.post('frappe.client.insert', {
      doc: {
        doctype: 'URY Menu',
        name,
        branch: tenant.branch,
        enabled: 1,
        price_list: menu?.price_list || existing.find((row) => row.price_list)?.price_list || '',
        items: chosen.map((item) => ({
          doctype: 'URY Menu Item',
          parent: name,
          parentfield: 'items',
          parenttype: 'URY Menu',
          item: item.code,
          item_name: item.name,
          rate: item.rate,
          course: item.course,
          disabled: 0,
          special_dish: 0,
        })),
      },
    })
  } catch (err) {
    if (err instanceof UryError && err.code === 'validation') {
      throw new MenuEditError('rejected', err.message || 'A menu with that name already exists.', { status: err.status === 409 ? 409 : 422 })
    }
    throw err
  }
  if (input.makeActive) {
    await tenant.client.post('frappe.client.set_value', {
      doctype: 'URY Restaurant',
      name: tenant.uryRestaurant,
      fieldname: 'active_menu',
      value: name,
    })
  }
  clearUryMenuCache()
  return getUryMenu(tenant)
}

export function clearUryMenuCache() {
  cache.clear()
}
