/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['postgres', 'web-push'],
  experimental: { serverActions: { bodySizeLimit: '8mb' } },
  distDir: process.env.NEXT_DIST_DIR || '.next',
  devIndicators: false,
  // La app Android de prueba abre el sistema por la IP de la Mac en la red local
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.*.*.*'],
  poweredByHeader: false,
  async headers() {
    const base = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=(), payment=()' },
    ]
    if (process.env.NODE_ENV === 'production') base.push({ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' })
    return [{ source: '/:path*', headers: base }]
  },
}
export default nextConfig
