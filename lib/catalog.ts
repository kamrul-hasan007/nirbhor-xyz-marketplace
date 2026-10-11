import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  cities,
  serviceAreas,
  serviceAreaServices,
  serviceCategories,
  servicePackages,
  services,
} from '@/lib/db/schema'

export async function getMarketplaceCatalog() {
  const [cityRows, areaRows, categoryRows, serviceRows, coverageRows, packageRows] =
    await Promise.all([
      db.select().from(cities).where(eq(cities.isActive, true)).orderBy(asc(cities.name)),
      db
        .select()
        .from(serviceAreas)
        .where(eq(serviceAreas.isActive, true))
        .orderBy(asc(serviceAreas.name)),
      db
        .select()
        .from(serviceCategories)
        .where(eq(serviceCategories.isActive, true))
        .orderBy(asc(serviceCategories.sortOrder)),
      db
        .select({
          id: services.id,
          categoryId: services.categoryId,
          name: services.name,
          nameBn: services.nameBn,
          description: services.description,
          descriptionBn: services.descriptionBn,
          startingPrice: services.startingPrice,
          rating: services.rating,
          reviewCount: services.reviewCount,
          imageUrl: services.imageUrl,
          isPopular: services.isPopular,
        })
        .from(services)
        .where(eq(services.isActive, true)),
      db.select().from(serviceAreaServices),
      db
        .select({
          id: servicePackages.id,
          serviceId: servicePackages.serviceId,
          name: servicePackages.name,
          nameBn: servicePackages.nameBn,
          price: servicePackages.price,
          durationMinutes: servicePackages.durationMinutes,
        })
        .from(servicePackages)
        .where(eq(servicePackages.isActive, true)),
    ])

  const serviceAreaIds = new Map<string, string[]>()
  const packagesByService = new Map<string, typeof packageRows>()
  for (const servicePackage of packageRows) {
    const packages = packagesByService.get(servicePackage.serviceId) ?? []
    packages.push(servicePackage)
    packagesByService.set(servicePackage.serviceId, packages)
  }
  for (const row of coverageRows) {
    const areaIds = serviceAreaIds.get(row.serviceId) ?? []
    areaIds.push(row.serviceAreaId)
    serviceAreaIds.set(row.serviceId, areaIds)
  }

  return {
    cities: cityRows,
    areas: areaRows,
    categories: categoryRows,
    services: serviceRows.map((service) => ({
      ...service,
      rating: Number(service.rating),
      areaIds: serviceAreaIds.get(service.id) ?? [],
      packages: packagesByService.get(service.id) ?? [],
    })),
  }
}

export type MarketplaceCatalog = Awaited<ReturnType<typeof getMarketplaceCatalog>>
export type MarketplaceService = MarketplaceCatalog['services'][number]
