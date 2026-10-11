import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  bookingEvents,
  bookingItems,
  bookings,
  cities,
  complaints,
  customerAddresses,
  payments,
  payoutRequests,
  providerDocuments,
  providerLedger,
  providerProfiles,
  providerServiceAreas,
  reviews,
  serviceAreas,
  servicePackages,
  services,
  user as authUser,
} from '@/lib/db/schema'

export async function getCustomerWorkspaceData(userId: string) {
  const [areaRows, cityRows, serviceRows, packageRows, coverageRows, bookingRows, addressRows, paymentRows, complaintRows, reviewRows] = await Promise.all([
    db.select({ id: serviceAreas.id, name: serviceAreas.name, nameBn: serviceAreas.nameBn, cityId: serviceAreas.cityId }).from(serviceAreas).where(eq(serviceAreas.isActive, true)).orderBy(asc(serviceAreas.name)),
    db.select({ id: cities.id, name: cities.name }).from(cities).where(eq(cities.isActive, true)),
    db.select({ id: services.id, name: services.name, nameBn: services.nameBn, categoryId: services.categoryId, startingPrice: services.startingPrice }).from(services).where(eq(services.isActive, true)).orderBy(asc(services.name)),
    db.select({ id: servicePackages.id, serviceId: servicePackages.serviceId, name: servicePackages.name, nameBn: servicePackages.nameBn, price: servicePackages.price, durationMinutes: servicePackages.durationMinutes }).from(servicePackages).where(eq(servicePackages.isActive, true)).orderBy(asc(servicePackages.price)),
    db.select().from(serviceAreaServices),
    db.select().from(bookings).where(eq(bookings.customerUserId, userId)).orderBy(desc(bookings.createdAt)).limit(50),
    db.select().from(customerAddresses).where(eq(customerAddresses.userId, userId)).orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt)).limit(10),
    db.select({ id: payments.id, bookingId: payments.bookingId, amountBdt: payments.amountBdt, paymentMethod: payments.paymentMethod, status: payments.status, gatewayStatus: payments.gatewayStatus, createdAt: payments.createdAt }).from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt)).limit(100),
    db.select().from(complaints).where(eq(complaints.customerUserId, userId)).orderBy(desc(complaints.createdAt)).limit(50),
    db.select({ id: reviews.id, bookingId: reviews.bookingId, rating: reviews.rating, message: reviews.message, moderationStatus: reviews.moderationStatus, createdAt: reviews.createdAt }).from(reviews).where(eq(reviews.customerUserId, userId)).orderBy(desc(reviews.createdAt)).limit(50),
  ])

  const bookingIds = bookingRows.map((booking) => booking.id)
  const [itemRows, eventRows] = bookingIds.length
    ? await Promise.all([
        db.select().from(bookingItems).where(inArray(bookingItems.bookingId, bookingIds)),
        db.select().from(bookingEvents).where(inArray(bookingEvents.bookingId, bookingIds)).orderBy(asc(bookingEvents.createdAt)),
      ])
    : [[], []]
  const cityNames = new Map(cityRows.map((city) => [city.id, city.name]))
  const areas = areaRows.map((area) => ({ ...area, cityName: cityNames.get(area.cityId) ?? '' }))
  const packagesByService = new Map<string, typeof packageRows>()
  for (const servicePackage of packageRows) {
    const list = packagesByService.get(servicePackage.serviceId) ?? []
    list.push(servicePackage)
    packagesByService.set(servicePackage.serviceId, list)
  }
  const coverageByService = new Map<string, string[]>()
  for (const coverage of coverageRows) {
    const list = coverageByService.get(coverage.serviceId) ?? []
    list.push(coverage.serviceAreaId)
    coverageByService.set(coverage.serviceId, list)
  }

  return {
    areas,
    services: serviceRows.map((service) => ({
      ...service,
      packages: packagesByService.get(service.id) ?? [],
      areaIds: coverageByService.get(service.id) ?? [],
    })),
    bookings: bookingRows.map((booking) => ({
      ...booking,
      items: itemRows.filter((item) => item.bookingId === booking.id),
      events: eventRows.filter((event) => event.bookingId === booking.id),
    })),
    addresses: addressRows,
    payments: paymentRows,
    complaints: complaintRows,
    reviews: reviewRows,
  }
}

export async function getProviderWorkspaceData(userId: string) {
  const [profileRows, bookingRows, documentRows, ledgerRows, payoutRows, areaRows, coverageRows] = await Promise.all([
    db.select().from(providerProfiles).where(eq(providerProfiles.userId, userId)).limit(1),
    db.select().from(bookings).where(eq(bookings.providerUserId, userId)).orderBy(desc(bookings.scheduledAt)).limit(50),
    db.select({ id: providerDocuments.id, documentType: providerDocuments.documentType, fileName: providerDocuments.fileName, contentType: providerDocuments.contentType, reviewStatus: providerDocuments.reviewStatus, createdAt: providerDocuments.createdAt }).from(providerDocuments).where(eq(providerDocuments.userId, userId)).orderBy(desc(providerDocuments.createdAt)).limit(25),
    db.select().from(providerLedger).where(eq(providerLedger.providerUserId, userId)).orderBy(desc(providerLedger.createdAt)).limit(100),
    db.select().from(payoutRequests).where(eq(payoutRequests.providerUserId, userId)).orderBy(desc(payoutRequests.createdAt)).limit(50),
    db.select({ id: serviceAreas.id, cityId: serviceAreas.cityId, name: serviceAreas.name, cityName: cities.name }).from(serviceAreas).innerJoin(cities, eq(serviceAreas.cityId, cities.id)).where(and(eq(serviceAreas.isActive, true), eq(cities.isActive, true))).orderBy(asc(cities.name), asc(serviceAreas.name)),
    db.select().from(providerServiceAreas).where(eq(providerServiceAreas.providerUserId, userId)),
  ])
  const bookingIds = bookingRows.map((booking) => booking.id)
  const [itemRows, eventRows] = bookingIds.length
    ? await Promise.all([
        db.select().from(bookingItems).where(inArray(bookingItems.bookingId, bookingIds)),
        db.select().from(bookingEvents).where(inArray(bookingEvents.bookingId, bookingIds)).orderBy(asc(bookingEvents.createdAt)),
      ])
    : [[], []]

  return {
    profile: profileRows[0] ?? null,
    areas: areaRows,
    selectedAreaIds: coverageRows.map((row) => row.serviceAreaId),
    documents: documentRows,
    ledger: ledgerRows,
    payouts: payoutRows,
    bookings: bookingRows.map((booking) => ({
      ...booking,
      items: itemRows.filter((item) => item.bookingId === booking.id),
      events: eventRows.filter((event) => event.bookingId === booking.id),
    })),
  }
}

