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

export const catalogSchema = {
  cities,
  serviceAreas,
  serviceCategories,
  services,
  servicePackages,
  serviceAreaServices,
  user,
  session,
  account,
  verification,
}

export const authSchema = { user, session, account, verification }
export const databaseSchema = catalogSchema

export type City = typeof cities.$inferSelect
export type ServiceArea = typeof serviceAreas.$inferSelect
export type ServiceCategory = typeof serviceCategories.$inferSelect
export type Service = typeof services.$inferSelect
export type ServicePackage = typeof servicePackages.$inferSelect
