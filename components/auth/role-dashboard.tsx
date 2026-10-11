import Link from 'next/link'
import { ArrowRight, BadgeCheck, House, ShieldCheck, Sparkles, Wrench } from 'lucide-react'
import { AccountControls } from '@/components/auth/account-controls'
import type { AccountRole } from '@/lib/auth'

const roleCopy: Record<AccountRole, { eyebrow: string; title: string; description: string; actions: { label: string; href: string }[] }> = {
  customer: {
    eyebrow: 'YOUR HOME, A LITTLE EASIER',
    title: 'Welcome to your home hub.',
    description: 'Your Nirbhor account is ready. Browse trusted services and find the right help for your home.',
    actions: [{ label: 'Explore home services', href: '/#services' }],
  },
  provider: {
    eyebrow: 'YOUR PROVIDER SPACE',
    title: 'Make good work easier to find.',
    description: 'Your provider account is active. Keep your profile ready and stay close to new opportunities in your area.',
    actions: [{ label: 'Browse the marketplace', href: '/#services' }],
  },
  admin: {
    eyebrow: 'NIRBHOR OPERATIONS',
    title: 'Welcome to the admin space.',
    description: 'You are signed in with an administrator account. This area is only available to accounts provisioned by the platform team.',
    actions: [{ label: 'View the marketplace', href: '/' }],
  },
}

const roleIcons = {
  customer: House,
  provider: Wrench,
  admin: ShieldCheck,
}

export function RoleDashboard({ role, name, email }: { role: AccountRole; name: string; email: string }) {
  const content = roleCopy[role]
  const Icon = roleIcons[role]

  return (
    <main className="account-page">
      <header className="account-header">
        <Link className="auth-brand" href="/" aria-label="Nirbhor home">
          <span className="auth-brand__mark"><House aria-hidden="true" /></span>
          <span>nirbhor<span>.xyz</span><small>HOME, MADE EASIER</small></span>
        </Link>
        <AccountControls />
      </header>
      <section className="account-welcome">
        <div className="account-welcome__icon"><Icon aria-hidden="true" /></div>
        <span className="auth-card__eyebrow"><BadgeCheck aria-hidden="true" /> {content.eyebrow}</span>
        <h1>{content.title}</h1>
        <p className="account-welcome__description">{content.description}</p>
        <div className="account-profile">
          <span className="account-profile__avatar">{name.trim().slice(0, 1).toUpperCase() || 'N'}</span>
          <span><strong>{name}</strong><small>{email}</small></span>
          <span className="account-profile__role">{role === 'provider' ? 'Service provider' : role}</span>
        </div>
        <div className="account-next-step">
          <span className="account-next-step__icon"><Sparkles aria-hidden="true" /></span>
          <div><strong>{role === 'provider' ? 'Your provider profile starts here' : role === 'admin' ? 'Access is protected' : 'A good place to start'}</strong><p>{role === 'provider' ? 'Service listings and provider tools will appear here as your account is set up.' : role === 'admin' ? 'Only approved administrator accounts can open this space.' : 'Explore trusted local services, with clear prices and friendly professionals.'}</p></div>
        </div>
        {content.actions.map((action) => (
          <Link className="button account-welcome__action" href={action.href} key={action.href}>
            {action.label}<ArrowRight aria-hidden="true" />
          </Link>
        ))}
      </section>
    </main>
  )
}
