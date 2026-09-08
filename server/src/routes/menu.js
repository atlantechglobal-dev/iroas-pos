import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { mediaPath } from './public.js'

const router = Router()

const TINTS = ['tint-green', 'tint-blue', 'tint-peach', 'tint-mint', 'tint-lime', 'tint-gray', 'tint-rose', 'tint-violet']

function getOwnRestaurant(ownerId) {
  return db.prepare('SELECT * FROM restaurants WHERE owner_id = ?').get(ownerId)
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function mapCategory(row, itemCount = 0) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    tint: row.tint,
    imageDataUrl: row.image_data_url || '',
    sortOrder: row.sort_order,
    itemCount,
  }
}

function mapItem(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description || '',
    price: row.price,
    veg: Boolean(row.veg),
    tag: row.tag || '',
    prepMinutes: row.prep_minutes ?? 15,
    stockStatus: row.stock_status,
    stockCount: row.stock_count,
    status: row.status,
    imageDataUrl: row.image_data_url || '',
    sortOrder: row.sort_order,
  }
}

function listCategories(restaurantId, { includeArchived = true } = {}) {
  const rows = includeArchived
    ? db
        .prepare(
          `SELECT c.*,
            (SELECT COUNT(*) FROM menu_items i WHERE i.category_id = c.id AND i.status != 'archived') AS item_count
           FROM menu_categories c
           WHERE c.restaurant_id = ?
           ORDER BY c.sort_order ASC, c.id ASC`,
        )
        .all(restaurantId)
    : db
        .prepare(
          `SELECT c.*,
            (SELECT COUNT(*) FROM menu_items i WHERE i.category_id = c.id AND i.status = 'live') AS item_count
           FROM menu_categories c
           WHERE c.restaurant_id = ? AND c.status = 'live'
           ORDER BY c.sort_order ASC, c.id ASC`,
        )
        .all(restaurantId)

  return rows.map((row) => mapCategory(row, row.item_count))
}

function listItems(restaurantId, { categoryId, includeArchived = true, liveOnly = false } = {}) {
  let sql = `SELECT * FROM menu_items WHERE restaurant_id = ?`
  const params = [restaurantId]
  if (categoryId) {
    sql += ` AND category_id = ?`
    params.push(categoryId)
  }
  if (liveOnly) {
    sql += ` AND status = 'live'`
  } else if (!includeArchived) {
    sql += ` AND status != 'archived'`
  }
  sql += ` ORDER BY sort_order ASC, id ASC`
  return db.prepare(sql).all(...params).map(mapItem)
}

