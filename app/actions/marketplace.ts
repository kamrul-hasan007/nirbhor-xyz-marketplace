'use server'

import { randomUUID } from 'node:crypto'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { auth, type AccountRole } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  bookingEvents,
  bookingItems,
  bookings,
  cities,
  complaints,
  customerAddresses,
  customerProfiles,
  payments,
  payoutRequests,
  marketplaceSettings,
  promoCodes,
  promoRedemptions,
  providerDocuments,
  providerLedger,
  providerProfiles,
  providerServiceAreas,
  reviews,
  serviceAreaServices,
  serviceAreas,
  servicePackages,
  services,
  user as authUser,
} from '@/lib/db/schema'
import {
  formatGatewayAmount,
  getCanonicalOrigin,
  getSslCommerzConfig,
  isValidGatewayUrl,
} from '@/lib/payments/sslcommerz'

const id = () => randomUUID()
const field = (form: FormData, key: string) => String(form.get(key) ?? '').trim()
const boundedText = (value: string, length: number) => value.slice(0, length)
const revalidateWorkspaces = () => {
  revalidatePath('/customer')
  revalidatePath('/provider')
  revalidatePath('/admin')
}

async function getActor(roles?: AccountRole[]) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Sign in to continue.')
  if (roles && !roles.includes(session.user.role as AccountRole)) throw new Error('You do not have permission to do that.')
  return session.user
}

async function settingNumber(key: string, fallback: number, minimum: number, maximum: number) {
  const [row] = await db.select({ value: marketplaceSettings.value }).from(marketplaceSettings).where(eq(marketplaceSettings.key, key)).limit(1)
  const value = Number(row?.value)
  return Number.isFinite(value) && value >= minimum && value <= maximum ? value : fallback
}

