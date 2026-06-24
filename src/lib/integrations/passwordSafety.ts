export type PasswordSafetyResult = {
  safe: boolean;
  pwnedCount: number;
  message: string;
};

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

async function sha1Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-1', encoded);
  return arrayBufferToHex(digest);
}

export async function checkPwnedPassword(password: string): Promise<PasswordSafetyResult> {
  if (!password) {
    return { safe: false, pwnedCount: 0, message: 'Enter a password to check.' };
  }

  const hash = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
  if (!response.ok) {
    throw new Error('Could not check password safety right now.');
  }

  const text = await response.text();
  const match = text
    .split('\n')
    .map((line) => line.trim().split(':'))
    .find(([hashSuffix]) => hashSuffix === suffix);

  const pwnedCount = match ? Number(match[1]) || 0 : 0;
  return {
    safe: pwnedCount === 0,
    pwnedCount,
    message: pwnedCount === 0
      ? 'This password was not found in the known breached-password list.'
      : `This password appears in known breaches ${pwnedCount.toLocaleString()} time(s). Choose a different password.`,
  };
}
