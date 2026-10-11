import { randomUUID } from 'node:crypto'
import { del, put } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { providerDocuments } from '@/lib/db/schema'
import { headers } from 'next/headers'

const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png'])
const maxFileSize = 10 * 1024 * 1024

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user || session.user.role !== 'provider') {
    return NextResponse.json({ error: 'A provider account is required.' }, { status: 403 })
  }

  const form = await request.formData()
  const file = form.get('file')
  const documentType = String(form.get('documentType') ?? '').trim()
  const allowedDocumentTypes = new Set(['national_id', 'business_license', 'bank_details', 'other'])
  if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size < 1 || file.size > maxFileSize) {
    return NextResponse.json({ error: 'Upload a PDF, JPG, or PNG up to 10 MB.' }, { status: 400 })
  }
  if (!allowedDocumentTypes.has(documentType)) {
    return NextResponse.json({ error: 'Choose a valid document type.' }, { status: 400 })
  }

  const fileName = file.name.replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 120) || 'provider-document'
  const blob = await put(`provider-documents/${session.user.id}/${randomUUID()}`, file, {
    access: 'private',
    contentType: file.type,
    addRandomSuffix: false,
  })

  try {
    const documentId = randomUUID()
    await db.insert(providerDocuments).values({
      id: documentId,
      userId: session.user.id,
      blobPathname: blob.pathname,
      documentType,
      fileName,
      contentType: file.type,
    })
    return NextResponse.json({ ok: true, documentId }, { status: 201 })
  } catch (error) {
    await del(blob.pathname).catch(() => undefined)
    console.error('Provider document record could not be saved.', error)
    return NextResponse.json({ error: 'Document upload could not be saved.' }, { status: 500 })
  }
}
