export type GatewayValidation = {
  status?: string
  tran_id?: string
  val_id?: string
  amount?: string
  currency?: string
  risk_level?: string
  [key: string]: unknown
}

export function getSslCommerzConfig() {
  const storeId = process.env.SSLCOMMERZ_STORE_ID
  const storePassword = process.env.SSLCOMMERZ_STORE_PASSWORD
  if (!storeId || !storePassword) throw new Error('Payment gateway credentials are not configured.')

  const live = process.env.SSLCOMMERZ_ENVIRONMENT === 'live'
  return {
    storeId,
    storePassword,
    live,
    baseUrl: live ? 'https://securepay.sslcommerz.com' : 'https://sandbox.sslcommerz.com',
  }
}

export function getCanonicalOrigin() {
  const configured =
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined) ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    process.env.V0_RUNTIME_URL ??
    process.env.V0_DEV_APP_URL ??
    'http://localhost:3000'
  return new URL(configured).origin
}

export async function validateSslCommerzTransaction(valId: string) {
  const config = getSslCommerzConfig()
  const validationUrl = new URL('/validator/api/validationserverAPI.php', config.baseUrl)
  validationUrl.search = new URLSearchParams({
    val_id: valId,
    store_id: config.storeId,
    store_passwd: config.storePassword,
    format: 'json',
  }).toString()

  const response = await fetch(validationUrl, { signal: AbortSignal.timeout(20_000), cache: 'no-store' })
  if (!response.ok) throw new Error('Payment validation service returned an error.')
  return (await response.json()) as GatewayValidation
}

export function isValidGatewayUrl(value: string) {
  const config = getSslCommerzConfig()
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === new URL(config.baseUrl).hostname
  } catch {
    return false
  }
}

export function formatGatewayAmount(amountBdt: number) {
  return amountBdt.toFixed(2)
}

export function isGatewayAmountMatch(amount: string | undefined, expectedBdt: number) {
  const actual = Number(amount)
  return Number.isFinite(actual) && Math.abs(actual - expectedBdt) <= 0.01
}
