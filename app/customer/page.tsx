import { RoleDashboard } from '@/components/auth/role-dashboard'
import { requireRole } from '@/lib/auth'

export default async function CustomerPage() {
  const session = await requireRole('customer')
  return <RoleDashboard role="customer" name={session.user.name} email={session.user.email} />
}
