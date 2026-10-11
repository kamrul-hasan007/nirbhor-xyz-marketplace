import { NirbhorMarketplace } from '@/components/nirbhor-marketplace'
import { getMarketplaceCatalog } from '@/lib/catalog'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const catalog = await getMarketplaceCatalog()

  return <NirbhorMarketplace catalog={catalog} />
}
