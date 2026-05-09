/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: process.env.ADMIN_ALLOWED_ORIGINS
        ? process.env.ADMIN_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
        : [],
    },
  },
}

module.exports = nextConfig
