import { WorkspaceDashboard } from '@/components/auth/workspace-dashboard'
import { requireRole } from '@/lib/auth'
import { getCustomerWorkspaceData } from '@/lib/workspace-data'

export default async function CustomerPage() {
  const session = await requireRole('customer')
  const data = await getCustomerWorkspaceData(session.user.id)

  return <WorkspaceDashboard role="customer" name={session.user.name} email={session.user.email} data={data} />
}
