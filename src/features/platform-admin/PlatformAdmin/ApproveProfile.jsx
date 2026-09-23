import { useNavigate, useParams } from 'react-router-dom'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { TenantReviewDrawer } from '@/shared/ui/admin/TenantReviewDrawer'
import { ROUTES } from '@/shared/constants/routes'
import '@/features/platform-admin/PlatformAdmin/PlatformAdmin.css'
import '@/features/platform-admin/PlatformAdmin/PlatformAdminExtra.css'

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
