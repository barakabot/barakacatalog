export function getAppSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (secret && secret.length >= 32) return secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET باید در محیط production حداقل ۳۲ کاراکتر باشد')
  }
  return 'baraka-development-only-secret-do-not-use-in-production'
}
