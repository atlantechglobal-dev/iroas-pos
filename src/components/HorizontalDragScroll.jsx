import { useCallback, useEffect, useRef } from 'react'
import './HorizontalDragScroll.css'

const INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"]'

/**
 * Horizontal overflow strip with mouse-drag + touch swipe.
 * Clicks on links/buttons/inputs are left alone.
 */
export function HorizontalDragScroll({ children, className = '', style }) {
  const ref = useRef(null)
  const state = useRef({
    active: false,
    moved: false,
    startX: 0,
    scrollLeft: 0,
    pointerId: null,
  })

  const onPointerDown = useCallback((event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (event.target.closest?.(INTERACTIVE)) return

    const el = ref.current
    if (!el) return

    state.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      scrollLeft: el.scrollLeft,
      pointerId: event.pointerId,
    }
    el.classList.add('is-dragging')
    try {
      el.setPointerCapture(event.pointerId)
    } catch {
      // ignore
    }
  }, [])

  const onPointerMove = useCallback((event) => {
    const s = state.current
    if (!s.active) return
    const el = ref.current
    if (!el) return

    const dx = event.clientX - s.startX
    if (Math.abs(dx) > 4) s.moved = true
    el.scrollLeft = s.scrollLeft - dx
  }, [])

  const endDrag = useCallback((event) => {
    const s = state.current
    if (!s.active) return
    const el = ref.current
    s.active = false
    if (el) {
      el.classList.remove('is-dragging')
      try {
        if (s.pointerId != null) el.releasePointerCapture(s.pointerId)
      } catch {
        // ignore
      }
    }
    // Suppress the click that follows a drag
    if (s.moved && event?.type === 'pointerup') {
      const suppress = (e) => {
        e.preventDefault()
        e.stopPropagation()
        el?.removeEventListener('click', suppress, true)
      }
      el?.addEventListener('click', suppress, true)
      setTimeout(() => el?.removeEventListener('click', suppress, true), 0)
    }
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
        el.scrollLeft += e.deltaY
        e.preventDefault()
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div
      ref={ref}
      className={`h-drag-scroll ${className}`.trim()}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={(e) => {
        if (state.current.active) endDrag(e)
      }}
    >
      {children}
    </div>
  )
}

export default HorizontalDragScroll