export async function createCustomerBooking(form: FormData) {
  try {
    const actor = await getActor(['customer'])
    const areaId = field(form, 'areaId')
    const serviceAddress = boundedText(field(form, 'serviceAddress'), 300)
    const phone = boundedText(field(form, 'phone').replace(/[^+\d]/g, ''), 20)
    const scheduledAt = new Date(field(form, 'scheduledAt'))
    const paymentMethod = field(form, 'paymentMethod')
    const promoCode = field(form, 'promoCode').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32)
    const notes = boundedText(field(form, 'notes'), 500)
    const itemsInput = JSON.parse(field(form, 'items') || '[]') as unknown
    const latitudeText = field(form, 'latitude')
    const longitudeText = field(form, 'longitude')
    const latitude = latitudeText ? Number(latitudeText) : null
    const longitude = longitudeText ? Number(longitudeText) : null

    if (!Array.isArray(itemsInput) || itemsInput.length < 1 || itemsInput.length > 10) throw new Error('Add between 1 and 10 services to your booking.')
    if (!areaId || serviceAddress.length < 8) throw new Error('Choose a service area and enter a complete address.')
    if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() + 60 * 60 * 1000) throw new Error('Choose a service time at least one hour from now.')
    if (!/^\+?\d{7,18}$/.test(phone)) throw new Error('Enter a valid phone number for payment and service updates.')
    if (!['sslcommerz', 'cash_on_completion'].includes(paymentMethod)) throw new Error('Choose a valid payment method.')
    if ((latitude !== null && !Number.isFinite(latitude)) || (longitude !== null && !Number.isFinite(longitude))) throw new Error('The map coordinates are invalid.')

    const requestedItems = itemsInput.map((item) => {
      const value = item as { packageId?: unknown; quantity?: unknown }
      const packageId = typeof value.packageId === 'string' ? value.packageId : ''
      const quantity = Number(value.quantity)
      if (!packageId || !Number.isInteger(quantity) || quantity < 1 || quantity > 5) throw new Error('Each service quantity must be between 1 and 5.')
      return { packageId, quantity }
    })
    const quantities = new Map<string, number>()
    for (const item of requestedItems) quantities.set(item.packageId, (quantities.get(item.packageId) ?? 0) + item.quantity)
    if ([...quantities.values()].some((quantity) => quantity > 5)) throw new Error('A service package can be booked up to 5 times.')

    const uniquePackageIds = [...quantities.keys()]
    const packageRows = await db
      .select({ serviceId: services.id, serviceName: services.name, packageId: servicePackages.id, packageName: servicePackages.name, unitPriceBdt: servicePackages.price })
      .from(servicePackages)
      .innerJoin(services, eq(servicePackages.serviceId, services.id))
      .where(and(inArray(servicePackages.id, uniquePackageIds), eq(servicePackages.isActive, true), eq(services.isActive, true)))
    if (packageRows.length !== uniquePackageIds.length) throw new Error('One or more selected services are no longer available.')

    const [area] = await db.select({ id: serviceAreas.id, cityId: serviceAreas.cityId, areaName: serviceAreas.name }).from(serviceAreas).where(and(eq(serviceAreas.id, areaId), eq(serviceAreas.isActive, true))).limit(1)
    if (!area) throw new Error('That service area is currently unavailable.')
    const coveredServiceIds = await db.select({ serviceId: serviceAreaServices.serviceId }).from(serviceAreaServices).where(and(eq(serviceAreaServices.serviceAreaId, areaId), inArray(serviceAreaServices.serviceId, packageRows.map((row) => row.serviceId))))
    const covered = new Set(coveredServiceIds.map((row) => row.serviceId))
    if (packageRows.some((row) => !covered.has(row.serviceId))) throw new Error('A selected service is not offered in that neighbourhood.')

    const subtotalBdt = packageRows.reduce((sum, row) => sum + row.unitPriceBdt * (quantities.get(row.packageId) ?? 0), 0)
    if (!Number.isSafeInteger(subtotalBdt) || subtotalBdt <= 0) throw new Error('The booking total is invalid.')
    const threshold = 5000
    if (subtotalBdt >= threshold && paymentMethod !== 'sslcommerz') throw new Error('Bookings of ৳5,000 or more require an online advance payment.')

    const customer = await db.select({ name: authUser.name, email: authUser.email }).from(authUser).where(eq(authUser.id, actor.id)).limit(1)
    const profile = await db.select({ phone: customerProfiles.phone }).from(customerProfiles).where(eq(customerProfiles.userId, actor.id)).limit(1)
    const customerPhone = phone || profile[0]?.phone || ''
    if (!customer[0]?.email) throw new Error('Your account needs a valid email address before checkout.')

    const bookingId = id()
    const advancePercent = await settingNumber('advance_percent', 20, 1, 100)
    const promoKey = promoCode || null
    const transactionResult = await db.transaction(async (tx) => {
      let discountBdt = 0
      let promoId: string | null = null
      if (promoKey) {
        const [promo] = await tx.select().from(promoCodes).where(and(eq(promoCodes.code, promoKey), eq(promoCodes.isActive, true))).limit(1).for('update')
        const now = new Date()
        if (!promo || (promo.startsAt && promo.startsAt > now) || (promo.endsAt && promo.endsAt < now) || subtotalBdt < promo.minimumOrderBdt) throw new Error('That promo code is not valid for this booking.')
        const [usage] = await tx.select({ count: sql<number>`count(*)` }).from(promoRedemptions).where(eq(promoRedemptions.promoId, promo.id))
        const [userUsage] = await tx.select({ count: sql<number>`count(*)` }).from(promoRedemptions).where(and(eq(promoRedemptions.promoId, promo.id), eq(promoRedemptions.userId, actor.id)))
        if ((promo.usageLimit !== null && Number(usage?.count) >= promo.usageLimit) || Number(userUsage?.count) >= promo.perUserLimit) throw new Error('That promo code has reached its usage limit.')
        discountBdt = ['percent', 'percentage'].includes(promo.discountType.toLowerCase())
          ? Math.floor((subtotalBdt * promo.value) / 100)
          : promo.value
        if (promo.maxDiscountBdt !== null) discountBdt = Math.min(discountBdt, promo.maxDiscountBdt)
        discountBdt = Math.max(0, Math.min(discountBdt, subtotalBdt))
        promoId = promo.id
      }

      const totalBdt = subtotalBdt - discountBdt
      const advanceRequiredBdt = totalBdt >= threshold ? Math.ceil((totalBdt * advancePercent) / 100) : paymentMethod === 'sslcommerz' ? totalBdt : 0
      await tx.insert(bookings).values({
        id: bookingId,
        customerUserId: actor.id,
        areaId,
        serviceAddress,
        latitude: latitude === null ? null : String(latitude),
        longitude: longitude === null ? null : String(longitude),
        scheduledAt,
        status: advanceRequiredBdt > 0 ? 'pending_payment' : 'requested',
        subtotalBdt,
        discountBdt,
        totalBdt,
        advanceRequiredBdt,
        amountPaidBdt: 0,
        paymentMethod,
        promoCode: promoKey,
        notes: notes || null,
      })
      await tx.insert(bookingItems).values(packageRows.map((row) => {
        const quantity = quantities.get(row.packageId) ?? 0
        return { id: id(), bookingId, serviceId: row.serviceId, packageId: row.packageId, serviceName: row.serviceName, packageName: row.packageName, unitPriceBdt: row.unitPriceBdt, quantity, lineTotalBdt: row.unitPriceBdt * quantity }
      }))
      await tx.insert(bookingEvents).values({ id: id(), bookingId, actorUserId: actor.id, status: advanceRequiredBdt > 0 ? 'pending_payment' : 'requested', note: 'Booking submitted by customer.' })
      if (promoId) await tx.insert(promoRedemptions).values({ id: id(), promoId, userId: actor.id, bookingId, discountBdt })
      await tx.insert(customerProfiles).values({ userId: actor.id, phone: customerPhone, referralCode: `NIR${id().replaceAll('-', '').slice(0, 8).toUpperCase()}` }).onConflictDoUpdate({ target: customerProfiles.userId, set: { phone: customerPhone, updatedAt: new Date() } })
      await tx.update(customerAddresses).set({ isDefault: false }).where(eq(customerAddresses.userId, actor.id))
      await tx.insert(customerAddresses).values({ id: id(), userId: actor.id, label: 'Home', cityId: area.cityId, areaId, streetAddress: serviceAddress, latitude: latitude === null ? null : String(latitude), longitude: longitude === null ? null : String(longitude), isDefault: true })
      return { totalBdt, advanceRequiredBdt }
    })

    revalidateWorkspaces()
    if (transactionResult.advanceRequiredBdt > 0) {
      const checkout = await startCheckoutForBooking(bookingId)
      if (!checkout.ok) return { ok: true as const, bookingId, gatewayUrl: null, message: `Booking saved. Payment could not start: ${checkout.message} You can retry it from your orders.` }
      return { ok: true as const, bookingId, gatewayUrl: checkout.gatewayUrl, message: 'Your booking is saved. Continue to secure payment.' }
    }
    return { ok: true as const, bookingId, gatewayUrl: null, message: 'Your booking is confirmed as requested. Pay after service completion.' }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'We could not create the booking.' }
  }
}

