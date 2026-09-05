import { useCallback, useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { useRestaurant } from '../../hooks/useRestaurant.js'
import { api } from '../../lib/api'
import { prepareImageDataUrl } from '../../utils/imageFile.js'
import { guestSiteUrl, restaurantPublicSlug } from '../../utils/guestLinks.js'
import './Menu.css'

const FILTERS = ['All', 'Veg', 'Non-veg', "Chef's special", 'Best seller', 'Live', 'Draft', 'Archived']
const TINTS = [
  { key: 'tint-green', label: 'Green' },
  { key: 'tint-blue', label: 'Blue' },
  { key: 'tint-peach', label: 'Peach' },
  { key: 'tint-mint', label: 'Mint' },
  { key: 'tint-lime', label: 'Lime' },
  { key: 'tint-gray', label: 'Gray' },
  { key: 'tint-rose', label: 'Rose' },
  { key: 'tint-violet', label: 'Violet' },
]

const emptyCategoryForm = () => ({
  name: '',
  status: 'live',
  tint: 'tint-green',
  imageDataUrl: '',
})

const emptyItemForm = (categoryId = '') => ({
  categoryId,
  name: '',
  description: '',
  price: '',
  veg: true,
  tag: '',
  prepMinutes: 15,
  stockStatus: 'in_stock',
  stockCount: '',
  status: 'live',
  imageDataUrl: '',
})

function formatPrice(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '₹0'
  return `₹${Math.round(n)}`
}

function stockLabel(item) {
  if (item.stockStatus === 'out') return 'Out of stock'
  if (item.stockStatus === 'low') {
    return item.stockCount != null ? `Low (${item.stockCount})` : 'Low stock'
  }
  return 'In stock'
}

function Menu() {
  const toast = useToast()
  const { user } = useAuth()
  const { restaurantName, displayRestaurant } = useRestaurant()

  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [menuOpenId, setMenuOpenId] = useState(null)
  const [itemMenuOpenId, setItemMenuOpenId] = useState(null)

  const [categoryModal, setCategoryModal] = useState(null)
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm())
  const [itemModal, setItemModal] = useState(null)
  const [itemForm, setItemForm] = useState(emptyItemForm())
  const [saving, setSaving] = useState(false)

  const [menuSlug, setMenuSlug] = useState(() =>
    restaurantPublicSlug(restaurantName || user?.name, 'your-restaurant'),
  )
  const previewUrl = guestSiteUrl(menuSlug, 'menu')

  const loadMenu = useCallback(async () => {
    setLoading(true)
    try {
      const [menuData, restaurantRes] = await Promise.all([
        api.getMenu(),
        api.getRestaurant().catch(() => null),
      ])
      setCategories(menuData.categories || [])
      setItems(menuData.items || [])
      if (restaurantRes?.restaurant) {
        setMenuSlug(restaurantPublicSlug(restaurantRes.restaurant, 'your-restaurant'))
      }
      setSelectedCategoryId((prev) => {
        if (prev && menuData.categories?.some((c) => c.id === prev && c.status !== 'archived')) {
          return prev
        }
        const firstLive = menuData.categories?.find((c) => c.status !== 'archived')
        return firstLive?.id ?? null
      })
    } catch (err) {
      toast.error(err.message || 'Unable to load menu.')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadMenu()
  }, [loadMenu])

  const visibleCategories = useMemo(
    () => categories.filter((c) => c.status !== 'archived'),
    [categories],
  )

  const selectedCategory = visibleCategories.find((c) => c.id === selectedCategoryId) || visibleCategories[0]

  const categoryItems = useMemo(() => {
    if (!selectedCategory) return []
    return items.filter(
      (item) => item.categoryId === selectedCategory.id && item.status !== 'archived',
    )
  }, [items, selectedCategory])

  const priceRangeLabel = useMemo(() => {
    if (!categoryItems.length) return 'No priced dishes yet'
    const prices = categoryItems.map((i) => Number(i.price) || 0)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    if (min === max) return formatPrice(min)
    return `${formatPrice(min)} – ${formatPrice(max)}`
  }, [categoryItems])

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (selectedCategory && item.categoryId !== selectedCategory.id) return false

      if (filter === 'Archived') {
        if (item.status !== 'archived') return false
      } else if (item.status === 'archived' && filter !== 'All') {
        return false
      } else if (filter === 'Live' && item.status !== 'live') return false
      else if (filter === 'Draft' && item.status !== 'draft') return false
      else if (filter === 'Veg' && !item.veg) return false
      else if (filter === 'Non-veg' && item.veg) return false
      else if (filter === "Chef's special" && item.tag !== 'Chef') return false
      else if (filter === 'Best seller' && item.tag !== 'Best') return false

      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.tag || '').toLowerCase().includes(q)
      )
    })
  }, [items, selectedCategory, filter, query])

  const openNewCategory = () => {
    setCategoryForm(emptyCategoryForm())
    setCategoryModal({ mode: 'create' })
  }

  const openEditCategory = (cat) => {
    setMenuOpenId(null)
    setCategoryForm({
      name: cat.name,
      status: cat.status,
      tint: cat.tint || 'tint-green',
      imageDataUrl: cat.imageDataUrl || '',
    })
    setCategoryModal({ mode: 'edit', id: cat.id })
  }

  const openNewItem = () => {
    const catId = selectedCategory?.id || visibleCategories[0]?.id || ''
    if (!catId) {
      toast.info('Add a category first.')
      return
    }
    setItemForm(emptyItemForm(catId))
    setItemModal({ mode: 'create' })
  }

  const openEditItem = (item) => {
    setItemMenuOpenId(null)
    setItemForm({
      categoryId: item.categoryId,
      name: item.name,
      description: item.description || '',
      price: String(item.price ?? ''),
      veg: item.veg,
      tag: item.tag || '',
      prepMinutes: item.prepMinutes ?? 15,
      stockStatus: item.stockStatus || 'in_stock',
      stockCount: item.stockCount == null ? '' : String(item.stockCount),
      status: item.status,
      imageDataUrl: item.imageDataUrl || '',
    })
    setItemModal({ mode: 'edit', id: item.id })
  }

  const onCategoryImage = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const result = await prepareImageDataUrl(file)
    if (result.error) {
      toast.error(result.error)
      return
    }
    setCategoryForm((prev) => ({ ...prev, imageDataUrl: result.dataUrl }))
  }

  const onItemImage = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const result = await prepareImageDataUrl(file)
    if (result.error) {
      toast.error(result.error)
      return
    }
    setItemForm((prev) => ({ ...prev, imageDataUrl: result.dataUrl }))
  }

  const saveCategory = async (event) => {
    event.preventDefault()
    if (!categoryForm.name.trim()) {
      toast.error('Category name is required.')
      return
    }
    setSaving(true)
    try {
      if (categoryModal.mode === 'create') {
        await api.createMenuCategory(categoryForm)
        toast.success('Category created.')
      } else {
        await api.updateMenuCategory(categoryModal.id, categoryForm)
        toast.success('Category updated.')
      }
      setCategoryModal(null)
      await loadMenu()
    } catch (err) {
      toast.error(err.message || 'Unable to save category.')
    } finally {
      setSaving(false)
    }
  }

  const saveItem = async (event) => {
    event.preventDefault()
    if (!itemForm.name.trim()) {
      toast.error('Item name is required.')
      return
    }
    if (!itemForm.categoryId) {
      toast.error('Choose a category.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...itemForm,
        price: Number(itemForm.price) || 0,
        prepMinutes: Number(itemForm.prepMinutes) || 15,
        stockCount:
          itemForm.stockCount === '' || itemForm.stockCount == null
            ? null
            : Number(itemForm.stockCount),
      }
      if (itemModal.mode === 'create') {
        await api.createMenuItem(payload)
        toast.success('Item added.')
      } else {
        await api.updateMenuItem(itemModal.id, payload)
        toast.success('Item updated.')
      }
      setItemModal(null)
      await loadMenu()
    } catch (err) {
      toast.error(err.message || 'Unable to save item.')
    } finally {
      setSaving(false)
    }
  }

  const duplicateCategory = async (cat) => {
    setMenuOpenId(null)
    try {
      await api.duplicateMenuCategory(cat.id)
      toast.success('Category duplicated as draft.')
      await loadMenu()
    } catch (err) {
      toast.error(err.message || 'Unable to duplicate.')
    }
  }

  const setCategoryStatus = async (cat, status) => {
    setMenuOpenId(null)
    try {
      await api.updateMenuCategory(cat.id, { status })
      toast.success(status === 'live' ? 'Category is live on the website.' : `Category ${status}.`)
      await loadMenu()
    } catch (err) {
      toast.error(err.message || 'Unable to update category.')
    }
  }

  const archiveCategory = async (cat) => {
    setMenuOpenId(null)
    const ok = window.confirm(
      `Archive “${cat.name}”? Its dishes will be hidden from the guest menu.`,
    )
    if (!ok) return
    try {
      await api.deleteMenuCategory(cat.id)
      toast.success('Category archived.')
      await loadMenu()
    } catch (err) {
      toast.error(err.message || 'Unable to archive category.')
    }
  }

  const deleteCategory = async (cat) => {
    setMenuOpenId(null)
    const ok = window.confirm(
      `Permanently delete “${cat.name}” and all its dishes? This cannot be undone.`,
    )
    if (!ok) return
    try {
      await api.deleteMenuCategory(cat.id, { hard: true })
      if (selectedCategoryId === cat.id) setSelectedCategoryId(null)
      toast.success('Category deleted.')
      await loadMenu()
    } catch (err) {
      toast.error(err.message || 'Unable to delete category.')
    }
  }

  const setItemStatus = async (item, status) => {
    setItemMenuOpenId(null)
    try {
      await api.updateMenuItem(item.id, { status })
      toast.success(status === 'live' ? 'Item is live on the menu.' : `Item ${status}.`)
      await loadMenu()
    } catch (err) {
      toast.error(err.message || 'Unable to update item.')
    }
  }

  const archiveItem = async (item) => {
    setItemMenuOpenId(null)
    const ok = window.confirm(`Archive “${item.name}”? It will be removed from the live menu.`)
    if (!ok) return
    try {
      await api.deleteMenuItem(item.id)
      toast.success('Item archived.')
      await loadMenu()
    } catch (err) {
      toast.error(err.message || 'Unable to archive item.')
    }
  }

  const deleteItem = async (item) => {
    setItemMenuOpenId(null)
    const ok = window.confirm(`Permanently delete “${item.name}”? This cannot be undone.`)
    if (!ok) return
    try {
      await api.deleteMenuItem(item.id, { hard: true })
      toast.success('Item deleted.')
      await loadMenu()
    } catch (err) {
      toast.error(err.message || 'Unable to delete item.')
    }
  }

  return (
    <DashboardLayout pageClassName="menu-page" activeNav="menu">
      <div className="page-head">
        <div>
          <p className="eyebrow">Menu management</p>
          <h1>Menu</h1>
          <p className="page-desc">
            Organize categories, items and photos for {displayRestaurant}. Live items publish to your
            guest menu website instantly.
          </p>
        </div>
        <div className="head-actions">
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
          >
            👁 Preview
          </button>
          <button className="btn btn-primary" type="button" onClick={openNewItem}>
            + New item
          </button>
        </div>
      </div>

      <div className="toolbar card">
        <div className="search-bar toolbar-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
            <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            placeholder="Search items, descriptions, tags..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search menu items"
          />
        </div>
        <div className="filter-chips">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`chip ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="section-head">
        <h2>Categories</h2>
        <button className="link-btn" type="button" onClick={openNewCategory}>
          + New category
        </button>
      </div>

      {loading ? (
        <p className="empty-note">Loading menu…</p>
      ) : (
        <div className="category-grid">
          {visibleCategories.map((cat) => (
            <div
              className={`category-card ${selectedCategory?.id === cat.id ? 'selected' : ''} ${
                menuOpenId === cat.id ? 'menu-open' : ''
              }`}
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setSelectedCategoryId(cat.id)
              }}
              role="button"
              tabIndex={0}
            >
              <div
                className={`category-image ${cat.tint || 'tint-green'}`}
                style={
                  cat.imageDataUrl
                    ? { backgroundImage: `url(${cat.imageDataUrl})`, backgroundSize: 'cover' }
                    : undefined
                }
              >
                <span className={`status-pill ${cat.status === 'live' ? 'live' : 'draft'}`}>
                  {cat.status === 'live' ? 'Live' : cat.status === 'draft' ? 'Draft' : cat.status}
                </span>
              </div>
              <div className="category-body">
                <strong>{cat.name}</strong>
                <small>{cat.itemCount} items</small>
                <div className="category-actions" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => openEditCategory(cat)}>
                    Edit
                  </button>
                  <button type="button" className="icon-only" onClick={() => duplicateCategory(cat)}>
                    ⧉
                  </button>
                  <div className="more-wrap">
                    <button
                      type="button"
                      className="icon-only"
                      onClick={() => setMenuOpenId(menuOpenId === cat.id ? null : cat.id)}
                    >
                      ⋯
                    </button>
                    {menuOpenId === cat.id ? (
                      <div className="more-menu">
                        <button type="button" onClick={() => setCategoryStatus(cat, 'live')}>
                          Set live
                        </button>
                        <button type="button" onClick={() => setCategoryStatus(cat, 'draft')}>
                          Set draft
                        </button>
                        <button type="button" onClick={() => archiveCategory(cat)}>
                          Archive
                        </button>
                        <button type="button" className="danger" onClick={() => deleteCategory(cat)}>
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {visibleCategories.length === 0 ? (
            <p className="empty-note">No categories yet. Add your first category.</p>
          ) : null}
        </div>
      )}

      {selectedCategory && !loading ? (
        <section className="category-detail card" aria-label={`${selectedCategory.name} details`}>
          <div
            className={`category-detail-photo ${selectedCategory.tint || 'tint-green'}`}
            style={
              selectedCategory.imageDataUrl
                ? {
                    backgroundImage: `url(${selectedCategory.imageDataUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : undefined
            }
          >
            <span className={`status-pill ${selectedCategory.status === 'live' ? 'live' : 'draft'}`}>
              {selectedCategory.status === 'live'
                ? 'Live'
                : selectedCategory.status === 'draft'
                  ? 'Draft'
                  : selectedCategory.status}
            </span>
          </div>

          <div className="category-detail-body">
            <div className="category-detail-copy">
              <p className="category-detail-label">Selected category</p>
              <h2>{selectedCategory.name}</h2>
              <p className="category-detail-meta">
                <span>{categoryItems.length} dishes</span>
                <span className="dot">·</span>
                <span className="price-range">{priceRangeLabel}</span>
              </p>
              <p className="category-detail-hint">
                Click a category above to switch. Edit details, set live/draft, archive, or delete from
                here.
              </p>
            </div>

            <div className="category-detail-actions">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => openEditCategory(selectedCategory)}
              >
                Edit category
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={openNewItem}>
                + Add dish
              </button>
              {selectedCategory.status !== 'live' ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setCategoryStatus(selectedCategory, 'live')}
                >
                  Set live
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setCategoryStatus(selectedCategory, 'draft')}
                >
                  Set draft
                </button>
              )}
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => archiveCategory(selectedCategory)}
              >
                Archive
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm btn-danger"
                onClick={() => deleteCategory(selectedCategory)}
              >
                Delete
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => duplicateCategory(selectedCategory)}
              >
                Duplicate
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <div className="section-head">
        <h2>
          {selectedCategory
            ? `Dishes in ${selectedCategory.name} · ${filteredItems.length}`
            : 'Items'}
        </h2>
        <button className="link-btn" type="button" onClick={openNewItem}>
          + Add dish
        </button>
      </div>

      <div className="item-grid">
        {filteredItems.map((item) => (
          <div
            className={`item-card ${itemMenuOpenId === item.id ? 'menu-open' : ''}`}
            key={item.id}
          >
            <div
              className="item-image"
              style={
                item.imageDataUrl
                  ? {
                      backgroundImage: `url(${item.imageDataUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }
                  : undefined
              }
            >
              <span className={`veg-dot ${item.veg ? 'veg' : 'nonveg'}`}>
                {item.veg ? '🟢' : '🔴'}
              </span>
              {item.tag ? (
                <span className="item-tag">
                  {item.tag === 'Chef' ? '🔥' : item.tag === 'Best' ? '⭐' : '•'} {item.tag}
                </span>
              ) : null}
              <span className={`item-status ${item.status}`}>{item.status}</span>
            </div>
            <div className="item-body">
              <div className="item-top">
                <strong>{item.name}</strong>
                <span className="item-price">{formatPrice(item.price)}</span>
              </div>
              <p>{item.description || 'No description'}</p>
              <div className="item-foot">
                <span>⏱ {item.prepMinutes || 15} min</span>
                <span
                  className={`stock-pill ${
                    item.stockStatus === 'low' || item.stockStatus === 'out' ? 'low' : 'in'
                  }`}
                >
                  {stockLabel(item)}
                </span>
              </div>
              <div className="item-actions">
                <button type="button" onClick={() => openEditItem(item)}>
                  Edit
                </button>
                <button type="button" onClick={() => setItemStatus(item, 'live')}>
                  Live
                </button>
                <div className="more-wrap">
                  <button
                    type="button"
                    className="icon-only"
                    onClick={() => setItemMenuOpenId(itemMenuOpenId === item.id ? null : item.id)}
                    aria-label="More item actions"
                  >
                    ⋯
                  </button>
                  {itemMenuOpenId === item.id ? (
                    <div className="more-menu">
                      <button type="button" onClick={() => setItemStatus(item, 'draft')}>
                        Set draft
                      </button>
                      <button type="button" onClick={() => archiveItem(item)}>
                        Archive
                      </button>
                      <button type="button" className="danger" onClick={() => deleteItem(item)}>
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ))}
        {!loading && filteredItems.length === 0 ? (
          <div className="empty-category-state">
            <p className="empty-note">
              {selectedCategory
                ? `No dishes in ${selectedCategory.name} yet — add a dish or clear filters.`
                : 'No items match your search or filters.'}
            </p>
            {selectedCategory ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={openNewItem}>
                + Add dish
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {categoryModal ? (
        <div className="menu-modal" role="dialog" aria-modal="true">
          <div className="menu-modal-backdrop" onClick={() => setCategoryModal(null)} />
          <form className="menu-modal-card" onSubmit={saveCategory}>
            <h3>{categoryModal.mode === 'create' ? 'New category' : 'Edit category'}</h3>
            <label>
              Name
              <input
                required
                value={categoryForm.name}
                onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))}
              />
            </label>
            <label>
              Status
              <select
                value={categoryForm.status}
                onChange={(e) => setCategoryForm((p) => ({ ...p, status: e.target.value }))}
              >
                <option value="live">Live</option>
                <option value="draft">Draft</option>
              </select>
            </label>
            <label>
              Color tint
              <select
                value={categoryForm.tint}
                onChange={(e) => setCategoryForm((p) => ({ ...p, tint: e.target.value }))}
              >
                {TINTS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="file-label">
              Category photo
              <input type="file" accept="image/*" onChange={onCategoryImage} />
            </label>
            {categoryForm.imageDataUrl ? (
              <img className="form-preview" src={categoryForm.imageDataUrl} alt="" />
            ) : null}
            <div className="menu-modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setCategoryModal(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save category'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {itemModal ? (
        <div className="menu-modal" role="dialog" aria-modal="true">
          <div className="menu-modal-backdrop" onClick={() => setItemModal(null)} />
          <form className="menu-modal-card" onSubmit={saveItem}>
            <h3>{itemModal.mode === 'create' ? 'New item' : 'Edit item'}</h3>
            <label>
              Category
              <select
                required
                value={itemForm.categoryId}
                onChange={(e) =>
                  setItemForm((p) => ({ ...p, categoryId: Number(e.target.value) }))
                }
              >
                {visibleCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Name
              <input
                required
                value={itemForm.name}
                onChange={(e) => setItemForm((p) => ({ ...p, name: e.target.value }))}
              />
            </label>
            <label>
              Description
              <textarea
                rows={3}
                value={itemForm.description}
                onChange={(e) => setItemForm((p) => ({ ...p, description: e.target.value }))}
              />
            </label>
            <div className="form-row">
              <label>
                Price (₹)
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={itemForm.price}
                  onChange={(e) => setItemForm((p) => ({ ...p, price: e.target.value }))}
                />
              </label>
              <label>
                Prep (min)
                <input
                  type="number"
                  min="1"
                  value={itemForm.prepMinutes}
                  onChange={(e) => setItemForm((p) => ({ ...p, prepMinutes: e.target.value }))}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Type
                <select
                  value={itemForm.veg ? 'veg' : 'nonveg'}
                  onChange={(e) => setItemForm((p) => ({ ...p, veg: e.target.value === 'veg' }))}
                >
                  <option value="veg">Veg</option>
                  <option value="nonveg">Non-veg</option>
                </select>
              </label>
              <label>
                Tag
                <select
                  value={itemForm.tag}
                  onChange={(e) => setItemForm((p) => ({ ...p, tag: e.target.value }))}
                >
                  <option value="">None</option>
                  <option value="Chef">Chef&apos;s special</option>
                  <option value="Best">Best seller</option>
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Stock
                <select
                  value={itemForm.stockStatus}
                  onChange={(e) => setItemForm((p) => ({ ...p, stockStatus: e.target.value }))}
                >
                  <option value="in_stock">In stock</option>
                  <option value="low">Low</option>
                  <option value="out">Out</option>
                </select>
              </label>
              <label>
                Stock count
                <input
                  type="number"
                  min="0"
                  value={itemForm.stockCount}
                  onChange={(e) => setItemForm((p) => ({ ...p, stockCount: e.target.value }))}
                />
              </label>
            </div>
            <label>
              Status
              <select
                value={itemForm.status}
                onChange={(e) => setItemForm((p) => ({ ...p, status: e.target.value }))}
              >
                <option value="live">Live on website</option>
                <option value="draft">Draft</option>
              </select>
            </label>
            <label className="file-label">
              Dish photo
              <input type="file" accept="image/*" onChange={onItemImage} />
            </label>
            {itemForm.imageDataUrl ? (
              <img className="form-preview" src={itemForm.imageDataUrl} alt="" />
            ) : null}
            <div className="menu-modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setItemModal(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save item'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </DashboardLayout>
  )
}

export default Menu
