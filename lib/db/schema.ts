import {
  boolean,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export const cities = pgTable('cities', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nameBn: text('name_bn').notNull(),
  isActive: boolean('is_active').notNull().default(true),
})

export const serviceAreas = pgTable('service_areas', {
  id: text('id').primaryKey(),
  cityId: text('city_id').notNull(),
  name: text('name').notNull(),
  nameBn: text('name_bn').notNull(),
  isActive: boolean('is_active').notNull().default(true),
})

export const serviceCategories = pgTable('service_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nameBn: text('name_bn').notNull(),
  description: text('description').notNull(),
  iconKey: text('icon_key').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
})

export const services = pgTable('services', {
  id: text('id').primaryKey(),
  categoryId: text('category_id').notNull(),
  name: text('name').notNull(),
  nameBn: text('name_bn').notNull(),
  description: text('description').notNull(),
  descriptionBn: text('description_bn').notNull(),
  startingPrice: integer('starting_price').notNull(),
  rating: numeric('rating', { precision: 2, scale: 1 }).notNull().default('4.8'),
  reviewCount: integer('review_count').notNull().default(0),
  imageUrl: text('image_url').notNull(),
  isPopular: boolean('is_popular').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
})

export const servicePackages = pgTable('service_packages', {
  id: text('id').primaryKey(),
  serviceId: text('service_id').notNull(),
  name: text('name').notNull(),
  nameBn: text('name_bn').notNull(),
  description: text('description').notNull(),
  price: integer('price').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  isActive: boolean('is_active').notNull().default(true),
})

export const serviceAreaServices = pgTable(
  'service_area_services',
  {
    serviceId: text('service_id').notNull(),
    serviceAreaId: text('service_area_id').notNull(),
  },
  (table) => [primaryKey({ columns: [table.serviceId, table.serviceAreaId] })],
)

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  role: text('role').$type<'customer' | 'provider' | 'admin'>().notNull().default('customer'),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

