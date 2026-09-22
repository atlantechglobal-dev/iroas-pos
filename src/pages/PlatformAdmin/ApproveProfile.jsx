import { useNavigate, useParams } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { TenantReviewDrawer } from '../../components/admin/TenantReviewDrawer.jsx'
import { ROUTES } from '../../constants/routes.js'
import './PlatformAdmin.css'
import './PlatformAdminExtra.css'

function ApproveProfile() {
  const { tenantId } = useParams()
  const navigate = useNavigate()

  const goBack = () => navigate(ROUTES.PLATFORM_APPROVE)

  return (
    <DashboardLayout
      pageClassName="platform-admin-page"
      activeNav="platform-approve"
      variant="admin"
      adminSubtitle="Approve profile"
    >
      <div className="page-header pa-approve-profile-header">
        <div>
          <div className="page-label">PLATFORM</div>
          <h1>Approve profile</h1>
          <p>
            After you publish, this page shows the live status and which admin approved it.
          </p>
        </div>
        <button type="button" className="pa-view-btn" onClick={goBack}>
          ← Back to Approve
        </button>
      </div>

      <TenantReviewDrawer
        tenantId={tenantId}
        variant="page"
        focusApprove
        onClose={goBack}
      />
    </DashboardLayout>
  )
}

export default ApproveProfile
