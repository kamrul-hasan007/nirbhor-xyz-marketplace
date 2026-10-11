import { redirect } from 'next/navigation'
import { getRoleHome, requireSession } from '@/lib/auth'

export default async function AccountPage() {
  const session = await requireSession()
  redirect(getRoleHome(session.user.role))
}
