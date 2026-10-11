import { WorkspaceDashboard } from '@/components/auth/workspace-dashboard'
import { requireRole } from '@/lib/auth'
import { getAdminWorkspaceData } from '@/lib/workspace-data'

export default async function AdminPage() {
  const session = await requireRole('admin')
  const data = await getAdminWorkspaceData()

  return <WorkspaceDashboard role="admin" name={session.user.name} email={session.user.email} data={data} />
}
