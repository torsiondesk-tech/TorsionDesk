function getTwilioCredentials(): { accountSid: string; authToken: string } {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
  }
}

export async function getTwilio() {
  const { accountSid, authToken } = getTwilioCredentials()
  if (!accountSid || !authToken) {
    throw new Error('TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is not configured')
  }
  const twilio = (await import('twilio')).default
  return twilio(accountSid, authToken)
}
