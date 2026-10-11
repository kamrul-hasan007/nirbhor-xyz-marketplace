import { RoleDashboard } from '@/components/auth/role-dashboard'
import { requireRole } from '@/lib/auth'

export default async function AdminPage() {
  const session = await requireRole('admin')
  return <RoleDashboard role="admin" name={session.user.name} email={session.user.email} />
}
