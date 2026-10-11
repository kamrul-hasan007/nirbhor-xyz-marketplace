import { RoleDashboard } from '@/components/auth/role-dashboard'
import { requireRole } from '@/lib/auth'

export default async function ProviderPage() {
  const session = await requireRole('provider')
  return <RoleDashboard role="provider" name={session.user.name} email={session.user.email} />
}
