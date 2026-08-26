import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
  outputFileTracingIncludes: {
    '/api/docs/openapi\\.yaml': ['./docs/openapi.yaml'],
  },
  // jspdf ships its own core-js polyfills (via canvg) that are incompatible
  // with Turbopack's module resolution. Marking them as server-external keeps
  // them out of the SSR bundle; the dynamic import() in DashboardClient loads
  // them in the browser only, where the real DOM APIs are available.
  serverExternalPackages: ['jspdf', 'jspdf-autotable', 'canvg'],
}

export default withNextIntl(nextConfig)
