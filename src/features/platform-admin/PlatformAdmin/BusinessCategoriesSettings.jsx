import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { useToast } from '@/shared/ui/feedback/ToastProvider'
import { api } from '@/shared/lib/api'
import { ROUTES } from '@/shared/constants/routes'
import '@/features/dashboard/Settings/EmailSettings.css'
import '@/features/platform-admin/PlatformAdmin/BusinessCategories.css'

function BusinessCategoriesSettings() {
  const toast = useToast()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [busyName, setBusyName] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const { categories: rows } = await api.adminBusinessCategories()
      setCategories(rows || [])
    } catch (err) {
      setCategories([])
      toast.error(err.message || 'Unable to load categories.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const add = async (event) => {
    event.preventDefault()
    const name = newName.trim()
    if (!name) {
      toast.error('Enter a category name.')
      return
    }
    setAdding(true)
    try {
      const { categories: rows } = await api.adminAddBusinessCategory(name)
      setCategories(rows || [])
      setNewName('')
      toast.success(`Added “${name}”.`)
    } catch (err) {
      toast.error(err.message || 'Unable to add category.')
    } finally {
      setAdding(false)
    }
  }

  const startEdit = (name) => {
    setEditing(name)
    setEditValue(name)
  }

  const cancelEdit = () => {
    setEditing(null)
    setEditValue('')
  }

  const saveEdit = async (event) => {
    event?.preventDefault?.()
    if (!editing) return
    const next = editValue.trim()
    if (!next) {
      toast.error('Category name is required.')
      return
    }
    if (next === editing) {
      cancelEdit()
      return
    }
    setBusyName(editing)
    try {
      const { categories: rows } = await api.adminRenameBusinessCategory(editing, next)
      setCategories(rows || [])
      cancelEdit()
      toast.success('Category updated.')
    } catch (err) {
      toast.error(err.message || 'Unable to rename category.')
    } finally {
      setBusyName('')
    }
  }

  const remove = async (name) => {
    if (!window.confirm(`Remove “${name}” from Create Account and identity forms?`)) return
    setBusyName(name)
    try {
      const { categories: rows } = await api.adminDeleteBusinessCategory(name)
      setCategories(rows || [])
      if (editing === name) cancelEdit()
      toast.success(`Removed “${name}”.`)
    } catch (err) {
      toast.error(err.message || 'Unable to remove category.')
    } finally {
      setBusyName('')
    }
  }

  return (
    <DashboardLayout
      pageClassName="email-settings-page"
      activeNav="platform-settings-categories"
      variant="admin"
    >
      <div className="es-page">
        <div className="es-page-head">
          <div className="es-page-head-main">
            <Link className="es-back" to={ROUTES.PLATFORM_SETTINGS}>
              ← Platform settings
            </Link>
            <p className="eyebrow">Platform</p>
            <h1>Business categories</h1>
            <p className="page-desc">
              Categories shown on Create Account and Digital Identity. Add, rename, or remove
              options anytime — changes apply immediately.
            </p>
          </div>
        </div>

        <form className="bc-add" onSubmit={add}>
          <label>
            <span>New category</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Cafe"
              maxLength={80}
            />
          </label>
          <button type="submit" className="es-btn primary" disabled={adding}>
            {adding ? 'Adding…' : 'Add category'}
          </button>
        </form>

        {loading ? <p className="bc-empty">Loading categories…</p> : null}

        {!loading && !categories.length ? (
          <p className="bc-empty">No categories yet. Add one above.</p>
        ) : null}

        {!loading && categories.length ? (
          <ul className="bc-list">
            {categories.map((name) => (
              <li key={name} className="bc-row">
                {editing === name ? (
                  <form className="bc-edit" onSubmit={saveEdit}>
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      autoFocus
                      maxLength={80}
                    />
                    <button type="submit" className="es-btn primary" disabled={busyName === name}>
                      Save
                    </button>
                    <button type="button" className="es-btn ghost" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <strong>{name}</strong>
                    <div className="bc-actions">
                      <button type="button" className="es-btn ghost" onClick={() => startEdit(name)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="es-btn ghost danger"
                        disabled={busyName === name || categories.length <= 1}
                        onClick={() => remove(name)}
                      >
                        {busyName === name ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </DashboardLayout>
  )
}

export default BusinessCategoriesSettings
