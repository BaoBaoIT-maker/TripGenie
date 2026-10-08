import { describe, it, expect } from 'vitest';
import { getSafeRedirectUrl } from '@/lib/safe-redirect';

describe('getSafeRedirectUrl', () => {
  it('cho phép các đường dẫn nội bộ hợp lệ', () => {
    expect(getSafeRedirectUrl('/explore')).toBe('/explore');
    expect(getSafeRedirectUrl('/planner/new')).toBe('/planner/new');
    expect(getSafeRedirectUrl('/profile?tab=account')).toBe('/profile?tab=account');
  });

  it('từ chối URL không hợp lệ hoặc rỗng và trả về fallback', () => {
    expect(getSafeRedirectUrl(null)).toBe('/explore');
    expect(getSafeRedirectUrl(undefined)).toBe('/explore');
    expect(getSafeRedirectUrl('')).toBe('/explore');
    expect(getSafeRedirectUrl('   ')).toBe('/explore');
  });

  it('từ chối scheme-relative URLs (//attacker.com hoặc /\\attacker.com)', () => {
    expect(getSafeRedirectUrl('//evil.com')).toBe('/explore');
    expect(getSafeRedirectUrl('//evil.com/path')).toBe('/explore');
    expect(getSafeRedirectUrl('/\\evil.com')).toBe('/explore');
    expect(getSafeRedirectUrl('\\evil.com')).toBe('/explore');
  });

  it('từ chối executable protocols như javascript: và data:', () => {
    expect(getSafeRedirectUrl('javascript:alert(1)')).toBe('/explore');
    expect(getSafeRedirectUrl('data:text/html,<script>alert(1)</script>')).toBe('/explore');
    expect(getSafeRedirectUrl('https://evil.com')).toBe('/explore');
    expect(getSafeRedirectUrl('http://evil.com')).toBe('/explore');
  });

  it('chặn auth loop (chuyển hướng về login hoặc register)', () => {
    expect(getSafeRedirectUrl('/login')).toBe('/explore');
    expect(getSafeRedirectUrl('/register')).toBe('/explore');
    expect(getSafeRedirectUrl('/verify-otp')).toBe('/explore');
    expect(getSafeRedirectUrl('/forgot-password')).toBe('/explore');
    expect(getSafeRedirectUrl('/reset-password')).toBe('/explore');
    expect(getSafeRedirectUrl('/login?next=/explore')).toBe('/explore');
  });

  it('chặn control-character URLs và bypass qua tab/newline (raw và percent-encoded)', () => {
    // Raw control characters and tabs
    expect(getSafeRedirectUrl('/\t/evil.example')).toBe('/explore');
    expect(getSafeRedirectUrl('/\n/evil.example')).toBe('/explore');
    expect(getSafeRedirectUrl('/\r/evil.example')).toBe('/explore');
    expect(getSafeRedirectUrl('/\\t//evil.example')).toBe('/explore');
    expect(getSafeRedirectUrl('/   /evil.example')).toBe('/explore');

    // Percent-encoded control characters (%09 = TAB, %0A = LF, %0D = CR, %00 = NULL)
    expect(getSafeRedirectUrl('/%09/evil.example')).toBe('/explore');
    expect(getSafeRedirectUrl('/%0a/evil.example')).toBe('/explore');
    expect(getSafeRedirectUrl('/%0A/evil.example')).toBe('/explore');
    expect(getSafeRedirectUrl('/%0d/evil.example')).toBe('/explore');
    expect(getSafeRedirectUrl('/%00/evil.example')).toBe('/explore');
    expect(getSafeRedirectUrl('/%20/evil.example')).toBe('/explore');
    expect(getSafeRedirectUrl('/explore\x00evil')).toBe('/explore');
    expect(getSafeRedirectUrl('/explore\x1fevil')).toBe('/explore');
  });
});
