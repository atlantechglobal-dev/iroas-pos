import http from 'node:http'

const key = (doctype, name) => `${doctype}::${name}`

function stamp(doc) {
  for (const value of Object.values(doc)) {
    if (!Array.isArray(value)) continue
    value.forEach((row, i) => {
      if (row && typeof row === 'object') Object.assign(row, { parent: doc.name, idx: i + 1, name: row.name || `${doc.name}-${i}` })
    })
  }
  return doc
}

const OPS = {
  '=': (a, b) => a === b,
  '!=': (a, b) => a !== b,
  in: (a, b) => Array.isArray(b) && b.includes(a),
  '>=': (a, b) => a >= b,
}

function matches(doc, filters) {
  const rows = Array.isArray(filters) ? filters : Object.entries(filters).map(([k, v]) => [k, '=', v])
  return rows.every(([field, op, value]) => (OPS[op] || OPS['='])(doc[field], value))
}

/** In-memory Frappe site that satisfies the tenant verification calls and generic doc reads/writes. */
export function createFakeBench({ restaurant = 'Resto', branch = 'B', profile = 'P', user = 'int@site' } = {}) {
  const docs = new Map()
  const writes = []
  const calls = []
  const extras = []
  const state = { down: false }

  const put = (doc) => docs.set(key(doc.doctype, doc.name), structuredClone(doc))
  const get = (doctype, name) => docs.get(key(doctype, name))

  function reset() {
    docs.clear()
    writes.length = 0
    calls.length = 0
    state.down = false
    put({ doctype: 'URY Restaurant', name: restaurant, branch, address: null, active_menu: 'M' })
    put({ doctype: 'Branch', name: branch, user: [{ parent: branch, user }] })
    put({ doctype: 'POS Profile', name: profile, restaurant, branch, disabled: 0 })
    for (const name of ['South Africa', 'Botswana']) put({ doctype: 'Country', name })
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://fake')
    const method = url.pathname.replace('/api/method/', '')
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {}
      const reply = (status, payload) => {
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(payload))
      }
      calls.push({ method, body })
      if (state.down) return reply(503, {})
      if (extras.some((fn) => fn({ method, body, url, reply, docs, put, get, writes }))) return
      if (method === 'frappe.auth.get_logged_user') return reply(200, { message: user })
      if (method === 'ury.ury_pos.api.getPosProfile') return reply(200, { message: { branch, pos_profile: profile } })
      if (method === 'frappe.desk.form.load.getdoc') {
        const doc = get(url.searchParams.get('doctype'), url.searchParams.get('name'))
        return reply(200, doc ? { docs: [structuredClone(doc)] } : { message: [] })
      }
      if (method === 'frappe.desk.reportview.get_list') {
        const doctype = url.searchParams.get('doctype')
        const filters = JSON.parse(url.searchParams.get('filters') || '{}')
        const rows = [...docs.values()].filter((d) => d.doctype === doctype && matches(d, filters))
        return reply(200, { message: structuredClone(rows) })
      }
      if (method === 'frappe.client.save') {
        writes.push({ method, doc: body.doc })
        put(stamp(body.doc))
        return reply(200, { message: body.doc })
      }
      if (method === 'frappe.client.insert') {
        const doc = { ...body.doc }
        doc.name = doc.name || doc.item_code || `${doc.address_title || doc.branch}-${doc.address_type || ''}`.replace(/-$/, '')
        writes.push({ method, doc })
        put(stamp(doc))
        return reply(200, { message: doc })
      }
      if (method === 'frappe.client.set_value') {
        writes.push({ method, doc: body })
        const doc = get(body.doctype, body.name)
        doc[body.fieldname] = body.value
        return reply(200, { message: doc })
      }
      return reply(404, {})
    })
  })

  reset()
  return {
    docs,
    writes,
    calls,
    state,
    put,
    get,
    reset,
    onRequest: (fn) => extras.push(fn),
    start: () => new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`))),
    stop: () => server.close(),
  }
}
