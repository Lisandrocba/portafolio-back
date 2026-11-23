import { createHmac } from 'node:crypto';

/**
 * HMAC-SHA256 of the IP with IP_HASH_SALT (rule 9, ADR-019). The IP is never stored in clear.
 * Without the salt, the IPv4 space is small enough to brute-force a plain SHA-256.
 */
export function createIpHasher(salt: string): (ip: string) => string {
  return (ip) => createHmac('sha256', salt).update(ip).digest('hex');
}
