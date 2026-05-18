import { describe, it, expect } from 'vitest';
import { RMAB_USER_AGENT } from '@/lib/utils/user-agent';

describe('RMAB_USER_AGENT', () => {
  it('uses the ReadMeABook/<semver> format', () => {
    expect(RMAB_USER_AGENT).toMatch(/^ReadMeABook\/\d+\.\d+\.\d+/);
  });

  it('does not look like a generic bot signature', () => {
    expect(RMAB_USER_AGENT).not.toMatch(/^axios\//);
    expect(RMAB_USER_AGENT).not.toMatch(/^rmab\//);
  });
});
