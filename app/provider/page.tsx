import { WorkspaceDashboard } from '@/components/auth/workspace-dashboard'
import { requireRole } from '@/lib/auth'
import { getProviderWorkspaceData } from '@/lib/workspace-data'

export default async function ProviderPage() {
  const session = await requireRole('provider')
  const data = await getProviderWorkspaceData(session.user.id)

  return <WorkspaceDashboard role="provider" name={session.user.name} email={session.user.email} data={data} />
}
