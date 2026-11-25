import type { NextConfig } from 'next';

const basePolicy = "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";
const productionPolicy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'";
const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Content-Security-Policy', value: process.env.NODE_ENV==='production' ? basePolicy+'; '+productionPolicy : basePolicy },
      ],
    },{
      source:'/account/access',
      headers:[{key:'Referrer-Policy',value:'origin'},{key:'Cache-Control',value:'private, no-store'}],
    }];
  },
};
export default config;
