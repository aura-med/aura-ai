const createNextIntlPlugin = require('next-intl/plugin')
const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: process.env.ADMIN_ALLOWED_ORIGINS
        ? process.env.ADMIN_ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
        : [],
    },
  },
}

module.exports = withNextIntl(nextConfig)
