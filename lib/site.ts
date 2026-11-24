export function siteOrigin() {
  return new URL(process.env.APP_ORIGIN ?? (process.env.VERCEL_URL ? 'https://'+process.env.VERCEL_URL : 'http://localhost:3000'));
}
