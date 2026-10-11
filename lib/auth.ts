import { betterAuth } from 'better-auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { pool } from '@/lib/db'

export const auth = betterAuth({
  database: pool,
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL ??
          (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : undefined)),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'customer',
        input: true,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (newUser) => ({
          data: {
            ...newUser,
            role: newUser.role === 'provider' ? 'provider' : 'customer',
          },
        }),
      },
    },
  },
  trustedOrigins: [
    ...(process.env.NODE_ENV === 'development'
      ? [
          'http://localhost:3000',
          ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
          ...(process.env.V0_DEV_APP_URL ? [process.env.V0_DEV_APP_URL] : []),
          ...(process.env.V0_BUILD_URL ? [process.env.V0_BUILD_URL] : []),
          ...(process.env.V0_SANDBOX_URL ? [process.env.V0_SANDBOX_URL] : []),
        ]
      : []),
    ...(process.env.NODE_ENV === 'production'
      ? [
          ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
          ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
            : []),
        ]
      : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  ...(process.env.NODE_ENV === 'development'
    ? {
        advanced: {
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        },
      }
    : {}),
})

export type AccountRole = 'customer' | 'provider' | 'admin'

export function getRoleHome(role: string | null | undefined) {
  if (role === 'admin') return '/admin'
  if (role === 'provider') return '/provider'
  return '/customer'
}

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

export async function requireRole(role: AccountRole) {
  const currentSession = await getSession()

  if (!currentSession?.user) redirect('/sign-in')
  if (currentSession.user.role !== role) redirect(getRoleHome(currentSession.user.role))

  return currentSession
}

export async function requireSession() {
  const currentSession = await getSession()

  if (!currentSession?.user) redirect('/sign-in')
  return currentSession
}