export async function startCheckoutForBooking(bookingId: string) {
  try {
    const actor = await getActor(['customer'])
    const [booking] = await db.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.customerUserId, actor.id))).limit(1)
    if (!booking || booking.paymentMethod !== 'sslcommerz' || booking.status === 'cancelled') throw new Error('This booking is not available for online payment.')
    const amountBdt = Math.max(booking.advanceRequiredBdt - booking.amountPaidBdt, 0)
    if (!amountBdt) throw new Error('There is no remaining advance payment for this booking.')
    if (amountBdt < 10) throw new Error('SSLCOMMERZ accepts payments of at least ৳10.')

    const [customer] = await db.select({ name: authUser.name, email: authUser.email }).from(authUser).where(eq(authUser.id, actor.id)).limit(1)
    const [profile] = await db.select({ phone: customerProfiles.phone }).from(customerProfiles).where(eq(customerProfiles.userId, actor.id)).limit(1)
    const [area] = await db.select({ name: serviceAreas.name, cityId: serviceAreas.cityId }).from(serviceAreas).where(eq(serviceAreas.id, booking.areaId)).limit(1)
    const [city] = area ? await db.select({ name: cities.name }).from(cities).where(eq(cities.id, area.cityId)).limit(1) : []
    if (!customer?.name || !customer.email || !profile?.phone) throw new Error('Add your name, email, and phone to your account before payment.')

    const paymentId = id()
    const transactionId = `NR${Date.now()}${randomUUID().replaceAll('-', '').slice(0, 12)}`.slice(0, 30)
    const config = getSslCommerzConfig()
    const origin = getCanonicalOrigin()
    const callback = new URL('/api/payments/sslcommerz/callback', origin)
    const ipn = new URL('/api/payments/sslcommerz/ipn', origin)
    const form = new URLSearchParams({
      store_id: config.storeId,
      store_passwd: config.storePassword,
      total_amount: formatGatewayAmount(amountBdt),
      currency: 'BDT',
      tran_id: transactionId,
      success_url: `${callback}?decision=success`,
      fail_url: `${callback}?decision=failed`,
      cancel_url: `${callback}?decision=cancelled`,
      ipn_url: ipn.toString(),
      cus_name: boundedText(customer.name, 50),
      cus_email: boundedText(customer.email, 50),
      cus_phone: boundedText(profile.phone, 20),
      cus_add1: boundedText(booking.serviceAddress, 50),
      cus_city: boundedText(city?.name ?? 'Dhaka', 50),
      cus_postcode: '1000',
      cus_country: 'Bangladesh',
      shipping_method: 'NO',
      num_of_item: '1',
      product_name: `Nirbhor home service ${booking.id.slice(0, 8)}`,
      product_category: 'Home services',
      product_profile: 'non-physical-goods',
      value_a: booking.id,
    })

    await db.insert(payments).values({ id: paymentId, bookingId: booking.id, userId: actor.id, gateway: 'sslcommerz', transactionId, amountBdt, paymentMethod: 'sslcommerz', status: 'initiated' })
    const response = await fetch(`${config.baseUrl}/gwprocess/v4/api.php`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form, cache: 'no-store', signal: AbortSignal.timeout(25_000) })
    const gateway = await response.json() as { status?: string; GatewayPageURL?: string }
    if (!response.ok || gateway.status !== 'SUCCESS' || !gateway.GatewayPageURL || !isValidGatewayUrl(gateway.GatewayPageURL)) {
      await db.update(payments).set({ status: 'failed', gatewayStatus: gateway.status ?? 'session_creation_failed' }).where(eq(payments.id, paymentId))
      throw new Error('The payment gateway could not create a checkout session.')
    }
    await db.update(payments).set({ gatewayStatus: 'session_created' }).where(eq(payments.id, paymentId))
    revalidateWorkspaces()
    return { ok: true as const, gatewayUrl: gateway.GatewayPageURL }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'We could not start payment.' }
  }
}