export async function getAdminWorkspaceData() {
  const [bookingRows, providerRows, complaintRows, documentRows, payoutRows, reviewRows, areaRows, providerCoverageRows] = await Promise.all([
    db.select({ booking: bookings, customerName: authUser.name, customerEmail: authUser.email }).from(bookings).innerJoin(authUser, eq(bookings.customerUserId, authUser.id)).orderBy(desc(bookings.createdAt)).limit(100),
    db.select({ userId: authUser.id, name: authUser.name, email: authUser.email, profile: providerProfiles }).from(authUser).leftJoin(providerProfiles, eq(authUser.id, providerProfiles.userId)).where(eq(authUser.role, 'provider')).orderBy(desc(authUser.createdAt)).limit(100),
    db.select({ complaint: complaints, customerName: authUser.name, customerEmail: authUser.email }).from(complaints).innerJoin(authUser, eq(complaints.customerUserId, authUser.id)).orderBy(desc(complaints.createdAt)).limit(100),
    db.select({ id: providerDocuments.id, userId: providerDocuments.userId, documentType: providerDocuments.documentType, fileName: providerDocuments.fileName, contentType: providerDocuments.contentType, reviewStatus: providerDocuments.reviewStatus, createdAt: providerDocuments.createdAt, providerName: authUser.name, businessName: providerProfiles.businessName }).from(providerDocuments).innerJoin(authUser, eq(providerDocuments.userId, authUser.id)).leftJoin(providerProfiles, eq(providerDocuments.userId, providerProfiles.userId)).orderBy(desc(providerDocuments.createdAt)).limit(100),
    db.select({ payout: payoutRequests, providerName: authUser.name, businessName: providerProfiles.businessName }).from(payoutRequests).innerJoin(authUser, eq(payoutRequests.providerUserId, authUser.id)).leftJoin(providerProfiles, eq(payoutRequests.providerUserId, providerProfiles.userId)).orderBy(desc(payoutRequests.createdAt)).limit(100),
    db.select({ review: reviews, customerName: authUser.name }).from(reviews).innerJoin(authUser, eq(reviews.customerUserId, authUser.id)).orderBy(desc(reviews.createdAt)).limit(100),
    db.select({ id: serviceAreas.id, name: serviceAreas.name, cityName: cities.name }).from(serviceAreas).innerJoin(cities, eq(serviceAreas.cityId, cities.id)).where(and(eq(serviceAreas.isActive, true), eq(cities.isActive, true))).orderBy(asc(cities.name), asc(serviceAreas.name)),
    db.select().from(providerServiceAreas),
  ])
  const bookingIds = bookingRows.map((row) => row.booking.id)
  const itemRows = bookingIds.length
    ? await db.select().from(bookingItems).where(inArray(bookingItems.bookingId, bookingIds))
    : []

  return {
    bookings: bookingRows.map(({ booking, ...customer }) => ({
      ...booking,
      ...customer,
      items: itemRows.filter((item) => item.bookingId === booking.id),
    })),
    providers: providerRows.map((provider) => ({
      ...provider,
      serviceAreaIds: providerCoverageRows.filter((area) => area.providerUserId === provider.userId).map((area) => area.serviceAreaId),
    })),
    complaints: complaintRows,
    documents: documentRows,
    payouts: payoutRows,
    reviews: reviewRows,
    areas: areaRows,
  }
}

export type CustomerWorkspaceData = Awaited<ReturnType<typeof getCustomerWorkspaceData>>
export type ProviderWorkspaceData = Awaited<ReturnType<typeof getProviderWorkspaceData>>
export type AdminWorkspaceData = Awaited<ReturnType<typeof getAdminWorkspaceData>>
export type MarketplacePackage = CustomerWorkspaceData['services'][number]['packages'][number]
export type MarketplaceServiceOption = CustomerWorkspaceData['services'][number]
export type WorkspaceBooking = CustomerWorkspaceData['bookings'][number]
export type WorkspaceProviderBooking = ProviderWorkspaceData['bookings'][number]
export type WorkspaceAdminBooking = AdminWorkspaceData['bookings'][number]
export type WorkspaceProvider = AdminWorkspaceData['providers'][number]
export type WorkspaceComplaint = AdminWorkspaceData['complaints'][number]
export type WorkspaceDocument = AdminWorkspaceData['documents'][number]
export type WorkspacePayout = AdminWorkspaceData['payouts'][number]
export type WorkspaceReview = AdminWorkspaceData['reviews'][number]
export type WorkspaceArea = CustomerWorkspaceData['areas'][number]


