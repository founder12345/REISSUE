export function configuredOrigin() {
  return process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN).origin : undefined;
}

export function siteOrigin() {
  return new URL(configuredOrigin() ?? (process.env.VERCEL_URL ? 'https://'+process.env.VERCEL_URL : 'http://localhost:3000'));
}
