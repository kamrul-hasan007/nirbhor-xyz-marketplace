'use client'

import { useState, useTransition, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, BadgeCheck, House, ShieldCheck, Wrench } from 'lucide-react'
import { AccountControls } from '@/components/auth/account-controls'
import {
  acceptMarketplaceBooking,
  assignMarketplaceBooking,
  cancelCustomerBooking,
  createCustomerBooking,
  moderateMarketplaceReview,
  processMarketplacePayout,
  requestProviderPayout,
  rescheduleCustomerBooking,
  resolveMarketplaceComplaint,
  reviewProviderDocument,
  reviewProviderProfile,
  saveMarketplaceSettings,
  saveProviderProfile,
  setProviderAvailability,
  startCheckoutForBooking,
  submitCustomerComplaint,
  submitCustomerReview,
  updateMarketplacePackagePrice,
  updateProviderBooking,
} from '@/app/actions/marketplace'
import type {
  AdminWorkspaceData,
  CustomerWorkspaceData,
  ProviderWorkspaceData,
} from '@/lib/workspace-data'

type OperationResult = { ok: boolean; message?: string; gatewayUrl?: string | null; feeBdt?: number }
type WorkspaceProps =
  | { role: 'customer'; name: string; email: string; data: CustomerWorkspaceData }
  | { role: 'provider'; name: string; email: string; data: ProviderWorkspaceData }
  | { role: 'admin'; name: string; email: string; data: AdminWorkspaceData }

const taka = (amount: number) => `৳${new Intl.NumberFormat('en-BD').format(amount)}`
const dateTime = (date: Date | string) => new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
const statusLabel = (status: string) => status.replaceAll('_', ' ')

function Panel({ title, description, children, className = '' }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return <section className={`workspace-panel ${className}`}><header className="workspace-panel__header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div></header>{children}</section>
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="workspace-empty">{children}</p>
}

export function WorkspaceDashboard(props: WorkspaceProps) {
  const router = useRouter()
  const [notice, setNotice] = useState('')
  const [isPending, startTransition] = useTransition()
  const [cart, setCart] = useState<{ packageId: string; quantity: number }[]>([])

  function perform(operation: () => Promise<OperationResult>) {
    startTransition(async () => {
      setNotice('')
      try {
        const result = await operation()
        setNotice(result.message ?? (result.feeBdt !== undefined ? `Booking cancelled. Cancellation fee: ${taka(result.feeBdt)}.` : result.ok ? 'Saved.' : 'The change could not be saved.'))
        if (result.ok) router.refresh()
        if (result.gatewayUrl) {
          if (window.self !== window.top) window.open(result.gatewayUrl, '_blank', 'noopener,noreferrer')
          else window.location.assign(result.gatewayUrl)
        }
      } catch {
        setNotice('We could not complete that request. Please try again.')
      }
    })
  }

  function submitForm(event: FormEvent<HTMLFormElement>, action: (form: FormData) => Promise<OperationResult>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    perform(() => action(form))
  }

  const Icon = props.role === 'customer' ? House : props.role === 'provider' ? Wrench : ShieldCheck
  const eyebrow = props.role === 'customer' ? 'YOUR HOME, A LITTLE EASIER' : props.role === 'provider' ? 'YOUR PROVIDER SPACE' : 'NIRBHOR OPERATIONS'
  const heading = props.role === 'customer' ? `Welcome, ${props.name.split(' ')[0] || 'home'}.` : props.role === 'provider' ? 'Your work, all in one place.' : 'The marketplace, at a glance.'
  const description = props.role === 'customer' ? 'Book trusted help, follow every visit, and keep your home details close.' : props.role === 'provider' ? 'Keep your profile current, manage jobs, and follow your earnings.' : 'Review bookings, approve trusted providers, and keep every service price official.'

  return (
    <main className="account-page workspace-page">
      <header className="account-header">
        <Link className="auth-brand" href="/" aria-label="Nirbhor home"><span className="auth-brand__mark"><House aria-hidden="true" /></span><span>nirbhor<span>.xyz</span><small>HOME, MADE EASIER</small></span></Link>
        <AccountControls />
      </header>
      <section className="workspace-intro">
        <div className="workspace-intro__icon"><Icon aria-hidden="true" /></div>
        <div><span className="auth-card__eyebrow"><BadgeCheck aria-hidden="true" /> {eyebrow}</span><h1>{heading}</h1><p>{description}</p></div>
        <div className="workspace-intro__user"><strong>{props.name}</strong><span>{props.email}</span><span className="account-profile__role">{props.role}</span></div>
      </section>
      {notice && <p className="workspace-notice" role="status">{notice}</p>}
      {isPending && <p className="workspace-pending" role="status">Saving your changes…</p>}
      {props.role === 'customer' && <CustomerWorkspace data={props.data} cart={cart} setCart={setCart} perform={perform} submitForm={submitForm} />}
      {props.role === 'provider' && <ProviderWorkspace data={props.data} perform={perform} submitForm={submitForm} />}
      {props.role === 'admin' && <AdminWorkspace data={props.data} perform={perform} submitForm={submitForm} />}
    </main>
  )
}

