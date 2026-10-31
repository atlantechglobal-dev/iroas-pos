import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'

export function ComingSoon({ eyebrow, title, description, pageClassName, activeNav }) {
  return (
    <DashboardLayout pageClassName={pageClassName} activeNav={activeNav}>
      <div className="page-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="page-desc">{description}</p>
        </div>
      </div>
      <section className="card" style={{ padding: 24 }}>
        <strong>Not available yet</strong>
        <p style={{ margin: '6px 0 0', color: '#8b8b8f' }}>This section will show your real data once it is connected.</p>
      </section>
    </DashboardLayout>
  )
}
