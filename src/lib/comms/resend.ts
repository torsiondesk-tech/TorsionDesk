function getResendApiKey(): string {
  return process.env.RESEND_API_KEY ?? ''
}

export async function getResend() {
  const key = getResendApiKey()
  if (!key) {
    throw new Error('RESEND_API_KEY is not configured')
  }
  const { Resend } = await import('resend')
  return new Resend(key)
}
