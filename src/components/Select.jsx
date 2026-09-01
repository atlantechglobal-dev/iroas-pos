import { useState, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import './Select.css'

// A fully custom dropdown, since a native <select>'s open list cannot be
// styled or show icons/flags in any browser. options: [{ value, label, icon }]
// The panel renders through a portal into document.body so it can never be
// clipped by an ancestor's overflow:hidden (e.g. a pill-shaped input group).
const THEME_VARS = [
  '--green', '--green-dark', '--green-soft', '--green-text',
  '--border', '--bg', '--panel', '--white', '--ink', '--text', '--muted', '--muted-2',
]

function Select({ value, onChange, options, placeholder = 'Select…', searchable = false, className = '' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [rect, setRect] = useState(null)
  const [themeVars, setThemeVars] = useState(null)
  const triggerRef = useRef(null)

  useLayoutEffect(() => {
    if (open && triggerRef.current) {
      setRect(triggerRef.current.getBoundingClientRect())

      // The portal renders into document.body, which breaks normal CSS
      // custom-property inheritance from the themed page wrapper. Copy the
      // trigger's resolved values across so the panel still matches this
      // page's palette (including the per-restaurant accent color).
      const computed = getComputedStyle(triggerRef.current)
      const vars = {}
      THEME_VARS.forEach((name) => {
        const val = computed.getPropertyValue(name).trim()
        if (val) vars[name] = val
      })
      setThemeVars(vars)
    } else {
      setQuery('')
    }
  }, [open])

  const selected = options.find((o) => o.value === value)
  const filtered = searchable && query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  return (
    <div className={`custom-select ${className}`}>
      <button
        type="button"
        ref={triggerRef}
        className={`select-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="select-value">
          {selected ? (
            <>
              {selected.icon && <span className="select-icon">{selected.icon}</span>}
              {selected.label}
            </>
          ) : (
            <span className="select-placeholder">{placeholder}</span>
          )}
        </span>
        <svg className="select-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && rect && createPortal(
        <>
          <div className="select-overlay" onClick={() => setOpen(false)} />
          <div
            className="select-panel select-panel-portal"
            style={{
              position: 'fixed',
              top: rect.bottom + 6,
              left: rect.left,
              width: Math.max(rect.width, 200),
              ...themeVars,
            }}
          >
            {searchable && (
              <input
                type="text"
                className="select-search"
                placeholder="Search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            )}
            <div className="select-options">
              {filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`select-option ${o.value === value ? 'selected' : ''}`}
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                >
                  {o.icon && <span className="select-icon">{o.icon}</span>}
                  <span className="select-option-label">{o.label}</span>
                  {o.value === value && <span className="select-check">✓</span>}
                </button>
              ))}
              {filtered.length === 0 && <p className="select-empty">No matches.</p>}
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}

export default Select
