import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CALLING_CODES,
  DEFAULT_COUNTRY_ISO,
  callingCodeFlagUrl,
} from '../constants/callingCodes.js'
import './CountryCodePicker.css'

function CountryFlag({ iso }) {
  const [failed, setFailed] = useState(false)
  const src = callingCodeFlagUrl(iso, 40)

  if (!src || failed) {
    return (
      <span className="ccp-flag-fallback" aria-hidden="true">
        {iso}
      </span>
    )
  }

  return (
    <img
      key={iso}
      className="ccp-flag-img"
      src={src}
      srcSet={`${callingCodeFlagUrl(iso, 80)} 2x`}
      alt=""
      width={22}
      height={16}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}

function filterCountries(query) {
  const q = query.trim().toLowerCase().replace(/^\+/, '')
  if (!q) return CALLING_CODES
  return CALLING_CODES.filter(
    (country) =>
      country.name.toLowerCase().includes(q) ||
      country.dial.includes(q) ||
      country.iso.toLowerCase().includes(q),
  )
}

export function CountryCodePicker({ value = DEFAULT_COUNTRY_ISO, onChange, error = false }) {
  const selected =
    CALLING_CODES.find((country) => country.iso === value) ||
    CALLING_CODES.find((country) => country.iso === DEFAULT_COUNTRY_ISO)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)
  const searchRef = useRef(null)
  const listRef = useRef(null)

  const matches = useMemo(() => filterCountries(query), [query])

  useEffect(() => {
    if (!open) return undefined

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    setQuery('')
    const id = requestAnimationFrame(() => searchRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  const pick = (iso) => {
    onChange?.(iso)
    setOpen(false)
  }

  return (
    <div className={`country-code-picker ${open ? 'is-open' : ''} ${error ? 'is-error' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="ccp-trigger"
        aria-label="Country calling code"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <CountryFlag iso={selected.iso} />
        <span className="ccp-dial">+{selected.dial}</span>
        <span className="ccp-chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className="ccp-panel" role="presentation">
          <div className="ccp-search">
            <span className="ccp-search-icon" aria-hidden="true">
              ⌕
            </span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search country or code"
              aria-label="Search country or calling code"
              autoComplete="off"
            />
          </div>

          <ul className="ccp-list" role="listbox" ref={listRef} aria-label="Country calling codes">
            {matches.length === 0 ? (
              <li className="ccp-empty">No countries match “{query.trim()}”.</li>
            ) : (
              matches.map((country) => {
                const active = country.iso === selected.iso
                return (
                  <li key={country.iso} role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`ccp-option ${active ? 'is-active' : ''}`}
                      onClick={() => pick(country.iso)}
                    >
                      <CountryFlag iso={country.iso} />
                      <span className="ccp-name">{country.name}</span>
                      <span className="ccp-code">+{country.dial}</span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