function CustomerWorkspace({ data, cart, setCart, perform, submitForm }: {
  data: CustomerWorkspaceData
  cart: { packageId: string; quantity: number }[]
  setCart: (cart: { packageId: string; quantity: number }[]) => void
  perform: (operation: () => Promise<OperationResult>) => void
  submitForm: (event: FormEvent<HTMLFormElement>, action: (form: FormData) => Promise<OperationResult>) => void
}) {
  const [statusFilter, setStatusFilter] = useState('all')
  const packages = data.services.flatMap((service) => service.packages.map((servicePackage) => ({ ...servicePackage, serviceName: service.name, areaIds: service.areaIds })))
  const [selectedPackageId, setSelectedPackageId] = useState(packages[0]?.id ?? '')
  const visibleBookings = statusFilter === 'all' ? data.bookings : data.bookings.filter((booking) => booking.status === statusFilter)
  const cartTotal = cart.reduce((total, item) => total + (packages.find((servicePackage) => servicePackage.id === item.packageId)?.price ?? 0) * item.quantity, 0)

  function addCartItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const packageId = String(form.get('packageId') ?? '')
    const quantity = Math.max(1, Math.min(5, Number(form.get('quantity') ?? 1)))
    if (!packageId) return
    setCart([...cart.filter((item) => item.packageId !== packageId), { packageId, quantity }])
  }

  return <div className="workspace-grid">
    <Panel title="Book a home service" description="Add multiple admin-priced packages and confirm a single visit.">
      {!packages.length ? <EmptyState>There are no active packages available to book yet.</EmptyState> : <>
        <form className="workspace-form workspace-add-cart" onSubmit={addCartItem}>
          <label className="workspace-field"><span>Service package</span><select name="packageId" value={selectedPackageId} onChange={(event) => setSelectedPackageId(event.target.value)} required>{packages.map((item) => <option key={item.id} value={item.id}>{item.serviceName} · {item.name} · {taka(item.price)}</option>)}</select></label>
          <label className="workspace-field workspace-field--short"><span>Qty</span><input name="quantity" type="number" min="1" max="5" defaultValue="1" required /></label>
          <button className="button button--small" type="submit">Add package</button>
        </form>
        {cart.length > 0 && <ul className="workspace-cart">{cart.map((item) => {
          const servicePackage = packages.find((entry) => entry.id === item.packageId)
          return <li key={item.packageId}><span>{servicePackage?.serviceName} · {servicePackage?.name} × {item.quantity}</span><strong>{taka((servicePackage?.price ?? 0) * item.quantity)}</strong><button type="button" className="workspace-text-button" onClick={() => setCart(cart.filter((entry) => entry.packageId !== item.packageId))}>Remove</button></li>
        })}<li className="workspace-cart__total"><span>Admin-approved subtotal</span><strong>{taka(cartTotal)}</strong></li></ul>}
        <form className="workspace-form workspace-booking-form" onSubmit={(event) => {
          const form = new FormData(event.currentTarget)
          form.set('items', JSON.stringify(cart))
          submitForm(event, async () => {
            const result = await createCustomerBooking(form)
            if (result.ok) setCart([])
            return result
          })
        }}>
          <label className="workspace-field"><span>Neighbourhood</span><select name="areaId" required defaultValue={data.addresses[0]?.areaId ?? ''}><option value="" disabled>Choose your area</option>{data.areas.map((area) => <option key={area.id} value={area.id}>{area.cityName} · {area.name}</option>)}</select></label>
          <label className="workspace-field"><span>Service address</span><input name="serviceAddress" minLength={8} maxLength={300} required defaultValue={data.addresses[0]?.streetAddress ?? ''} placeholder="House, road and neighbourhood" /></label>
          <div className="workspace-form__row"><label className="workspace-field"><span>Service date &amp; time</span><input name="scheduledAt" type="datetime-local" min={new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)} required /></label><label className="workspace-field"><span>Phone for updates</span><input name="phone" type="tel" required minLength={7} maxLength={20} defaultValue={data.profile?.phone ?? ''} placeholder="+880…" /></label></div>
          <div className="workspace-form__row"><label className="workspace-field"><span>Payment</span><select name="paymentMethod" defaultValue="sslcommerz"><option value="sslcommerz">Online · card / MFS</option><option value="cash_on_completion">Cash after service (under ৳5,000)</option></select></label><label className="workspace-field"><span>Promo code</span><input name="promoCode" maxLength={32} placeholder="Optional" /></label></div>
          <label className="workspace-field"><span>Notes for your professional</span><textarea name="notes" rows={2} maxLength={500} placeholder="Anything helpful for the visit?" /></label>
          <input type="hidden" name="latitude" /><input type="hidden" name="longitude" />
          <button className="button account-welcome__action" type="submit" disabled={!cart.length}>Confirm booking · {taka(cartTotal)}<ArrowRight aria-hidden="true" /></button>
          <p className="workspace-hint">Orders of ৳5,000 or more require an admin-configured advance payment before confirmation.</p>
        </form>
      </>}
      {data.profile && <p className="workspace-referral">Your referral code <strong>{data.profile.referralCode}</strong> · service credit {taka(data.profile.creditBalanceBdt)}</p>}
    </Panel>

    <Panel title="Your service orders" description="Follow provider updates and manage each booking.">
      <label className="workspace-field workspace-filter"><span>Filter orders</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{[...new Set(data.bookings.map((booking) => booking.status))].map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
      {visibleBookings.length === 0 ? <EmptyState>Your bookings and service updates will appear here.</EmptyState> : <div className="workspace-stack">{visibleBookings.map((booking) => <article className="workspace-record" key={booking.id}>
        <div className="workspace-record__top"><div><span className={`workspace-status workspace-status--${booking.status}`}>{statusLabel(booking.status)}</span><h3>Order {booking.id.slice(0, 8).toUpperCase()}</h3></div><strong>{taka(booking.totalBdt)}</strong></div>
        <p className="workspace-record__meta">{dateTime(booking.scheduledAt)} · {booking.items.map((item) => `${item.serviceName} · ${item.packageName} × ${item.quantity}`).join(', ')}</p>
        <p className="workspace-record__meta">Paid {taka(booking.amountPaidBdt)} · {booking.serviceAddress}</p>
        {booking.events.length > 0 && <ol className="workspace-timeline">{booking.events.map((event) => <li key={event.id}><strong>{statusLabel(event.status)}</strong><span>{event.note || dateTime(event.createdAt)}</span></li>)}</ol>}
        <div className="workspace-actions">
          {booking.status === 'pending_payment' && <button type="button" className="button button--small" onClick={() => perform(() => startCheckoutForBooking(booking.id))}>Pay advance</button>}
          {['requested', 'provider_accepted', 'assigned'].includes(booking.status) && <button type="button" className="workspace-text-button" onClick={() => {
            const next = window.prompt('Choose a new date and time (YYYY-MM-DDTHH:mm)')
            if (next) perform(() => rescheduleCustomerBooking(booking.id, next))
          }}>Reschedule</button>}
          {['requested', 'provider_accepted', 'assigned', 'pending_payment'].includes(booking.status) && <button type="button" className="workspace-text-button workspace-text-button--danger" onClick={() => {
            if (window.confirm('Cancel this booking? The cancellation policy may apply a fee within the free-cancellation window.')) perform(() => cancelCustomerBooking(booking.id))
          }}>Cancel booking</button>}
          {booking.status === 'completed' && <button type="button" className="workspace-text-button" onClick={() => {
            const rating = Number(window.prompt('Rate your service from 1 to 5'))
            if (rating >= 1 && rating <= 5) perform(() => submitCustomerReview(booking.id, rating, window.prompt('Share a short review (optional)') ?? ''))
          }}>Rate &amp; review</button>}
          {booking.status === 'completed' && <button type="button" className="workspace-text-button" onClick={() => window.print()}>Print receipt</button>}
          {booking.status === 'completed' && <button type="button" className="workspace-text-button workspace-text-button--danger" onClick={() => {
            const details = window.prompt('Describe the issue (at least 10 characters)') ?? ''
            if (details.trim().length < 10) return
            const refundInput = window.prompt('Refund amount in BDT (enter 0 if you are not requesting a refund)', '0')
            if (refundInput === null) return
            const refundRequestedBdt = Number(refundInput)
            if (Number.isSafeInteger(refundRequestedBdt) && refundRequestedBdt >= 0) perform(() => submitCustomerComplaint(booking.id, 'service_quality', details, refundRequestedBdt))
            else window.alert('Enter a whole-number refund amount in BDT.')
          }}>Get support / request refund</button>}
        </div>
      </article>)}</div>}
      {data.complaints.length > 0 && <div className="workspace-subsection"><h3>Support requests</h3>{data.complaints.map((complaint) => <p key={complaint.id}>#{complaint.id.slice(0, 8)} · {complaint.category} · {statusLabel(complaint.status)}{complaint.resolutionNote ? ` · ${complaint.resolutionNote}` : ''}</p>)}</div>}
    </Panel>

    <Panel title="Saved addresses" description="Your latest booking address is available for your next visit.">
      {data.addresses.length ? <ul className="workspace-list">{data.addresses.map((address) => <li key={address.id}><strong>{address.label}{address.isDefault ? ' · Default' : ''}</strong><span>{address.streetAddress}</span></li>)}</ul> : <EmptyState>Addresses are saved securely when you make your first booking.</EmptyState>}
      {data.payments.length > 0 && <div className="workspace-subsection"><h3>Payment history</h3>{data.payments.slice(0, 6).map((payment) => <p key={payment.id}>{taka(payment.amountBdt)} · {statusLabel(payment.status)} · {dateTime(payment.createdAt)}</p>)}</div>}
    </Panel>
  </div>
}

function ProviderWorkspace({ data, perform, submitForm }: {
  data: ProviderWorkspaceData
  perform: (operation: () => Promise<OperationResult>) => void
  submitForm: (event: FormEvent<HTMLFormElement>, action: (form: FormData) => Promise<OperationResult>) => void
}) {
  const due = data.ledger.filter((entry) => entry.settlementStatus === 'pending').reduce((sum, entry) => sum + entry.providerDueBdt, 0)
  const busy = data.profile?.verificationStatus !== 'approved'

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const response = await fetch('/api/provider/documents', { method: 'POST', body: new FormData(event.currentTarget) })
    const result = await response.json() as { error?: string }
    if (!response.ok) throw new Error(result.error ?? 'Document upload failed.')
    window.location.reload()
  }

  return <div className="workspace-grid">
    <Panel title="Provider profile" description="Your proposed commission is reviewed by Nirbhor operations.">
      <form className="workspace-form" onSubmit={(event) => submitForm(event, saveProviderProfile)}>
        <label className="workspace-field"><span>Business name</span><input name="businessName" required maxLength={100} defaultValue={data.profile?.businessName ?? ''} /></label>
        <div className="workspace-form__row"><label className="workspace-field"><span>Phone</span><input name="phone" type="tel" required maxLength={20} defaultValue={data.profile?.phone ?? ''} placeholder="+880…" /></label><label className="workspace-field"><span>Proposed platform commission (%)</span><input name="proposedCommissionPercent" type="number" min="0" max="60" step="0.1" required defaultValue={data.profile?.proposedCommissionPercent ?? '20'} /></label></div>
        <label className="workspace-field"><span>About your services</span><textarea name="bio" rows={3} maxLength={1000} defaultValue={data.profile?.bio ?? ''} /></label>
        <fieldset className="workspace-area-picker"><legend>Service neighbourhoods</legend><div className="workspace-check-grid">{data.areas.map((area) => <label key={area.id}><input type="checkbox" name="serviceAreaIds" value={area.id} defaultChecked={data.selectedAreaIds.includes(area.id)} />{area.cityName} · {area.name}</label>)}</div></fieldset>
        <button className="button button--small" type="submit">Save provider profile</button>
      </form>
      <div className="workspace-record__top workspace-verification"><span className={`workspace-status workspace-status--${data.profile?.verificationStatus ?? 'pending'}`}>{statusLabel(data.profile?.verificationStatus ?? 'profile needed')}</span><span>Approved commission: {data.profile?.approvedCommissionPercent ?? '—'}%</span></div>
      {data.profile?.verificationStatus === 'approved' && <button className="workspace-text-button" type="button" onClick={() => perform(() => setProviderAvailability(!data.profile!.availability))}>{data.profile.availability ? 'Go offline' : 'Go available'} · {data.profile.availability ? 'Available' : 'Offline'}</button>}
    </Panel>

    <Panel title="Verification documents" description="NID and supporting files are private and visible only to you and administrators.">
      <form className="workspace-form" onSubmit={(event) => { void uploadDocument(event).catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Upload failed.')) }}>
        <label className="workspace-field"><span>Document type</span><select name="documentType"><option value="national_id">National ID</option><option value="business_license">Business license</option><option value="bank_details">Bank / MFS details</option><option value="other">Other supporting document</option></select></label>
        <label className="workspace-field"><span>PDF, JPG or PNG · max 10 MB</span><input name="file" type="file" accept="application/pdf,image/jpeg,image/png" required /></label>
        <button className="button button--small" type="submit">Upload private document</button>
      </form>
      <ul className="workspace-list">{data.documents.map((document) => <li key={document.id}><strong>{document.documentType.replaceAll('_', ' ')}</strong><span>{document.fileName} · {statusLabel(document.reviewStatus)}</span><a href={`/api/provider/documents/${document.id}`}>View your file</a></li>)}</ul>
    </Panel>

    <Panel title="Open jobs" description="Only bookings in areas you cover are offered here.">
      {data.availableBookings.length ? <div className="workspace-stack">{data.availableBookings.map((booking) => <article className="workspace-record" key={booking.id}><div className="workspace-record__top"><h3>{booking.items.map((item) => item.serviceName).join(', ')}</h3><strong>{taka(booking.totalBdt)}</strong></div><p className="workspace-record__meta">{dateTime(booking.scheduledAt)} · {booking.customerName} · {booking.serviceAddress}</p><button className="button button--small" type="button" onClick={() => perform(() => acceptMarketplaceBooking(booking.id))}>Accept job</button></article>)}</div> : <EmptyState>{busy ? 'Approved verification and service coverage are required before open jobs appear.' : 'No open jobs are available in your service areas right now.'}</EmptyState>}
    </Panel>

    <Panel title="Assigned work" description="Keep customers updated as the service progresses.">
      {data.bookings.length ? <div className="workspace-stack">{data.bookings.map((booking) => {
        const next = booking.status === 'assigned' ? 'provider_accepted' : booking.status === 'provider_accepted' ? 'on_the_way' : booking.status === 'on_the_way' ? 'started' : booking.status === 'started' ? 'completed' : null
        return <article className="workspace-record" key={booking.id}><div className="workspace-record__top"><div><span className={`workspace-status workspace-status--${booking.status}`}>{statusLabel(booking.status)}</span><h3>{booking.items.map((item) => item.serviceName).join(', ')}</h3></div><strong>{taka(booking.totalBdt)}</strong></div><p className="workspace-record__meta">{dateTime(booking.scheduledAt)} · {booking.serviceAddress}</p>{next && <button className="button button--small" type="button" onClick={() => perform(() => updateProviderBooking(booking.id, next))}>{next === 'provider_accepted' ? 'Accept assignment' : `Mark ${statusLabel(next)}`}</button>}</article>
      })}</div> : <EmptyState>Accepted jobs and their status timeline will appear here.</EmptyState>}
    </Panel>

    <Panel title="Earnings &amp; payouts" description={`Available provider balance: ${taka(due)} after the platform commission.`}>
      <form className="workspace-form workspace-form__row" onSubmit={(event) => submitForm(event, requestProviderPayout)}><label className="workspace-field"><span>Full available balance (BDT)</span><input name="amountBdt" type="number" min="1000" required /></label><label className="workspace-field"><span>Bank / MFS payout method</span><input name="payoutMethod" required placeholder="bKash, bank…" /></label><label className="workspace-field"><span>Account reference</span><input name="accountReference" minLength={4} required /></label><button className="button button--small" type="submit">Request payout</button></form>
      {data.ledger.length > 0 && <ul className="workspace-list">{data.ledger.slice(0, 8).map((entry) => <li key={entry.id}><strong>{taka(entry.providerDueBdt)} due</strong><span>{taka(entry.grossBdt)} gross · {taka(entry.commissionBdt)} commission · {statusLabel(entry.settlementStatus)}</span></li>)}</ul>}
      {data.payouts.map((payout) => <p className="workspace-record__meta" key={payout.id}>{taka(payout.amountBdt)} · {payout.payoutMethod} · {statusLabel(payout.status)}{payout.adminNote ? ` · ${payout.adminNote}` : ''}</p>)}
    </Panel>
  </div>
}

function AdminWorkspace({ data, perform, submitForm }: {
  data: AdminWorkspaceData
  perform: (operation: () => Promise<OperationResult>) => void
  submitForm: (event: FormEvent<HTMLFormElement>, action: (form: FormData) => Promise<OperationResult>) => void
}) {
  const available = data.providers.filter((provider) => provider.profile?.verificationStatus === 'approved' && provider.profile.availability)
  const currentSetting = (key: string, fallback: string) => data.settings[key] ?? fallback

  return <div className="workspace-grid workspace-grid--admin">
    <div className="workspace-metrics"><article><span>Bookings</span><strong>{data.bookings.length}</strong></article><article><span>Providers</span><strong>{data.providers.length}</strong></article><article><span>Open support</span><strong>{data.complaints.filter(({ complaint }) => !['resolved', 'rejected', 'refund_approved'].includes(complaint.status)).length}</strong></article><article><span>Pending payouts</span><strong>{data.payouts.filter(({ payout }) => payout.status === 'pending').length}</strong></article></div>

    <Panel title="Booking operations" description="Review demand and assign approved providers with matching area coverage.">
      {data.bookings.length ? <div className="workspace-stack">{data.bookings.map((booking) => <article className="workspace-record" key={booking.id}><div className="workspace-record__top"><div><span className={`workspace-status workspace-status--${booking.status}`}>{statusLabel(booking.status)}</span><h3>{booking.items.map((item) => `${item.serviceName} × ${item.quantity}`).join(', ')}</h3></div><strong>{taka(booking.totalBdt)}</strong></div><p className="workspace-record__meta">{booking.customerName} · {booking.customerEmail} · {dateTime(booking.scheduledAt)} · {booking.serviceAddress}</p>{!booking.providerUserId && ['requested', 'assigned'].includes(booking.status) && <form className="workspace-inline-form" onSubmit={(event) => { const form = new FormData(event.currentTarget); perform(() => assignMarketplaceBooking(booking.id, String(form.get('providerUserId') ?? ''))) }}><label className="workspace-field"><span>Available provider</span><select name="providerUserId" required defaultValue=""><option value="" disabled>Select a provider</option>{available.filter((provider) => provider.serviceAreaIds.includes(booking.areaId)).map((provider) => <option key={provider.userId} value={provider.userId}>{provider.profile?.businessName || provider.name} · {provider.name}</option>)}</select></label><button className="button button--small" type="submit">Assign</button></form>}</article>)}</div> : <EmptyState>New customer bookings will appear here.</EmptyState>}
    </Panel>

    <Panel title="Provider verification" description="Review proposed commission, identity documents, and availability.">
      {data.providers.length ? <div className="workspace-stack">{data.providers.map((provider) => <article className="workspace-record" key={provider.userId}><div className="workspace-record__top"><div><h3>{provider.profile?.businessName || provider.name}</h3><p className="workspace-record__meta">{provider.name} · {provider.email} · {provider.profile?.phone || 'Phone not supplied'}</p></div><span className={`workspace-status workspace-status--${provider.profile?.verificationStatus ?? 'pending'}`}>{statusLabel(provider.profile?.verificationStatus ?? 'pending')}</span></div><p className="workspace-record__meta">{provider.profile?.bio || 'No provider biography yet.'}</p><form className="workspace-inline-form" onSubmit={(event) => { const form = new FormData(event.currentTarget); perform(() => reviewProviderProfile(provider.userId, String(form.get('verificationStatus')), Number(form.get('commissionPercent')))) }}><label className="workspace-field"><span>Provider status</span><select name="verificationStatus" defaultValue={provider.profile?.verificationStatus ?? 'pending'}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option></select></label><label className="workspace-field"><span>Approved commission (%)</span><input name="commissionPercent" type="number" min="0" max="60" step="0.1" defaultValue={provider.profile?.approvedCommissionPercent ?? provider.profile?.proposedCommissionPercent ?? '20'} /></label><button className="button button--small" type="submit">Save review</button></form></article>)}</div> : <EmptyState>Provider applications will appear here.</EmptyState>}
    </Panel>

    <Panel title="Admin-approved prices" description="Customer totals are always recalculated from these server-controlled prices.">
      {data.packages.length ? <div className="workspace-stack">{data.packages.map((servicePackage) => <form className="workspace-inline-form" key={servicePackage.id} onSubmit={(event) => { event.preventDefault(); const priceBdt = Number(new FormData(event.currentTarget).get('priceBdt')); perform(() => updateMarketplacePackagePrice(servicePackage.id, priceBdt)) }}><div><strong>{servicePackage.serviceName} · {servicePackage.name}</strong><p className="workspace-record__meta">{servicePackage.durationMinutes} minutes · {servicePackage.isActive ? 'Active' : 'Inactive'}</p></div><label className="workspace-field"><span>Price (BDT)</span><input name="priceBdt" type="number" min="50" max="1000000" defaultValue={servicePackage.price} required /></label><button className="button button--small" type="submit">Update</button></form>)}</div> : <EmptyState>Service packages must be created before prices can be managed.</EmptyState>}
    </Panel>

    <Panel title="Booking &amp; cancellation policy" description="These settings are applied to new bookings and cancellations.">
      <form className="workspace-inline-form" onSubmit={(event) => submitForm(event, saveMarketplaceSettings)}><label className="workspace-field"><span>Advance payment (%) for orders ≥ ৳5,000</span><input name="advance_percent" type="number" min="1" max="100" defaultValue={currentSetting('advance_percent', '20')} required /></label><label className="workspace-field"><span>Free cancellation window (hours)</span><input name="free_cancellation_hours" type="number" min="0" max="168" defaultValue={currentSetting('free_cancellation_hours', '24')} required /></label><label className="workspace-field"><span>Late cancellation fee (%)</span><input name="cancellation_fee_percent" type="number" min="0" max="100" defaultValue={currentSetting('cancellation_fee_percent', '10')} required /></label><button className="button button--small" type="submit">Save policy</button></form>
    </Panel>

    <Panel title="Private verification documents" description="Only administrators and the document owner can fetch stored files.">
      {data.documents.length ? <div className="workspace-stack">{data.documents.map((document) => <article className="workspace-record workspace-record--compact" key={document.id}><div><strong>{document.providerName} · {document.documentType.replaceAll('_', ' ')}</strong><p className="workspace-record__meta">{document.fileName} · {statusLabel(document.reviewStatus)}</p></div><a className="workspace-text-button" href={`/api/provider/documents/${document.id}`}>Download</a><div className="workspace-actions">{(['approved', 'rejected', 'pending'] as const).map((status) => <button className="workspace-text-button" type="button" key={status} onClick={() => perform(() => reviewProviderDocument(document.id, status))}>{statusLabel(status)}</button>)}</div></article>)}</div> : <EmptyState>Submitted NID and business documents will appear here.</EmptyState>}
    </Panel>

    <Panel title="Complaints &amp; refunds" description="Review each request against recorded paid amounts before approving a refund.">
      {data.complaints.length ? <div className="workspace-stack">{data.complaints.map(({ complaint, customerName }) => <article className="workspace-record" key={complaint.id}><div className="workspace-record__top"><h3>{complaint.category} · {customerName}</h3><span className={`workspace-status workspace-status--${complaint.status}`}>{statusLabel(complaint.status)}</span></div><p className="workspace-record__meta">{complaint.details}</p><p className="workspace-record__meta">Refund requested: {taka(complaint.refundRequestedBdt)}</p><form className="workspace-inline-form" onSubmit={(event) => { const form = new FormData(event.currentTarget); perform(() => resolveMarketplaceComplaint(complaint.id, String(form.get('status')), String(form.get('resolutionNote') ?? ''))) }}><label className="workspace-field"><span>Resolution</span><select name="status" defaultValue="resolved"><option value="resolved">Resolved</option><option value="refund_approved">Approve refund</option><option value="rejected">Reject</option></select></label><label className="workspace-field"><span>Resolution note</span><input name="resolutionNote" maxLength={1000} /></label><button className="button button--small" type="submit">Resolve ticket</button></form></article>)}</div> : <EmptyState>Customer support requests will appear here.</EmptyState>}
    </Panel>

    <Panel title="Provider payout requests" description="Approve, reject or record provider payouts against the pending ledger.">
      {data.payouts.length ? <div className="workspace-stack">{data.payouts.map(({ payout, providerName }) => <article className="workspace-record workspace-record--compact" key={payout.id}><div><strong>{providerName} · {taka(payout.amountBdt)}</strong><p className="workspace-record__meta">{payout.payoutMethod} · {payout.accountReference} · {statusLabel(payout.status)}</p></div><form className="workspace-inline-form" onSubmit={(event) => { const form = new FormData(event.currentTarget); perform(() => processMarketplacePayout(payout.id, String(form.get('status')), String(form.get('adminNote') ?? ''))) }}><label className="workspace-field"><span>Action</span><select name="status" defaultValue={payout.status === 'approved' ? 'paid' : 'approved'}><option value="approved">Approve</option><option value="paid">Mark paid</option><option value="rejected">Reject</option></select></label><label className="workspace-field"><span>Admin note</span><input name="adminNote" maxLength={500} /></label><button className="button button--small" type="submit">Save</button></form></article>)}</div> : <EmptyState>Provider withdrawal requests will appear here.</EmptyState>}
    </Panel>

    <Panel title="Review moderation" description="Only approved reviews should appear in public service listings.">
      {data.reviews.length ? <div className="workspace-stack">{data.reviews.map(({ review, customerName }) => <article className="workspace-record workspace-record--compact" key={review.id}><div><strong>{review.rating}/5 · {customerName}</strong><p className="workspace-record__meta">{review.message || 'No written comment.'}</p></div><div className="workspace-actions">{(['approved', 'rejected', 'pending'] as const).map((status) => <button key={status} className="workspace-text-button" type="button" onClick={() => perform(() => moderateMarketplaceReview(review.id, status))}>{statusLabel(status)}</button>)}</div></article>)}</div> : <EmptyState>Customer reviews will appear here after completed services.</EmptyState>}
    </Panel>
  </div>
}