export const bookings = pgTable('bookings', {
  id: text('id').primaryKey(),
  customerUserId: text('customer_user_id').notNull(),
  providerUserId: text('provider_user_id'),
  areaId: text('area_id').notNull(),
  serviceAddress: text('service_address').notNull(),
  latitude: numeric('latitude'),
  longitude: numeric('longitude'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('requested'),
  subtotalBdt: integer('subtotal_bdt').notNull(),
  discountBdt: integer('discount_bdt').notNull().default(0),
  totalBdt: integer('total_bdt').notNull(),
  advanceRequiredBdt: integer('advance_required_bdt').notNull().default(0),
  amountPaidBdt: integer('amount_paid_bdt').notNull().default(0),
  paymentMethod: text('payment_method').notNull(),
  promoCode: text('promo_code'),
  notes: text('notes'),
  cancellationFeeBdt: integer('cancellation_fee_bdt').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const bookingItems = pgTable('booking_items', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull(),
  serviceId: text('service_id').notNull(),
  packageId: text('package_id').notNull(),
  serviceName: text('service_name').notNull(),
  packageName: text('package_name').notNull(),
  unitPriceBdt: integer('unit_price_bdt').notNull(),
  quantity: integer('quantity').notNull(),
  lineTotalBdt: integer('line_total_bdt').notNull(),
})

export const bookingEvents = pgTable('booking_events', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull(),
  actorUserId: text('actor_user_id').notNull(),
  status: text('status').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const customerAddresses = pgTable('customer_addresses', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  label: text('label').notNull(),
  cityId: text('city_id').notNull(),
  areaId: text('area_id'),
  streetAddress: text('street_address').notNull(),
  instructions: text('instructions'),
  latitude: numeric('latitude'),
  longitude: numeric('longitude'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const customerProfiles = pgTable('customer_profiles', {
  userId: text('user_id').primaryKey(),
  phone: text('phone').notNull().default(''),
  referralCode: text('referral_code').notNull().unique(),
  referredByCode: text('referred_by_code'),
  creditBalanceBdt: integer('credit_balance_bdt').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const promoCodes = pgTable('promo_codes', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  discountType: text('discount_type').notNull(),
  value: integer('value').notNull(),
  maxDiscountBdt: integer('max_discount_bdt'),
  minimumOrderBdt: integer('minimum_order_bdt').notNull().default(0),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  usageLimit: integer('usage_limit'),
  perUserLimit: integer('per_user_limit').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const promoRedemptions = pgTable('promo_redemptions', {
  id: text('id').primaryKey(),
  promoId: text('promo_id').notNull(),
  userId: text('user_id').notNull(),
  bookingId: text('booking_id').notNull(),
  discountBdt: integer('discount_bdt').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const providerProfiles = pgTable('provider_profiles', {
  userId: text('user_id').primaryKey(),
  phone: text('phone').notNull(),
  businessName: text('business_name').notNull(),
  bio: text('bio'),
  proposedCommissionPercent: numeric('proposed_commission_percent').notNull().default('20'),
  approvedCommissionPercent: numeric('approved_commission_percent').notNull().default('20'),
  verificationStatus: text('verification_status').notNull().default('pending'),
  availability: boolean('availability').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const providerDocuments = pgTable('provider_documents', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  blobPathname: text('blob_pathname').notNull(),
  documentType: text('document_type').notNull(),
  fileName: text('file_name').notNull(),
  contentType: text('content_type').notNull(),
  reviewStatus: text('review_status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const providerServiceAreas = pgTable(
  'provider_service_areas',
  {
    providerUserId: text('provider_user_id').notNull(),
    serviceAreaId: text('service_area_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.providerUserId, table.serviceAreaId] })],
)

export const payments = pgTable('payments', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull(),
  userId: text('user_id').notNull(),
  gateway: text('gateway').notNull(),
  transactionId: text('transaction_id').notNull(),
  validationId: text('validation_id'),
  amountBdt: integer('amount_bdt').notNull(),
  paymentMethod: text('payment_method').notNull(),
  status: text('status').notNull().default('initiated'),
  gatewayStatus: text('gateway_status'),
  validatedAt: timestamp('validated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const complaints = pgTable('complaints', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull(),
  customerUserId: text('customer_user_id').notNull(),
  category: text('category').notNull(),
  details: text('details').notNull(),
  refundRequestedBdt: integer('refund_requested_bdt').notNull().default(0),
  status: text('status').notNull().default('open'),
  resolutionNote: text('resolution_note'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const reviews = pgTable('reviews', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull(),
  customerUserId: text('customer_user_id').notNull(),
  providerUserId: text('provider_user_id'),
  rating: integer('rating').notNull(),
  message: text('message'),
  moderationStatus: text('moderation_status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const payoutRequests = pgTable('payout_requests', {
  id: text('id').primaryKey(),
  providerUserId: text('provider_user_id').notNull(),
  amountBdt: integer('amount_bdt').notNull(),
  payoutMethod: text('payout_method').notNull(),
  accountReference: text('account_reference').notNull(),
  status: text('status').notNull().default('pending'),
  adminNote: text('admin_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
})

export const providerLedger = pgTable('provider_ledger', {
  id: text('id').primaryKey(),
  providerUserId: text('provider_user_id').notNull(),
  bookingId: text('booking_id').notNull().unique(),
  grossBdt: integer('gross_bdt').notNull(),
  commissionBdt: integer('commission_bdt').notNull(),
  providerDueBdt: integer('provider_due_bdt').notNull(),
  settlementStatus: text('settlement_status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const marketplaceSettings = pgTable('marketplace_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const authSchema = { user, session, account, verification }
export const catalogSchema = {
  cities,
  serviceAreas,
  serviceCategories,
  services,
  servicePackages,
  serviceAreaServices,
  ...authSchema,
  bookings,
  bookingItems,
  bookingEvents,
  customerAddresses,
  customerProfiles,
  promoCodes,
  promoRedemptions,
  providerProfiles,
  providerDocuments,
  providerServiceAreas,
  payments,
  complaints,
  reviews,
  payoutRequests,
  providerLedger,
  marketplaceSettings,
}
export const databaseSchema = catalogSchema

export type City = typeof cities.$inferSelect
export type ServiceArea = typeof serviceAreas.$inferSelect
export type ServiceCategory = typeof serviceCategories.$inferSelect
export type Service = typeof services.$inferSelect
export type ServicePackage = typeof servicePackages.$inferSelect
export type Booking = typeof bookings.$inferSelect
export type BookingItem = typeof bookingItems.$inferSelect
export type ProviderProfile = typeof providerProfiles.$inferSelect
export type Payment = typeof payments.$inferSelect
export type Complaint = typeof complaints.$inferSelect
export type Review = typeof reviews.$inferSelect
export type PayoutRequest = typeof payoutRequests.$inferSelect
export type MarketplaceSetting = typeof marketplaceSettings.$inferSelect
export type PromoCode = typeof promoCodes.$inferSelect
export type ProviderLedgerEntry = typeof providerLedger.$inferSelect
export type CustomerProfile = typeof customerProfiles.$inferSelect
export type CustomerAddress = typeof customerAddresses.$inferSelect
export type BookingEvent = typeof bookingEvents.$inferSelect
export type ProviderDocument = typeof providerDocuments.$inferSelect
export type ProviderServiceArea = typeof providerServiceAreas.$inferSelect
export type PromoRedemption = typeof promoRedemptions.$inferSelect
export type User = typeof user.$inferSelect
export type Session = typeof session.$inferSelect
export type Account = typeof account.$inferSelect
export type Verification = typeof verification.$inferSelect