function seedDefaultMenu(restaurantId) {
  const existing = db
    .prepare('SELECT COUNT(*) AS c FROM menu_categories WHERE restaurant_id = ?')
    .get(restaurantId)
  if (existing.c > 0) return

  const insertCat = db.prepare(
    `INSERT INTO menu_categories (restaurant_id, name, status, tint, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
  )
  const insertItem = db.prepare(
    `INSERT INTO menu_items
      (restaurant_id, category_id, name, description, price, veg, tag, prep_minutes, stock_status, stock_count, status, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'live', ?)`,
  )

  const starters = insertCat.run(restaurantId, 'Starters', 'live', 'tint-green', 0).lastInsertRowid
  const mains = insertCat.run(restaurantId, 'Mains', 'live', 'tint-blue', 1).lastInsertRowid
  const pizza = insertCat.run(restaurantId, 'Wood-fired Pizza', 'live', 'tint-peach', 2).lastInsertRowid
  const desserts = insertCat.run(restaurantId, 'Desserts', 'live', 'tint-mint', 3).lastInsertRowid
  const drinks = insertCat.run(restaurantId, 'Beverages', 'live', 'tint-lime', 4).lastInsertRowid
  insertCat.run(restaurantId, 'Seasonal', 'draft', 'tint-gray', 5)

  const seedItems = [
    [starters, 'Burrata & Heirloom Tomato', 'Apulian burrata, basil oil, sourdough', 400, 1, 'Best', 8, 'in_stock', null, 0],
    [starters, 'Crispy Calamari', 'Lemon aioli, chilli salt', 460, 0, '', 12, 'in_stock', null, 1],
    [starters, 'Charred Broccolini', 'Tahini, toasted sesame', 320, 1, '', 10, 'in_stock', null, 2],
    [mains, 'Truffle Mushroom Risotto', 'Carnaroli rice, black truffle, parmesan crisp', 480, 1, 'Chef', 18, 'in_stock', null, 0],
    [mains, 'Saffron Butter Chicken', 'Tandoor chicken, saffron tomato cream, fenugreek', 550, 0, 'Chef', 20, 'low', 3, 1],
    [mains, 'Catch of the Day', 'Market fish, citrus beurre blanc', 620, 0, '', 22, 'in_stock', null, 2],
    [pizza, 'Wood-Fired Margherita', 'San marzano tomato, fior di latte, basil', 350, 1, 'Best', 12, 'in_stock', null, 0],
    [pizza, 'Spicy Diavola', 'Nduja, mozzarella, chilli honey', 420, 0, '', 14, 'in_stock', null, 1],
    [desserts, 'Dark Chocolate Fondant', 'Vanilla bean ice cream', 320, 1, '', 15, 'in_stock', null, 0],
    [desserts, 'Seasonal Pavlova', 'Passionfruit cream', 290, 1, 'Best', 8, 'in_stock', null, 1],
    [drinks, 'Fresh Lime Soda', 'Sweet, salt or mixed', 120, 1, '', 5, 'in_stock', null, 0],
    [drinks, 'Cold Brew', 'Single origin concentrate', 180, 1, '', 5, 'in_stock', null, 1],
  ]

  for (const row of seedItems) {
    insertItem.run(restaurantId, ...row)
  }
}

function findRestaurantBySlug(slug) {
  const clean = slugify(slug)
  if (!clean) return null
  const bySub = db.prepare('SELECT * FROM restaurants WHERE subdomain = ?').get(clean)
  if (bySub) return bySub
  const rows = db.prepare('SELECT * FROM restaurants WHERE name IS NOT NULL').all()
  return rows.find((r) => slugify(r.name) === clean) || null
}

/** Public guest menu — live categories & items only */
router.get('/public/:slug', (req, res) => {
  const restaurant = findRestaurantBySlug(req.params.slug)
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found.' })

  seedDefaultMenu(restaurant.id)

  const slug = restaurant.subdomain || slugify(restaurant.name)
  const categories = listCategories(restaurant.id, { includeArchived: false })
  const items = listItems(restaurant.id, { liveOnly: true })

  const grouped = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    imageDataUrl: cat.imageDataUrl ? mediaPath(slug, 'category', cat.id) : '',
    items: items
      .filter((item) => item.categoryId === cat.id)
      .map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        desc: item.description,
        veg: item.veg,
        tag: item.tag,
        imageDataUrl: item.imageDataUrl ? mediaPath(slug, 'menu', item.id) : '',
        prepMinutes: item.prepMinutes,
      })),
  }))

  res.json({
    restaurant: {
      name: restaurant.name,
      slug,
    },
    categories: grouped,
  })
})

router.use(requireAuth)

router.get('/', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  seedDefaultMenu(restaurant.id)

  const categories = listCategories(restaurant.id)
  const items = listItems(restaurant.id)

  res.json({ categories, items })
})

router.post('/categories', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const { name, status = 'live', tint = 'tint-green', imageDataUrl = null } = req.body || {}
  if (!name?.trim()) return res.status(400).json({ error: 'Category name is required.' })

  const maxSort = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM menu_categories WHERE restaurant_id = ?')
    .get(restaurant.id).m

  const result = db
    .prepare(
      `INSERT INTO menu_categories (restaurant_id, name, status, tint, image_data_url, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      restaurant.id,
      name.trim(),
      ['live', 'draft', 'archived'].includes(status) ? status : 'live',
      TINTS.includes(tint) ? tint : 'tint-green',
      imageDataUrl || null,
      maxSort + 1,
    )

  const row = db.prepare('SELECT * FROM menu_categories WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ category: mapCategory(row, 0) })
})

router.put('/categories/:id', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const category = db
    .prepare('SELECT * FROM menu_categories WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, restaurant.id)
  if (!category) return res.status(404).json({ error: 'Category not found.' })

  const { name, status, tint, imageDataUrl, sortOrder } = req.body || {}

  db.prepare(
    `UPDATE menu_categories
     SET name = ?, status = ?, tint = ?, image_data_url = ?, sort_order = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    name?.trim() || category.name,
    status && ['live', 'draft', 'archived'].includes(status) ? status : category.status,
    tint && TINTS.includes(tint) ? tint : category.tint,
    imageDataUrl !== undefined ? imageDataUrl || null : category.image_data_url,
    Number.isFinite(sortOrder) ? sortOrder : category.sort_order,
    category.id,
  )

  const row = db.prepare('SELECT * FROM menu_categories WHERE id = ?').get(category.id)
  const count = db
    .prepare(`SELECT COUNT(*) AS c FROM menu_items WHERE category_id = ? AND status != 'archived'`)
    .get(category.id).c
  res.json({ category: mapCategory(row, count) })
})

router.post('/categories/:id/duplicate', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const category = db
    .prepare('SELECT * FROM menu_categories WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, restaurant.id)
  if (!category) return res.status(404).json({ error: 'Category not found.' })

  const maxSort = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM menu_categories WHERE restaurant_id = ?')
    .get(restaurant.id).m

  const result = db
    .prepare(
      `INSERT INTO menu_categories (restaurant_id, name, status, tint, image_data_url, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      restaurant.id,
      `${category.name} (copy)`,
      'draft',
      category.tint,
      category.image_data_url,
      maxSort + 1,
    )

  const newId = result.lastInsertRowid
  const items = db
    .prepare(`SELECT * FROM menu_items WHERE category_id = ? AND status != 'archived'`)
    .all(category.id)

  const insertItem = db.prepare(
    `INSERT INTO menu_items
      (restaurant_id, category_id, name, description, price, veg, tag, prep_minutes, stock_status, stock_count, status, image_data_url, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  for (const item of items) {
    insertItem.run(
      restaurant.id,
      newId,
      item.name,
      item.description,
      item.price,
      item.veg,
      item.tag,
      item.prep_minutes,
      item.stock_status,
      item.stock_count,
      'draft',
      item.image_data_url,
      item.sort_order,
    )
  }

  const row = db.prepare('SELECT * FROM menu_categories WHERE id = ?').get(newId)
  res.status(201).json({ category: mapCategory(row, items.length) })
})

router.delete('/categories/:id', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const category = db
    .prepare('SELECT * FROM menu_categories WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, restaurant.id)
  if (!category) return res.status(404).json({ error: 'Category not found.' })

  const archive = req.query.hard !== '1'
  if (archive) {
    db.prepare(
      `UPDATE menu_categories SET status = 'archived', updated_at = datetime('now') WHERE id = ?`,
    ).run(category.id)
    db.prepare(
      `UPDATE menu_items SET status = 'archived', updated_at = datetime('now') WHERE category_id = ?`,
    ).run(category.id)
  } else {
    db.prepare('DELETE FROM menu_categories WHERE id = ?').run(category.id)
  }

  res.json({ ok: true })
})

router.post('/items', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const {
    categoryId,
    name,
    description = '',
    price = 0,
    veg = true,
    tag = '',
    prepMinutes = 15,
    stockStatus = 'in_stock',
    stockCount = null,
    status = 'live',
    imageDataUrl = null,
  } = req.body || {}

  if (!name?.trim()) return res.status(400).json({ error: 'Item name is required.' })
  if (!categoryId) return res.status(400).json({ error: 'Category is required.' })

  const category = db
    .prepare('SELECT * FROM menu_categories WHERE id = ? AND restaurant_id = ?')
    .get(categoryId, restaurant.id)
  if (!category) return res.status(404).json({ error: 'Category not found.' })

  const maxSort = db
    .prepare(
      'SELECT COALESCE(MAX(sort_order), -1) AS m FROM menu_items WHERE restaurant_id = ? AND category_id = ?',
    )
    .get(restaurant.id, categoryId).m

  const result = db
    .prepare(
      `INSERT INTO menu_items
        (restaurant_id, category_id, name, description, price, veg, tag, prep_minutes, stock_status, stock_count, status, image_data_url, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      restaurant.id,
      categoryId,
      name.trim(),
      description,
      Number(price) || 0,
      veg ? 1 : 0,
      tag || null,
      Number(prepMinutes) || 15,
      ['in_stock', 'low', 'out'].includes(stockStatus) ? stockStatus : 'in_stock',
      stockCount == null || stockCount === '' ? null : Number(stockCount),
      ['live', 'draft', 'archived'].includes(status) ? status : 'live',
      imageDataUrl || null,
      maxSort + 1,
    )

  const row = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ item: mapItem(row) })
})

router.put('/items/:id', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const item = db
    .prepare('SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, restaurant.id)
  if (!item) return res.status(404).json({ error: 'Item not found.' })

  const {
    categoryId,
    name,
    description,
    price,
    veg,
    tag,
    prepMinutes,
    stockStatus,
    stockCount,
    status,
    imageDataUrl,
    sortOrder,
  } = req.body || {}

  let nextCategoryId = item.category_id
  if (categoryId) {
    const category = db
      .prepare('SELECT id FROM menu_categories WHERE id = ? AND restaurant_id = ?')
      .get(categoryId, restaurant.id)
    if (!category) return res.status(404).json({ error: 'Category not found.' })
    nextCategoryId = category.id
  }

  db.prepare(
    `UPDATE menu_items
     SET category_id = ?, name = ?, description = ?, price = ?, veg = ?, tag = ?,
         prep_minutes = ?, stock_status = ?, stock_count = ?, status = ?,
         image_data_url = ?, sort_order = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    nextCategoryId,
    name?.trim() || item.name,
    description !== undefined ? description : item.description,
    price !== undefined ? Number(price) || 0 : item.price,
    veg !== undefined ? (veg ? 1 : 0) : item.veg,
    tag !== undefined ? tag || null : item.tag,
    prepMinutes !== undefined ? Number(prepMinutes) || 15 : item.prep_minutes,
    stockStatus && ['in_stock', 'low', 'out'].includes(stockStatus)
      ? stockStatus
      : item.stock_status,
    stockCount !== undefined
      ? stockCount == null || stockCount === ''
        ? null
        : Number(stockCount)
      : item.stock_count,
    status && ['live', 'draft', 'archived'].includes(status) ? status : item.status,
    imageDataUrl !== undefined ? imageDataUrl || null : item.image_data_url,
    Number.isFinite(sortOrder) ? sortOrder : item.sort_order,
    item.id,
  )

  const row = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(item.id)
  res.json({ item: mapItem(row) })
})

router.delete('/items/:id', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const item = db
    .prepare('SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, restaurant.id)
  if (!item) return res.status(404).json({ error: 'Item not found.' })

  if (req.query.hard === '1') {
    db.prepare('DELETE FROM menu_items WHERE id = ?').run(item.id)
  } else {
    db.prepare(
      `UPDATE menu_items SET status = 'archived', updated_at = datetime('now') WHERE id = ?`,
    ).run(item.id)
  }

  res.json({ ok: true })
})

export default router
