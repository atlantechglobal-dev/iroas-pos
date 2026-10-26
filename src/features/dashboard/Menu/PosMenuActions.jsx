import { useEffect, useState } from 'react'
import { api } from '@/shared/lib/api'
import { useToast } from '@/shared/ui/feedback/ToastProvider'

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const value = String(reader.result || '')
      const dataBase64 = value.split(',')[1] || ''
      resolve({ filename: file.name, mime: file.type, dataBase64 })
    }
    reader.onerror = () => reject(new Error('Could not read that image.'))
    reader.readAsDataURL(file)
  })
}

function parseMenuCsv(text, catalog) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const start = /^item\b/i.test(lines[0] || '') ? 1 : 0
  const added = []
  for (const line of lines.slice(start)) {
    const [label, priceRaw] = line.split(',').map((part) => part.trim().replace(/^"|"$/g, ''))
    const known = (catalog || []).find(
      (item) => item.code === label || item.name.toLowerCase() === String(label || '').toLowerCase(),
    )
    const rate = Number(priceRaw)
    if (!known || !(rate > 0)) throw new Error(`Could not use the row “${line}”. Use an existing item and a price above 0.`)
    added.push({ item: known.code, name: known.name, rate })
  }
  if (!added.length) throw new Error('The CSV has no item rows.')
  return added
}

