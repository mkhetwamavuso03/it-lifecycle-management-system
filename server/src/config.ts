export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret === 'replace-with-a-long-random-secret') {
    throw new Error('JWT_SECRET must be set to a random value of at least 32 characters');
  }
  return secret;
}