export async function cancelCustomerBooking(bookingId: string) {
  try {
    const actor = await getActor(['customer'])
    const result = await db.transaction(async (tx) => {
      const [booking] = await tx.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.customerUserId, actor.id))).limit(1).for('update')
      if (!booking || !['requested', 'provider_accepted', 'assigned', 'pending_payment'].includes(booking.status)) throw new Error('This booking can no longer be cancelled online.')
      const windowHours = await settingNumber('free_cancellation_hours', 24, 0, 168)
      const feePercent = await settingNumber('cancellation_fee_percent', 10, 0, 100)
      const hoursUntilService = (booking.scheduledAt.getTime() - Date.now()) / 3_600_000
      const fee = hoursUntilService < windowHours ? Math.floor((booking.totalBdt * feePercent) / 100) : 0
      await tx.update(bookings).set({ status: 'cancelled', cancellationFeeBdt: fee, updatedAt: new Date() }).where(eq(bookings.id, bookingId))
      await tx.insert(bookingEvents).values({ id: id(), bookingId, actorUserId: actor.id, status: 'cancelled', note: fee ? `Cancelled inside the ${windowHours}-hour window; cancellation fee ৳${fee}.` : 'Cancelled by customer.' })
      return fee
    })
    revalidateWorkspaces()
    return { ok: true as const, feeBdt: result }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Could not cancel this booking.' }
  }
}

export async function rescheduleCustomerBooking(bookingId: string, scheduledAtInput: string) {
  try {
    const actor = await getActor(['customer'])
    const scheduledAt = new Date(scheduledAtInput)
    if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() + 60 * 60 * 1000) throw new Error('Choose a new time at least one hour from now.')
    const [booking] = await db.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.customerUserId, actor.id))).limit(1)
    if (!booking || !['requested', 'provider_accepted', 'assigned'].includes(booking.status)) throw new Error('This booking can no longer be rescheduled online.')
    await db.update(bookings).set({ scheduledAt, updatedAt: new Date() }).where(and(eq(bookings.id, bookingId), eq(bookings.customerUserId, actor.id)))
    await db.insert(bookingEvents).values({ id: id(), bookingId, actorUserId: actor.id, status: booking.status, note: `Rescheduled to ${scheduledAt.toISOString()}.` })
    revalidateWorkspaces()
    return { ok: true as const }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Could not reschedule this booking.' }
  }
}

export async function submitCustomerComplaint(bookingId: string, category: string, details: string, refundRequestedBdt: number) {
  try {
    const actor = await getActor(['customer'])
    const [booking] = await db.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.customerUserId, actor.id))).limit(1)
    if (!booking) throw new Error('Booking not found.')
    const cleanDetails = boundedText(details.trim(), 1000)
    const cleanCategory = boundedText(category.trim(), 50)
    if (!cleanCategory || cleanDetails.length < 10) throw new Error('Choose a complaint type and add at least 10 characters of detail.')
    if (!Number.isSafeInteger(refundRequestedBdt) || refundRequestedBdt < 0 || refundRequestedBdt > booking.amountPaidBdt) throw new Error('Refund requests cannot exceed the amount already paid.')
    const [existing] = await db.select({ id: complaints.id }).from(complaints).where(and(eq(complaints.bookingId, bookingId), eq(complaints.customerUserId, actor.id))).limit(1)
    if (existing) throw new Error('A support ticket already exists for this booking.')
    await db.insert(complaints).values({ id: id(), bookingId, customerUserId: actor.id, category: cleanCategory, details: cleanDetails, refundRequestedBdt })
    revalidateWorkspaces()
    return { ok: true as const }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Could not submit the support request.' }
  }
}

export async function submitCustomerReview(bookingId: string, rating: number, message: string) {
  try {
    const actor = await getActor(['customer'])
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Choose a rating from 1 to 5.')
    const [booking] = await db.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.customerUserId, actor.id))).limit(1)
    if (!booking || booking.status !== 'completed') throw new Error('Reviews are available after a service is completed.')
    const [existing] = await db.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.bookingId, bookingId), eq(reviews.customerUserId, actor.id))).limit(1)
    if (existing) throw new Error('A review has already been submitted for this booking.')
    await db.insert(reviews).values({ id: id(), bookingId, customerUserId: actor.id, providerUserId: booking.providerUserId, rating, message: boundedText(message.trim(), 1000) || null })
    revalidateWorkspaces()
    return { ok: true as const }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Could not submit your review.' }
  }
}

