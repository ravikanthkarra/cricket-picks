/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: [
      '@libsql/client',
      '@prisma/adapter-libsql',
      '@prisma/adapter-better-sqlite3',
      'better-sqlite3',
    ],
  },
};

export default nextConfig;
