/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  env: {
    // Baked into the static build at build time. Set this in Cloudflare
    // Pages' project settings (Environment Variables) to your deployed
    // Worker's URL before building, e.g.:
    //   NEXT_PUBLIC_API_BASE=https://propops-sandbox-api.<you>.workers.dev
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || '',
  },
};

module.exports = nextConfig;