export async function saveProviderProfile(form: FormData) {
  try {
    const actor = await getActor(['provider'])
    const businessName = boundedText(field(form, 'businessName'), 100)
    const phone = boundedText(field(form, 'phone').replace(/[^+\d]/g, ''), 20)
    const bio = boundedText(field(form, 'bio'), 1000)
    const proposedCommission = Number(field(form, 'proposedCommissionPercent'))
    const areaIds = [...new Set(form.getAll('serviceAreaIds').map((value) => String(value)).filter(Boolean))].slice(0, 30)
    if (businessName.length < 2 || !/^\+?\d{7,18}$/.test(phone)) throw new Error('Enter a business name and valid phone number.')
    if (!Number.isFinite(proposedCommission) || proposedCommission < 0 || proposedCommission > 60) throw new Error('Propose a platform commission between 0% and 60%.')
    const validAreas = areaIds.length ? await db.select({ id: serviceAreas.id }).from(serviceAreas).where(and(inArray(serviceAreas.id, areaIds), eq(serviceAreas.isActive, true))) : []
    if (validAreas.length !== areaIds.length) throw new Error('One or more service areas are unavailable.')
    await db.transaction(async (tx) => {
      await tx.insert(providerProfiles).values({ userId: actor.id, phone, businessName, bio: bio || null, proposedCommissionPercent: String(proposedCommission) }).onConflictDoUpdate({ target: providerProfiles.userId, set: { phone, businessName, bio: bio || null, proposedCommissionPercent: String(proposedCommission), updatedAt: new Date() } })
      await tx.delete(providerServiceAreas).where(eq(providerServiceAreas.providerUserId, actor.id))
      if (areaIds.length) await tx.insert(providerServiceAreas).values(areaIds.map((serviceAreaId) => ({ providerUserId: actor.id, serviceAreaId })))
    })
    revalidateWorkspaces()
    return { ok: true as const }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Could not save your provider profile.' }
  }
}

export async function setProviderAvailability(availability: boolean) {
  try {
    const actor = await getActor(['provider'])
    const [profile] = await db.select().from(providerProfiles).where(eq(providerProfiles.userId, actor.id)).limit(1)
    if (!profile || profile.verificationStatus !== 'approved') throw new Error('Your provider profile must be approved before you can accept work.')
    await db.update(providerProfiles).set({ availability, updatedAt: new Date() }).where(eq(providerProfiles.userId, actor.id))
    revalidateWorkspaces()
    return { ok: true as const }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Could not update availability.' }
  }
}

export async function acceptMarketplaceBooking(bookingId: string) {
  try {
    const actor = await getActor(['provider'])
    await db.transaction(async (tx) => {
      const [profile] = await tx.select().from(providerProfiles).where(eq(providerProfiles.userId, actor.id)).limit(1)
      if (!profile || profile.verificationStatus !== 'approved' || !profile.availability) throw new Error('An approved, available provider profile is required to accept jobs.')
      const [booking] = await tx.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.status, 'requested'), isNull(bookings.providerUserId))).limit(1).for('update')
      if (!booking) throw new Error('This job is no longer available.')
      const [coverage] = await tx.select({ serviceAreaId: providerServiceAreas.serviceAreaId }).from(providerServiceAreas).where(and(eq(providerServiceAreas.providerUserId, actor.id), eq(providerServiceAreas.serviceAreaId, booking.areaId))).limit(1)
      if (!coverage) throw new Error('This job is outside your approved service areas.')
      await tx.update(bookings).set({ providerUserId: actor.id, status: 'provider_accepted', updatedAt: new Date() }).where(eq(bookings.id, bookingId))
      await tx.insert(bookingEvents).values({ id: id(), bookingId, actorUserId: actor.id, status: 'provider_accepted', note: 'Provider accepted the job.' })
    })
    revalidateWorkspaces()
    return { ok: true as const }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Could not accept this job.' }
  }
}

