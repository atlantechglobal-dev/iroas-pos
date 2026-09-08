import { useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { api } from '../../lib/api'
import './Reviews.css'

function Reviews() {
  const toast = useToast()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ author: '', rating: '5', body: '' })

  const load = async () => {
    setLoading(true)
    try {
      const { reviews: rows } = await api.getReviews()
      setReviews(rows || [])
    } catch (err) {
      toast.error(err.message || 'Unable to load reviews.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const published = reviews.filter((r) => r.status === 'published')
  const avg = useMemo(() => {
    if (!published.length) return 0
    return published.reduce((s, r) => s + r.rating, 0) / published.length
  }, [published])

  const breakdown = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    published.forEach((r) => {
      counts[r.rating] = (counts[r.rating] || 0) + 1
    })
    const total = published.length || 1
    return [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      pct: Math.round((counts[stars] / total) * 100),
    }))
  }, [published])

  const toggleStatus = async (review) => {
    const status = review.status === 'published' ? 'hidden' : 'published'
    try {
      const { review: updated } = await api.updateReview(review.id, { status })
      setReviews((prev) => prev.map((r) => (r.id === review.id ? updated : r)))
      toast.success(status === 'published' ? 'Review published on site.' : 'Review hidden from site.')
    } catch (err) {
      toast.error(err.message || 'Unable to update review.')
    }
  }

  const createReview = async (event) => {
    event.preventDefault()
    try {
      const { review } = await api.createReview({
        author: form.author,
        rating: Number(form.rating),
        body: form.body,
        status: 'published',
      })
      setReviews((prev) => [review, ...prev])
      setModalOpen(false)
      setForm({ author: '', rating: '5', body: '' })
      toast.success('Review added.')
    } catch (err) {
      toast.error(err.message || 'Unable to add review.')
    }
  }

  return (
    <DashboardLayout pageClassName="reviews-page" activeNav="reviews">
      <div className="page-head">
        <div>
          <p className="eyebrow">Reputation</p>
          <h1>Reviews</h1>
          <p className="page-desc">
            Published reviews appear on your guest website. Hide any you do not want public.
          </p>
        </div>
        <button type="button" className="btn-add-review" onClick={() => setModalOpen(true)}>
          + Add review
        </button>
      </div>

      <div className="review-grid">
        <section className="card rating-card">
          <span className="muted-note">Overall rating</span>
          <div className="rating-big">
            {published.length ? avg.toFixed(1) : '—'}
            <span>/ 5</span>
          </div>
          <div className="stars">{'★'.repeat(Math.round(avg) || 0)}</div>
          <span className="muted-note">
            From {published.length} published review{published.length === 1 ? '' : 's'}
          </span>

          <div className="breakdown">
            {breakdown.map((b) => (
              <div className="breakdown-row" key={b.stars}>
                <span>{b.stars}</span>
                <div className="breakdown-track">
                  <div className="breakdown-fill" style={{ width: `${b.pct}%` }} />
                </div>
                <span>{b.pct}%</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card reviews-card">
          <h2>All reviews</h2>
          <span className="muted-note">Toggle visibility for the guest site</span>

          <ul className="review-list">
            {loading ? <li className="muted-note">Loading…</li> : null}
            {!loading && reviews.length === 0 ? (
              <li className="muted-note">No reviews yet. Add one to show on the website.</li>
            ) : null}
            {reviews.map((r) => (
              <li key={r.id}>
                <div className="review-top">
                  <div>
                    <strong>{r.author}</strong>
                    <span className="review-meta"> · {r.status}</span>
                  </div>
                  <span className={`tone-pill ${r.rating >= 4 ? 'positive' : 'negative'}`}>
                    {r.rating >= 4 ? 'Positive' : 'Critical'}
                  </span>
                </div>
                <div className="review-stars">
                  {'★'.repeat(r.rating)}
                  {'☆'.repeat(5 - r.rating)}
                </div>
                <p>{r.body}</p>
                <button className="reply-btn" type="button" onClick={() => toggleStatus(r)}>
                  {r.status === 'published' ? 'Hide from site' : 'Publish on site'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {modalOpen ? (
        <div className="review-modal" role="dialog" aria-modal="true">
          <div className="review-modal-backdrop" onClick={() => setModalOpen(false)} />
          <form className="review-modal-card" onSubmit={createReview}>
            <h3>Add review</h3>
            <label>
              Guest name
              <input
                required
                value={form.author}
                onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
              />
            </label>
            <label>
              Rating
              <select
                value={form.rating}
                onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} stars
                  </option>
                ))}
              </select>
            </label>
            <label>
              Review
              <textarea
                required
                rows={4}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              />
            </label>
            <div className="review-modal-actions">
              <button type="button" className="reply-btn" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-add-review">
                Save review
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </DashboardLayout>
  )
}

export default Reviews
