import { NextResponse } from 'next/server'
import { settleSslCommerzTransaction } from '@/lib/payments/settle-transaction'

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null)
  const transactionId = String(form?.get('tran_id') ?? '')
  const validationId = String(form?.get('val_id') ?? '')
  if (!transactionId || !validationId) {
    return NextResponse.json({ error: 'Missing payment validation details.' }, { status: 400 })
  }

  try {
    const result = await settleSslCommerzTransaction(transactionId, validationId)
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('SSLCOMMERZ IPN validation failed.', error)
    return NextResponse.json({ error: 'Payment validation is temporarily unavailable.' }, { status: 502 })
  }
}