export async function updateProviderBooking(bookingId: string, nextStatus: string) {
  try {
    const actor = await getActor(['provider'])
    if (!['provider_accepted', 'provider_rejected', 'on_the_way', 'started', 'completed'].includes(nextStatus)) throw new Error('That status change is not allowed.')
    await db.transaction(async (tx) => {
      const [booking] = await tx.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.providerUserId, actor.id))).limit(1).for('update')
      if (!booking) throw new Error('This job is not assigned to your account.')
      const transitions: Record<string, string[]> = {
        provider_accepted: ['requested', 'assigned'],
        provider_rejected: ['requested', 'assigned'],
        on_the_way: ['provider_accepted', 'assigned'],
        started: ['on_the_way'],
        completed: ['started'],
      }
      if (!transitions[nextStatus]?.includes(booking.status)) throw new Error('This job cannot move to that status yet.')
      if (nextStatus === 'provider_rejected') {
        await tx.update(bookings).set({ providerUserId: null, status: 'requested', updatedAt: new Date() }).where(eq(bookings.id, bookingId))
      } else {
        if (nextStatus === 'completed') {
          const [profile] = await tx.select().from(providerProfiles).where(eq(providerProfiles.userId, actor.id)).limit(1)
          if (!profile || profile.verificationStatus !== 'approved') throw new Error('Only approved providers can complete assigned work.')
          const unpaid = Math.max(booking.totalBdt - booking.amountPaidBdt, 0)
          if (unpaid) await tx.insert(payments).values({ id: id(), bookingId, userId: booking.customerUserId, gateway: 'cash', transactionId: `COD-${id()}`.slice(0, 30), amountBdt: unpaid, paymentMethod: 'cash_on_completion', status: 'paid', gatewayStatus: 'collected_by_provider', validatedAt: new Date() })
          const commissionPercent = Number(profile.approvedCommissionPercent)
          const commissionBdt = Math.round((booking.totalBdt * commissionPercent) / 100)
          await tx.insert(providerLedger).values({ id: id(), providerUserId: actor.id, bookingId, grossBdt: booking.totalBdt, commissionBdt, providerDueBdt: booking.totalBdt - commissionBdt, settlementStatus: 'pending' }).onConflictDoNothing()
          await tx.update(bookings).set({ status: 'completed', amountPaidBdt: booking.totalBdt, updatedAt: new Date() }).where(eq(bookings.id, bookingId))
        } else {
          await tx.update(bookings).set({ status: nextStatus, updatedAt: new Date() }).where(eq(bookings.id, bookingId))
        }
      }
      await tx.insert(bookingEvents).values({ id: id(), bookingId, actorUserId: actor.id, status: nextStatus, note: nextStatus === 'provider_rejected' ? 'Provider declined; job returned to the unassigned queue.' : null })
    })
    revalidateWorkspaces()
    return { ok: true as const }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Could not update this job.' }
  }
}

export async function requestProviderPayout(form: FormData) {
  try {
    const actor = await getActor(['provider'])
    const amountBdt = Number(field(form, 'amountBdt'))
    const payoutMethod = boundedText(field(form, 'payoutMethod'), 40)
    const accountReference = boundedText(field(form, 'accountReference'), 100)
    if (!Number.isSafeInteger(amountBdt) || amountBdt < 1000 || !payoutMethod || accountReference.length < 4) throw new Error('Enter a payout amount of at least ৳1,000 and valid payout details.')
    const [balance] = await db.select({ amount: sql<number>`coalesce(sum(${providerLedger.providerDueBdt}), 0)` }).from(providerLedger).where(and(eq(providerLedger.providerUserId, actor.id), eq(providerLedger.settlementStatus, 'pending')))
    const available = Number(balance?.amount ?? 0)
    if (amountBdt !== available) throw new Error(`Request your full available balance of ৳${available.toLocaleString('en-BD')}.`)
    const [outstanding] = await db.select({ id: payoutRequests.id }).from(payoutRequests).where(and(eq(payoutRequests.providerUserId, actor.id), inArray(payoutRequests.status, ['pending', 'approved']))).limit(1)
    if (outstanding) throw new Error('A payout request is already being processed.')
    await db.insert(payoutRequests).values({ id: id(), providerUserId: actor.id, amountBdt, payoutMethod, accountReference })
    revalidateWorkspaces()
    return { ok: true as const }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Could not submit the payout request.' }
  }
}

export async function reviewProviderProfile(userId: string, verificationStatus: string, commissionPercent: number) {
  try {
    await getActor(['admin'])
    if (!['pending', 'approved', 'rejected', 'suspended'].includes(verificationStatus) || !Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 60) throw new Error('Choose a valid provider status and commission.')
    const [provider] = await db.select({ id: authUser.id }).from(authUser).where(and(eq(authUser.id, userId), eq(authUser.role, 'provider'))).limit(1)
    if (!provider) throw new Error('Provider account not found.')
    await db.insert(providerProfiles).values({ userId, phone: '', businessName: 'Provider profile', proposedCommissionPercent: String(commissionPercent), approvedCommissionPercent: String(commissionPercent), verificationStatus }).onConflictDoUpdate({ target: providerProfiles.userId, set: { verificationStatus, approvedCommissionPercent: String(commissionPercent), updatedAt: new Date() } })
    revalidateWorkspaces()
    return { ok: true as const }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Could not review this provider.' }
  }
}

export async function assignMarketplaceBooking(bookingId: string, providerUserId: string) {
  try {
    const actor = await getActor(['admin'])
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1)
    const [provider] = await db.select().from(providerProfiles).where(eq(providerProfiles.userId, providerUserId)).limit(1)
    if (!booking || !provider || provider.verificationStatus !== 'approved' || !provider.availability) throw new Error('Choose an approved, available provider.')
    const [coverage] = await db.select({ serviceAreaId: providerServiceAreas.serviceAreaId }).from(providerServiceAreas).where(and(eq(providerServiceAreas.providerUserId, providerUserId), eq(providerServiceAreas.serviceAreaId, booking.areaId))).limit(1)
    if (!coverage) throw new Error('That provider does not cover this service area.')
    await db.transaction(async (tx) => {
      await tx.update(bookings).set({ providerUserId, status: 'assigned', updatedAt: new Date() }).where(eq(bookings.id, bookingId))
      await tx.insert(bookingEvents).values({ id: id(), bookingId, actorUserId: actor.id, status: 'assigned', note: 'Provider assigned by operations.' })
    })
    revalidateWorkspaces()
    return { ok: true as const }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Could not assign this booking.' }
  }
}

