/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  outputFileTracingExcludes: {
    '*': [
      '**/*Program Files*/**',
      '**/*Windows Defender*/**',
      '**/node_modules/.cache/**'
    ]
  },
  serverExternalPackages: [
    'socket.io',
    'jose',
    'bcryptjs',
    'pg',
    'mongoose'
  ],
  experimental: {
    // Ensuring clean tracing on Windows
  }
};

module.exports = nextConfig;
