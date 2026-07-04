// Recovery code generation + hashing utilities (Web Crypto).
// Codes are shown to the user once; only SHA-256 hashes are stored in Supabase.

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

export function generateRecoveryCode(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const chars: string[] = [];
  for (let i = 0; i < 10; i++) {
    chars.push(ALPHABET[bytes[i] % ALPHABET.length]);
  }
  // Format XXXXX-XXXXX for readability
  return `${chars.slice(0, 5).join('')}-${chars.slice(5).join('')}`;
}

export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, generateRecoveryCode);
}

export function normalizeRecoveryCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]/g, '');
}

export async function hashRecoveryCode(code: string): Promise<string> {
  const normalized = normalizeRecoveryCode(code);
  const buf = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