export async function reviewProviderDocument(documentId: string, reviewStatus: string) {
  try {
    await getActor(['admin'])
    if (!['approved', 'rejected', 'pending'].includes(reviewStatus)) throw new Error('Choose a valid review status.')
    const [document] = await db.select().from(providerDocuments).where(eq(providerDocuments.id, documentId)).limit(1)
    if (!document) throw new Error('Document not found.')
    await db.update(providerDocuments).set({ reviewStatus }).where(eq(providerDocuments.id, documentId))
    revalidateWorkspaces()
    return { ok: true as const }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Could not review this document.' }
  }
}

export async function resolveMarketplaceComplaint(complaintId: string, status: string, resolutionNote: string) {
  try {
    const actor = await getActor(['admin'])
    if (!['resolved', 'refund_approved', 'rejected'].includes(status)) throw new Error('Choose a valid resolution.')
    const [complaint] = await db.select().from(complaints).where(eq(complaints.id, complaintId)).limit(1)
    if (!complaint) throw new Error('Support ticket not found.')
    if (status === 'refund_approved' && complaint.refundRequestedBdt > 0) {
      const [booking] = await db.select({ amountPaidBdt: bookings.amountPaidBdt }).from(bookings).where(eq(bookings.id, complaint.bookingId)).limit(1)
      if (!booking || complaint.refundRequestedBdt > booking.amountPaidBdt) throw new Error('The requested refund exceeds the payment recorded for this booking.')
    }
    await db.update(complaints).set({ status, resolutionNote: boundedText(resolutionNote.trim(), 1000) || null, resolvedAt: new Date() }).where(eq(complaints.id, complaintId))
    await db.insert(bookingEvents).values({ id: id(), bookingId: complaint.bookingId, actorUserId: actor.id, status: 'support_updated', note: `Support case ${status}.` })
    revalidateWorkspaces()
    return { ok: true as const }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Could not resolve this support ticket.' }
  }
}

export async function processMarketplacePayout(payoutId: string, status: string, adminNote: string) {
  try {
    await getActor(['admin'])
    if (!['approved', 'paid', 'rejected'].includes(status)) throw new Error('Choose a valid payout status.')
    const [payout] = await db.select().from(payoutRequests).where(eq(payoutRequests.id, payoutId)).limit(1)
    if (!payout || !['pending', 'approved'].includes(payout.status)) throw new Error('This payout request has already been processed.')
    await db.transaction(async (tx) => {
      await tx.update(payoutRequests).set({ status, adminNote: boundedText(adminNote.trim(), 500) || null, processedAt: status === 'paid' || status === 'rejected' ? new Date() : null }).where(eq(payoutRequests.id, payoutId))
      if (status === 'paid') await tx.update(providerLedger).set({ settlementStatus: 'paid' }).where(and(eq(providerLedger.providerUserId, payout.providerUserId), eq(providerLedger.settlementStatus, 'pending')))
    })
    revalidateWorkspaces()
    return { ok: true as const }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Could not update this payout.' }
  }
}

export async function moderateMarketplaceReview(reviewId: string, moderationStatus: string) {
  try {
    await getActor(['admin'])
    if (!['approved', 'rejected', 'pending'].includes(moderationStatus)) throw new Error('Choose a valid moderation status.')
    await db.update(reviews).set({ moderationStatus }).where(eq(reviews.id, reviewId))
    revalidateWorkspaces()
    return { ok: true as const }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Could not update the review.' }
  }
}

export async function updateMarketplacePackagePrice(packageId: string, priceBdt: number) {
  try {
    await getActor(['admin'])
    if (!packageId || !Number.isSafeInteger(priceBdt) || priceBdt < 50 || priceBdt > 1_000_000) throw new Error('Set a package price between ৳50 and ৳1,000,000.')
    const [servicePackage] = await db.select({ serviceId: servicePackages.serviceId }).from(servicePackages).where(eq(servicePackages.id, packageId)).limit(1)
    if (!servicePackage) throw new Error('Service package not found.')
    await db.transaction(async (tx) => {
      await tx.update(servicePackages).set({ price: priceBdt }).where(eq(servicePackages.id, packageId))
      const [lowest] = await tx.select({ price: sql<number>`min(${servicePackages.price})` }).from(servicePackages).where(and(eq(servicePackages.serviceId, servicePackage.serviceId), eq(servicePackages.isActive, true)))
      if (lowest?.price !== null && lowest?.price !== undefined) await tx.update(services).set({ startingPrice: Number(lowest.price) }).where(eq(services.id, servicePackage.serviceId))
    })
    revalidatePath('/')
    revalidateWorkspaces()
    return { ok: true as const }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Could not update this package price.' }
  }
}

