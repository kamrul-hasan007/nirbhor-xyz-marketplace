import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { bookingEvents, bookings, payments } from '@/lib/db/schema'
import { isGatewayAmountMatch, validateSslCommerzTransaction } from '@/lib/payments/sslcommerz'

export async function settleSslCommerzTransaction(transactionId: string, validationId: string) {
  if (!transactionId || transactionId.length > 30 || !validationId || validationId.length > 128) {
    return { ok: false as const, message: 'Invalid payment reference.' }
  }

  const validation = await validateSslCommerzTransaction(validationId)
  if (
    !['VALID', 'VALIDATED'].includes(String(validation.status).toUpperCase()) ||
    validation.tran_id !== transactionId ||
    String(validation.currency).toUpperCase() !== 'BDT'
  ) {
    return { ok: false as const, message: 'The gateway could not validate this payment.' }
  }

  const settled = await db.transaction(async (tx) => {
    const [payment] = await tx.select().from(payments).where(eq(payments.transactionId, transactionId)).limit(1).for('update')
    if (!payment || payment.gateway !== 'sslcommerz') return null
    if (payment.status === 'paid') return { bookingId: payment.bookingId, alreadyPaid: true }
    if (!isGatewayAmountMatch(validation.amount, payment.amountBdt)) return null

    const [booking] = await tx.select().from(bookings).where(and(eq(bookings.id, payment.bookingId), eq(bookings.customerUserId, payment.userId))).limit(1).for('update')
    if (!booking || booking.amountPaidBdt + payment.amountBdt > booking.totalBdt) return null

    const now = new Date()
    const amountPaidBdt = booking.amountPaidBdt + payment.amountBdt
    const reachedAdvance = amountPaidBdt >= booking.advanceRequiredBdt
    const nextStatus = booking.status === 'pending_payment' && reachedAdvance ? 'requested' : booking.status
    await tx.update(payments).set({ status: 'paid', validationId, gatewayStatus: String(validation.status), validatedAt: now }).where(eq(payments.id, payment.id))
    await tx.update(bookings).set({ amountPaidBdt, status: nextStatus, updatedAt: now }).where(eq(bookings.id, booking.id))
    await tx.insert(bookingEvents).values({
      id: crypto.randomUUID(),
      bookingId: booking.id,
      actorUserId: payment.userId,
      status: nextStatus,
      note: `SSLCOMMERZ payment of ৳${payment.amountBdt} verified.`,
    })
    return { bookingId: booking.id, alreadyPaid: false }
  })

  if (!settled) return { ok: false as const, message: 'Payment details did not match an outstanding booking.' }
  revalidatePath('/customer')
  revalidatePath('/provider')
  revalidatePath('/admin')
  return { ok: true as const, bookingId: settled.bookingId, alreadyPaid: settled.alreadyPaid }
}
