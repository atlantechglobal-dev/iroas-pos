import { db } from '../../infra/db.js'
import { UryError } from './uryClient.js'
import { OrderingError } from './uryOrdering.js'

db.exec(`
  CREATE TABLE IF NOT EXISTS ury_staff_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    request_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('placing', 'placed', 'unknown')),
    result_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (restaurant_id, request_id)
  );
`)

const REQUEST_ID_RE = /^[A-Za-z0-9_-]{16,64}$/
const KEEP_DAYS = 7

const find = (restaurantId, requestId) =>
  db.prepare('SELECT * FROM ury_staff_orders WHERE restaurant_id = ? AND request_id = ?').get(restaurantId, requestId)

function blocked() {
  return new OrderingError(
    'order_in_progress',
    'This order may already have been sent to the POS. Check the table before sending it again.',
    { status: 409 },
  )
}

function settledBefore(err) {
  if (err instanceof OrderingError) return true
  return err instanceof UryError && ['auth_failed', 'forbidden', 'validation', 'not_found'].includes(err.code)
}

/**
 * Runs `place` at most once per (restaurant, requestId). A replay returns the first result;
 * an attempt whose outcome is unknown is never re-sent.
 */
export async function placeOnce(restaurantId, requestId, place) {
  if (!REQUEST_ID_RE.test(String(requestId || ''))) {
    throw new OrderingError('invalid_request', 'Reload the page and try again.')
  }

  db.prepare(`DELETE FROM ury_staff_orders WHERE created_at < datetime('now', ?)`).run(`-${KEEP_DAYS} days`)

  const inserted = db
    .prepare(`INSERT OR IGNORE INTO ury_staff_orders (restaurant_id, request_id, status) VALUES (?, ?, 'placing')`)
    .run(restaurantId, requestId).changes
  if (!inserted) {
    const row = find(restaurantId, requestId)
    if (row?.status === 'placed') return { ...JSON.parse(row.result_json), replayed: true }
    throw blocked()
  }

  try {
    const result = await place()
    db.prepare(`UPDATE ury_staff_orders SET status = 'placed', result_json = ? WHERE restaurant_id = ? AND request_id = ?`).run(
      JSON.stringify(result),
      restaurantId,
      requestId,
    )
    return result
  } catch (err) {
    if (settledBefore(err)) {
      db.prepare('DELETE FROM ury_staff_orders WHERE restaurant_id = ? AND request_id = ?').run(restaurantId, requestId)
    } else {
      db.prepare(`UPDATE ury_staff_orders SET status = 'unknown' WHERE restaurant_id = ? AND request_id = ?`).run(restaurantId, requestId)
    }
    throw err
  }
}