export async function saveMarketplaceSettings(form: FormData) {
  try {
    await getActor(['admin'])
    const settings = [
      { key: 'advance_percent', minimum: 1, maximum: 100 },
      { key: 'free_cancellation_hours', minimum: 0, maximum: 168 },
      { key: 'cancellation_fee_percent', minimum: 0, maximum: 100 },
    ]
    const values = settings.map(({ key, minimum, maximum }) => {
      const value = Number(field(form, key))
      if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`Enter a valid value for ${key.replaceAll('_', ' ')}.`)
      return { key, value: String(value) }
    })
    await db.transaction(async (tx) => {
      for (const setting of values) {
        await tx.insert(marketplaceSettings).values({ ...setting, updatedAt: new Date() }).onConflictDoUpdate({ target: marketplaceSettings.key, set: { value: setting.value, updatedAt: new Date() } })
      }
    })
    revalidateWorkspaces()
    return { ok: true as const }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Could not save marketplace settings.' }
  }
}

export async function beginSslCommerzCheckout(bookingId: string) {
  try {
    const actor = await getActor(['customer'])
    const [booking] = await db.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.customerUserId, actor.id))).limit(1)
    if (!booking || booking.paymentMethod !== 'sslcommerz' || booking.status === 'cancelled') throw new Error('This booking is not available for online payment.')
    const amountBdt = Math.max(booking.advanceRequiredBdt - booking.amountPaidBdt, 0)
    if (!amountBdt) throw new Error('There is no remaining advance payment for this booking.')
    if (amountBdt < 10) throw new Error('SSLCOMMERZ accepts payments of at least ৳10.')
    const [customer] = await db.select({ name: authUser.name, email: authUser.email }).from(authUser).where(eq(authUser.id, actor.id)).limit(1)
    const [profile] = await db.select({ phone: customerProfiles.phone }).from(customerProfiles).where(eq(customerProfiles.userId, actor.id)).limit(1)
    const [area] = await db.select({ name: serviceAreas.name, cityId: serviceAreas.cityId }).from(serviceAreas).where(eq(serviceAreas.id, booking.areaId)).limit(1)
    const [city] = area ? await db.select({ name: cities.name }).from(cities).where(eq(cities.id, area.cityId)).limit(1) : []
    if (!customer?.name || !customer.email || !profile?.phone) throw new Error('Add your name, email, and phone to your account before payment.')

    const paymentId = id()
    const transactionId = `NR${Date.now()}${randomUUID().replaceAll('-', '').slice(0, 12)}`.slice(0, 30)
    const config = getSslCommerzConfig()
    const origin = getCanonicalOrigin()
    const callback = new URL('/api/payments/sslcommerz/callback', origin)
    const ipn = new URL('/api/payments/sslcommerz/ipn', origin)
    const form = new URLSearchParams({
      store_id: config.storeId,
      store_passwd: config.storePassword,
      total_amount: formatGatewayAmount(amountBdt),
      currency: 'BDT',
      tran_id: transactionId,
      success_url: `${callback}?decision=success`,
      fail_url: `${callback}?decision=failed`,
      cancel_url: `${callback}?decision=cancelled`,
      ipn_url: ipn.toString(),
      cus_name: boundedText(customer.name, 50),
      cus_email: boundedText(customer.email, 50),
      cus_phone: boundedText(profile.phone, 20),
      cus_add1: boundedText(booking.serviceAddress, 50),
      cus_city: boundedText(city?.name ?? 'Dhaka', 50),
      cus_postcode: '1000',
      cus_country: 'Bangladesh',
      shipping_method: 'NO',
      num_of_item: '1',
      product_name: `Nirbhor home service ${booking.id.slice(0, 8)}`,
      product_category: 'Home services',
      product_profile: 'non-physical-goods',
      value_a: booking.id,
    })
    await db.insert(payments).values({ id: paymentId, bookingId: booking.id, userId: actor.id, gateway: 'sslcommerz', transactionId, amountBdt, paymentMethod: 'sslcommerz', status: 'initiated' })
    const response = await fetch(`${config.baseUrl}/gwprocess/v4/api.php`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form, cache: 'no-store', signal: AbortSignal.timeout(25_000) })
    const gateway = await response.json() as { status?: string; GatewayPageURL?: string }
    if (!response.ok || gateway.status !== 'SUCCESS' || !gateway.GatewayPageURL || !isValidGatewayUrl(gateway.GatewayPageURL)) {
      await db.update(payments).set({ status: 'failed', gatewayStatus: gateway.status ?? 'session_creation_failed' }).where(eq(payments.id, paymentId))
      throw new Error('The payment gateway could not create a checkout session.')
    }
    await db.update(payments).set({ gatewayStatus: 'session_created' }).where(eq(payments.id, paymentId))
    revalidateWorkspaces()
    return { ok: true as const, gatewayUrl: gateway.GatewayPageURL }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'We could not start payment.' }
  }
}
