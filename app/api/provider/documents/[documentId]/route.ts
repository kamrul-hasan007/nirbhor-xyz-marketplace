import { get } from '@vercel/blob'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { providerDocuments } from '@/lib/db/schema'

type RouteProps = { params: Promise<{ documentId: string }> }

export async function GET(request: Request, { params }: RouteProps) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user || !['provider', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Sign in with a provider or admin account.' }, { status: 403 })
  }

  const { documentId } = await params
  const [document] = await db
    .select({ userId: providerDocuments.userId, blobPathname: providerDocuments.blobPathname, fileName: providerDocuments.fileName, contentType: providerDocuments.contentType })
    .from(providerDocuments)
    .where(eq(providerDocuments.id, documentId))
    .limit(1)
  if (!document || (session.user.role !== 'admin' && document.userId !== session.user.id)) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 })
  }

  const result = await get(document.blobPathname, {
    access: 'private',
    ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
  })
  if (!result) return new NextResponse('Not found', { status: 404 })
  if (result.statusCode === 304) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: result.blob.etag, 'Cache-Control': 'private, no-cache' },
    })
  }

  return new NextResponse(result.stream, {
    headers: {
      'Content-Type': document.contentType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      'X-Content-Type-Options': 'nosniff',
      ETag: result.blob.etag,
      'Cache-Control': 'private, no-cache',
    },
  })
}
