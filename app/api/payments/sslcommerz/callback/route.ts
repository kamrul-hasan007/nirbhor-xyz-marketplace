import { NextResponse } from 'next/server'
import { settleSslCommerzTransaction } from '@/lib/payments/settle-transaction'

async function handleCallback(request: Request) {
  const requestUrl = new URL(request.url)
  const values = new URLSearchParams(requestUrl.searchParams)
  if (request.method !== 'GET') {
    const form = await request.formData().catch(() => null)
    form?.forEach((value, key) => {
      if (typeof value === 'string') values.set(key, value)
    })
  }

  const decision = requestUrl.searchParams.get('decision')
  const transactionId = values.get('tran_id') ?? ''
  const validationId = values.get('val_id') ?? ''
  let outcome = 'failed'
  let bookingId = ''

  if (decision === 'success' && transactionId && validationId) {
    try {
      const result = await settleSslCommerzTransaction(transactionId, validationId)
      if (result.ok) {
        outcome = 'success'
        bookingId = result.bookingId
      }
    } catch (error) {
      console.error('SSLCOMMERZ browser callback validation failed.', error)
    }
  }

  const destination = new URL('/customer', requestUrl.origin)
  destination.searchParams.set('payment', outcome)
  if (bookingId) destination.searchParams.set('booking', bookingId)
  return NextResponse.redirect(destination, 303)
}

export const GET = handleCallback
export const POST = handleCallback
