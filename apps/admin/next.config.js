const createNextIntlPlugin = require('next-intl/plugin')
const path = require('path')
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
  webpack(config) {
    config.resolve.alias['@root'] = path.resolve(__dirname, '../..')
    return config
  },
}

module.exports = withNextIntl(nextConfig)
