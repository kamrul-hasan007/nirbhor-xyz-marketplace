import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth/auth-form'
import { getSession } from '@/lib/auth'

export default async function SignUpPage() {
  const session = await getSession()
  if (session?.user) redirect('/account')

  return <AuthForm mode="sign-up" />
}
