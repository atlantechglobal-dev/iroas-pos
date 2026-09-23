import { db } from '../infra/db.js'

const KEY = 'business_categories'

/** Seed list — matches historical frontend catalog. Admins can add / edit / remove. */
export const DEFAULT_BUSINESS_CATEGORIES = [
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

function parseJson(raw, fallback = {}) {
  try {
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function normalizeList(list) {
  if (!Array.isArray(list)) return []
  const seen = new Set()
  const out = []
  for (const item of list) {
    const name = normalizeName(typeof item === 'string' ? item : item?.name)
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

function readStored() {
  const row = db.prepare('SELECT value_json FROM platform_settings WHERE key = ?').get(KEY)
  return parseJson(row?.value_json, {})
}

function writeList(categories) {
  db.prepare(
    `INSERT INTO platform_settings (key, value_json, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       value_json = excluded.value_json,
       updated_at = datetime('now')`,
  ).run(KEY, JSON.stringify({ categories }))
  return categories
}

export function listBusinessCategories() {
  const stored = readStored()
  const fromDb = normalizeList(stored.categories)
  if (fromDb.length) return fromDb
  return [...DEFAULT_BUSINESS_CATEGORIES]
}

export function saveBusinessCategories(list) {
  const categories = normalizeList(list)
  if (!categories.length) {
    throw Object.assign(new Error('At least one business category is required.'), { status: 400 })
  }
  return writeList(categories)
}

export function addBusinessCategory(name) {
  const next = normalizeName(name)
  if (!next) {
    throw Object.assign(new Error('Category name is required.'), { status: 400 })
  }
  const current = listBusinessCategories()
  if (current.some((c) => c.toLowerCase() === next.toLowerCase())) {
    throw Object.assign(new Error(`Category “${next}” already exists.`), { status: 409 })
  }
  return writeList([...current, next])
}

export function renameBusinessCategory(oldName, newName) {
  const from = normalizeName(oldName)
  const to = normalizeName(newName)
  if (!from || !to) {
    throw Object.assign(new Error('Category name is required.'), { status: 400 })
  }
  const current = listBusinessCategories()
  const index = current.findIndex((c) => c.toLowerCase() === from.toLowerCase())
  if (index < 0) {
    throw Object.assign(new Error('Category not found.'), { status: 404 })
  }
  if (
    current.some((c, i) => i !== index && c.toLowerCase() === to.toLowerCase())
  ) {
    throw Object.assign(new Error(`Category “${to}” already exists.`), { status: 409 })
  }
  const next = [...current]
  next[index] = to
  return writeList(next)
}

export function removeBusinessCategory(name) {
  const target = normalizeName(name)
  if (!target) {
    throw Object.assign(new Error('Category name is required.'), { status: 400 })
  }
  const current = listBusinessCategories()
  if (current.length <= 1) {
    throw Object.assign(new Error('Keep at least one business category.'), { status: 400 })
  }
  const next = current.filter((c) => c.toLowerCase() !== target.toLowerCase())
  if (next.length === current.length) {
    throw Object.assign(new Error('Category not found.'), { status: 404 })
  }
  return writeList(next)
}

export function ensureBusinessCategoriesBootstrapped() {
  const row = db.prepare('SELECT value_json FROM platform_settings WHERE key = ?').get(KEY)
  if (row?.value_json) return listBusinessCategories()
  return writeList([...DEFAULT_BUSINESS_CATEGORIES])
}
