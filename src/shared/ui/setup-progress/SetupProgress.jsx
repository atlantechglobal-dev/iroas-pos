import { useState } from 'react'
import { Link } from 'react-router-dom'
import './SetupProgress.css'

/** Setup checklist: owners get a link per step, admins (no `links`) just read the state. */
export function SetupProgress({ progress, links = false, hideDone = false, title = 'Setup progress' }) {
  const [showDone, setShowDone] = useState(false)
  if (!progress) return null
  const visible = hideDone && !showDone ? progress.steps.filter((s) => !s.done) : progress.steps
  const percent = Math.round((progress.done / progress.total) * 100)
  return (
    <section className="onboarding-progress" aria-label={title}>
      <header>
        <div>
          <strong>{title}</strong>
          <span>
            {progress.done} of {progress.total} steps done
          </span>
        </div>
        <div className="onboarding-progress-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${percent}%` }} />
        </div>
      </header>
      <ol>
        {visible.map((step) => (
          <li key={step.key} className={`${step.done ? 'is-done' : ''}${step.key === progress.nextStep ? ' is-next' : ''}`}>
            <span className="onboarding-progress-mark" aria-hidden="true">
              {step.done ? '✓' : ''}
            </span>
            <div>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </div>
            {links && !step.done && step.path ? (
              <Link className="onboarding-progress-go" to={step.path}>
                Open
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
      {hideDone && progress.done > 0 ? (
        <button type="button" className="onboarding-progress-toggle" onClick={() => setShowDone((v) => !v)}>
          {showDone ? 'Hide completed steps' : `Show completed steps (${progress.done})`}
        </button>
      ) : null}
    </section>
  )
}

export function OnboardingChip({ done, total }) {
  if (!total) return null
  return (
    <span className={`onboarding-chip${done === total ? ' is-complete' : ''}`} title={`${done} of ${total} setup steps done`}>
      {done}/{total}
    </span>
  )
}