function downloadMenuTemplate(items) {
  const sample = items?.[0]
  const body = sample ? `${sample.code},${sample.rate || 0}` : 'GR,150'
  const blob = new Blob([`Item,Price\n${body}\n`], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'menu-items.csv'
  link.click()
  URL.revokeObjectURL(url)
}

function Drawer({ title, children, onClose }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  return (
    <div className="menu-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="menu-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="menu-drawer-head">
          <h2>{title}</h2>
          <button type="button" className="menu-drawer-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="menu-drawer-body">{children}</div>
      </aside>
    </div>
  )
}

function PosMenuActions({ onCreated }) {
  const toast = useToast()
  const [options, setOptions] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  const [item, setItem] = useState({ menu: '', name: '', course: '', rate: '', image: null })
  const [courseName, setCourseName] = useState('')
  const [courseIcon, setCourseIcon] = useState('')
  const [menuName, setMenuName] = useState('')
  const [makeActive, setMakeActive] = useState(false)
  const [menuLines, setMenuLines] = useState([])
  const [draftItem, setDraftItem] = useState('')
  const [draftPrice, setDraftPrice] = useState('0')
  const [csvName, setCsvName] = useState('')

  const loadOptions = () => {
    api
      .getPosMenuOptions()
      .then((res) => {
        const data = res?.data || null
        setOptions(data)
        setItem((current) => ({ ...current, menu: current.menu || data?.activeMenu || data?.menus?.[0]?.name || '' }))
      })
      .catch((err) => toast.error(err?.message || 'Could not load menus.'))
  }

  useEffect(() => {
    loadOptions()
    // Options are loaded once when the menu page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const close = () => {
    if (busy) return
    setDialog(null)
  }

  const createItem = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      const res = await api.createPosMenuItem({
        menu: item.menu,
        name: item.name,
        course: item.course,
        rate: Number(item.rate),
        ...(item.image ? { image: item.image } : {}),
      })
      onCreated(res?.data || null)
      toast.success(`${item.name.trim()} was added to ${item.menu}.`)
      setItem({ menu: item.menu, name: '', course: item.course, rate: '', image: null })
      setDialog(null)
    } catch (err) {
      toast.error(err?.message || 'Could not add the item.')
    } finally {
      setBusy(false)
    }
  }

  const createCourse = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      const res = await api.createPosCourse({ name: courseName, icon: courseIcon })
      setOptions(res?.data || options)
      setItem((current) => ({ ...current, course: courseName.trim() }))
      toast.success(`${courseName.trim()} was added.`)
      setCourseName('')
      setCourseIcon('')
      setDialog(null)
    } catch (err) {
      toast.error(err?.message || 'Could not add the course.')
    } finally {
      setBusy(false)
    }
  }

  const createMenu = async (event) => {
    event.preventDefault()
    if (!menuLines.length) {
      toast.error('Add at least one item to this menu.')
      return
    }
    setBusy(true)
    try {
      const res = await api.createPosMenu({
        name: menuName,
        makeActive,
        items: menuLines.map((line) => ({ item: line.item, rate: line.rate })),
      })
      onCreated(res?.data || null)
      toast.success(`${menuName.trim()} was added.`)
      setMenuName('')
      setMakeActive(false)
      setMenuLines([])
      setDraftItem('')
      setDraftPrice('0')
      setCsvName('')
      setDialog(null)
      loadOptions()
    } catch (err) {
      toast.error(err?.message || 'Could not add the menu.')
    } finally {
      setBusy(false)
    }
  }

  const addMenuLine = () => {
    const known = (options?.items || []).find((item) => item.code === draftItem)
    const rate = Number(draftPrice)
    if (!known) {
      toast.error('Select an item.')
      return
    }
    if (!(rate > 0)) {
      toast.error('Enter a price greater than 0.')
      return
    }
    setMenuLines((current) => {
      const rest = current.filter((line) => line.item !== known.code)
      return [...rest, { item: known.code, name: known.name, rate }]
    })
    setDraftItem('')
    setDraftPrice('0')
  }

  const importCsv = async (file) => {
    if (!file) return
    if (!/\.csv$/i.test(file.name)) {
      toast.error('Upload a CSV file.')
      return
    }
    try {
      const text = await file.text()
      const rows = parseMenuCsv(text, options?.items || [])
      setMenuLines((current) => {
        const next = new Map(current.map((line) => [line.item, line]))
        for (const row of rows) next.set(row.item, row)
        return [...next.values()]
      })
      setCsvName(file.name)
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <>
      <button className="btn btn-outline" type="button" onClick={() => setDialog('course')}>
        Add course
      </button>
      <button className="btn btn-outline" type="button" onClick={() => setDialog('menu')}>
        Add menu
      </button>
      <button className="btn btn-primary" type="button" onClick={() => setDialog('item')}>
        Add item
      </button>

      {dialog === 'item' ? (
        <Drawer title="Add Menu Item" onClose={close}>
          <form onSubmit={createItem}>
            <label>
              Target menu
              <select value={item.menu} onChange={(event) => setItem({ ...item, menu: event.target.value })} required>
                {(options?.menus || []).map((menu) => (
                  <option key={menu.name} value={menu.name}>
                    {menu.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="menu-modal-row">
              <label>
                Item name
                <input value={item.name} onChange={(event) => setItem({ ...item, name: event.target.value })} required />
              </label>
              <label className="menu-file">
                {item.image ? 'Image added' : 'Upload image'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    readImage(file)
                      .then((image) => setItem((current) => ({ ...current, image })))
                      .catch((err) => toast.error(err.message))
                  }}
                />
              </label>
            </div>
            <label>
              Course
              <select value={item.course} onChange={(event) => setItem({ ...item, course: event.target.value })}>
                <option value="">Select…</option>
                {(options?.courses || []).map((course) => (
                  <option key={course} value={course}>
                    {course}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Standard rate{options?.currency ? ` (${options.currency})` : ''}
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={item.rate}
                onChange={(event) => setItem({ ...item, rate: event.target.value })}
                required
              />
            </label>
            <div className="menu-modal-actions">
              <button className="btn btn-outline" type="button" disabled={busy} onClick={close}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Create item'}
              </button>
            </div>
          </form>
        </Drawer>
      ) : null}

      {dialog === 'course' ? (
        <Drawer title="Add New Course" onClose={close}>
          <form onSubmit={createCourse}>
            <label>
              Course name
              <input value={courseName} onChange={(event) => setCourseName(event.target.value)} required />
            </label>
            <label>
              Icon
              <select value={courseIcon} onChange={(event) => setCourseIcon(event.target.value)}>
                <option value="">Select icon…</option>
                {(options?.icons || []).map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
            </label>
            <div className="menu-modal-actions">
              <button className="btn btn-outline" type="button" disabled={busy} onClick={close}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Create course'}
              </button>
            </div>
          </form>
        </Drawer>
      ) : null}

      {dialog === 'menu' ? (
        <Drawer title="Add New Menu" onClose={close}>
          <form onSubmit={createMenu}>
            <label>
              Menu name
              <input value={menuName} onChange={(event) => setMenuName(event.target.value)} required />
            </label>
            <label>
              Branch
              <select value={options?.branch || ''} disabled>
                <option value={options?.branch || ''}>{options?.branch || 'Branch'}</option>
              </select>
            </label>
            <div className="menu-items-head">
              <div>
                <strong>Menu items</strong>
                <p>Add items and set a custom price for this menu</p>
              </div>
            </div>
            <div className="menu-line-labels">
              <span>Item</span>
              <span>Price{options?.currency ? ` (${options.currency})` : ''}</span>
            </div>
            {menuLines.map((line) => (
              <div className="menu-line" key={line.item}>
                <input value={`${line.name} (${line.code || line.item})`} readOnly />
                <input value={line.rate} readOnly />
                <button
                  type="button"
                  className="menu-line-remove"
                  onClick={() => setMenuLines((current) => current.filter((row) => row.item !== line.item))}
                  aria-label={`Remove ${line.name}`}
                >
                  ×
                </button>
              </div>
            ))}
            <div className="menu-line">
              <select value={draftItem} onChange={(event) => setDraftItem(event.target.value)} aria-label="Select item">
                <option value="">Select item…</option>
                {(options?.items || []).map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                value={draftPrice}
                aria-label="Item price"
                onChange={(event) => setDraftPrice(event.target.value)}
              />
            </div>
            <button className="menu-add-line" type="button" onClick={addMenuLine}>
              + Add item
            </button>
            <div className="menu-bulk">
              <div>
                <strong>Bulk upload (optional)</strong>
                <p>Import items from a CSV file</p>
              </div>
              <button type="button" className="menu-template" onClick={() => downloadMenuTemplate(options?.items)}>
                Download template
              </button>
            </div>
            <label
              className="menu-drop"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                importCsv(event.dataTransfer.files?.[0])
              }}
            >
              {csvName ? csvName : 'Drag and drop a CSV file here, or browse'}
              <small>Supports CSV files only</small>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => importCsv(event.target.files?.[0])}
              />
            </label>
            <label className="menu-check">
              <input type="checkbox" checked={makeActive} onChange={(event) => setMakeActive(event.target.checked)} />
              Show this menu on the website
            </label>
            <div className="menu-modal-actions">
              <button className="btn btn-outline" type="button" disabled={busy} onClick={close}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Create menu'}
              </button>
            </div>
          </form>
        </Drawer>
      ) : null}
    </>
  )
}

export default PosMenuActions
