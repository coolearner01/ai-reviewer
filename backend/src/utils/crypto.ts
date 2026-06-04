import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from '../config';
import { AppError } from '../errors/AppError';

/**
 * Symmetric encryption for sensitive strings (provider OAuth tokens, refresh
 * tokens, webhook secrets stored per-repo).
 *
 * Algorithm: AES-256-GCM (authenticated encryption — tamper detection built in)
 * Key:       32 bytes from TOKEN_ENCRYPTION_KEY env var (64 hex chars)
 * Format:    `v1.<iv-hex>.<tag-hex>.<ciphertext-hex>`
 *
 * The `v1` prefix lets us rotate the algorithm/key later without breaking
 * existing rows (read the prefix, dispatch to the right decoder).
 */

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const VERSION = 'v1';

function key(): Buffer {
  const buf = Buffer.from(config.TOKEN_ENCRYPTION_KEY, 'hex');
  if (buf.length !== 32) {
    throw AppError.internal('TOKEN_ENCRYPTION_KEY must decode to 32 bytes');
  }
  return buf;
}

export const tokenCrypto = {
  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGO, key(), iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv.toString('hex'), tag.toString('hex'), ciphertext.toString('hex')].join('.');
  },

  decrypt(encrypted: string): string {
    const [version, ivHex, tagHex, ciphertextHex] = encrypted.split('.');
    if (version !== VERSION) {
      throw AppError.internal(`Unknown ciphertext version: ${version}`);
    }
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');
    const decipher = createDecipheriv(ALGO, key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  },

  /** Quick sanity check used on startup — does encrypt → decrypt round-trip? */
  selfTest(): boolean {
    try {
      const sample = 'pr-review-self-test-' + Date.now();
      return this.decrypt(this.encrypt(sample)) === sample;
    } catch {
      return false;
    }
  },
};
