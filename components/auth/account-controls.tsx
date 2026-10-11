'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export function AccountControls() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    setIsSigningOut(true)
    try {
      const result = await authClient.signOut()
      if (!result.error) {
        router.push('/')
        router.refresh()
      }
    } finally {
      setIsSigningOut(false)
    }
  }

  if (isPending) {
    return <span className="account-controls__loading" aria-label="Checking account" />
  }

  if (!session?.user) {
    return (
      <div className="account-controls">
        <Link className="header-signin" href="/sign-in">Sign in</Link>
        <Link className="button button--small account-controls__signup" href="/sign-up">Join Nirbhor</Link>
      </div>
    )
  }

  return (
    <div className="account-controls">
      <Link className="header-signin" href="/account">My account</Link>
      <button className="account-controls__signout" type="button" onClick={handleSignOut} disabled={isSigningOut}>
        {isSigningOut ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  )
}
