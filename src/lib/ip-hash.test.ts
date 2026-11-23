import { describe, expect, it } from 'vitest';
import { createIpHasher } from './ip-hash.js';

describe('createIpHasher', () => {
  const hash = createIpHasher('test-salt-0123456789');

  it('is deterministic for the same ip and salt', () => {
    expect(hash('203.0.113.7')).toBe(hash('203.0.113.7'));
  });

  it('never returns the ip in clear', () => {
    expect(hash('203.0.113.7')).not.toContain('203.0.113.7');
    expect(hash('203.0.113.7')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('depends on the salt', () => {
    expect(createIpHasher('other-salt-0123456789')('203.0.113.7')).not.toBe(hash('203.0.113.7'));
  });
});
