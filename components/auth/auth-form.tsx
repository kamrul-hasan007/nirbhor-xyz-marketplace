'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, House, ShieldCheck } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

type AccountRole = 'customer' | 'provider'
type AuthMode = 'sign-in' | 'sign-up'

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter()
  const isSignUp = mode === 'sign-up'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<AccountRole>('customer')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = isSignUp
        ? await authClient.signUp.email({ email, password, name, role })
        : await authClient.signIn.email({ email, password })

      if (result.error) {
        setError('We could not complete that request. Check your details and try again.')
        return
      }

      router.push('/account')
      router.refresh()
    } catch {
      setError('We could not complete that request. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-page__ambient auth-page__ambient--one" />
      <div className="auth-page__ambient auth-page__ambient--two" />
      <Link className="auth-back-link" href="/" aria-label="Back to Nirbhor home">
        <ArrowLeft aria-hidden="true" /> Back to home
      </Link>
      <section className="auth-card" aria-labelledby="auth-title">
        <Link className="auth-brand" href="/" aria-label="Nirbhor home">
          <span className="auth-brand__mark"><House aria-hidden="true" /></span>
          <span>nirbhor<span>.xyz</span><small>HOME, MADE EASIER</small></span>
        </Link>
        <span className="auth-card__eyebrow"><ShieldCheck aria-hidden="true" /> {isSignUp ? 'A little more ease starts here' : 'Welcome back to Nirbhor'}</span>
        <h1 id="auth-title">{isSignUp ? 'Create your account' : 'Good to see you again.'}</h1>
        <p className="auth-card__intro">{isSignUp ? 'Join a community making home care feel simpler.' : 'Sign in to continue to your Nirbhor account.'}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignUp && (
            <>
              <label className="auth-field">
                <span>Your name</span>
                <input name="name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required maxLength={80} placeholder="How should we call you?" />
              </label>
              <fieldset className="role-picker">
                <legend>I&apos;m joining as a</legend>
                <label className={role === 'customer' ? 'role-option role-option--selected' : 'role-option'}>
                  <input type="radio" name="role" value="customer" checked={role === 'customer'} onChange={() => setRole('customer')} />
                  <span className="role-option__copy"><strong>Customer</strong><small>Find trusted help for home</small></span>
                  <span className="role-option__radio" aria-hidden="true" />
                </label>
                <label className={role === 'provider' ? 'role-option role-option--selected' : 'role-option'}>
                  <input type="radio" name="role" value="provider" checked={role === 'provider'} onChange={() => setRole('provider')} />
                  <span className="role-option__copy"><strong>Service provider</strong><small>Offer services in your area</small></span>
                  <span className="role-option__radio" aria-hidden="true" />
                </label>
                <p className="role-picker__note">Admin accounts are provisioned separately for security.</p>
              </fieldset>
            </>
          )}
          <label className="auth-field">
            <span>Email address</span>
            <input name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required maxLength={254} placeholder="you@example.com" />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isSignUp ? 'new-password' : 'current-password'} required minLength={8} maxLength={128} placeholder={isSignUp ? 'At least 8 characters' : 'Enter your password'} />
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
            {!loading && <ArrowRight aria-hidden="true" />}
          </button>
        </form>
        <p className="auth-switch">
          {isSignUp ? 'Already have an account?' : 'New to Nirbhor?'}{' '}
          <Link href={isSignUp ? '/sign-in' : '/sign-up'}>{isSignUp ? 'Sign in' : 'Create an account'}</Link>
        </p>
        <p className="auth-card__footnote">Your account is protected with secure, encrypted sign-in.</p>
      </section>
    </main>
  )
}
