import { useLocation } from 'react-router-dom'

const STEPS = [
  { path: '/restaurant-setup', label: 'Profile', description: 'Tell us about your place', icon: '/images/profile.png' },
  { path: '/domain', label: 'Domain', description: 'Pick your web address', icon: '/images/domain.png' },
  { path: '/brand', label: 'Brand', description: 'Logo, colors & theme', icon: '/images/brand.png' },
  { path: '/launch', label: 'Launch', description: 'QR & digital card', icon: '/images/qr.png' },
]

// The route is the source of truth: all earlier steps are complete.
function OnboardingProgress({ className, compact = false }) {
  const { pathname } = useLocation()
  const currentStep = STEPS.findIndex((step) => step.path === pathname)
  const activeIndex = currentStep === -1 ? 0 : currentStep
  const Description = compact ? 'small' : 'span'

  return (
    <nav className={className} aria-label="Onboarding progress">
      {STEPS.map((step, index) => {
        const state = index < activeIndex ? 'completed' : index === activeIndex ? 'active' : ''
        return (
          <div className={`step ${state}`.trim()} key={step.path}>
            <div className="step-icon">
              {state === 'completed' ? '✓' : <img src={step.icon} alt={step.label} />}
            </div>
            <div className="step-text">
              <strong>{step.label}</strong>
              <Description>{step.description}</Description>
            </div>
          </div>
        )
      })}
    </nav>
  )
}

export default OnboardingProgress
