import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended IV size for GCM
const KEY_LENGTH = 32; // AES-256

/**
 * AES-256-GCM field-level encryption for secrets that must be stored at rest
 * (per-organization Azure app client secrets today; a natural next step for
 * outlook_connections/gmail_connections' accessToken/refreshToken, which are
 * currently plaintext — left untouched here since retrofitting those needs a
 * migration, not just a new writer, and this pass is additive-only).
 *
 * Encoded as `iv:authTag:ciphertext` (all base64) in a single string, so it
 * drops into any existing `@Prop() someSecret: string` field with no schema
 * shape change.
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const configuredKey = config.get<string>('encryptionKey');
    if (configuredKey) {
      this.key = scryptSync(configuredKey, 'haive-encryption-salt', KEY_LENGTH);
    } else {
      // Fail-open, same shape as MailService's SMTP-not-configured warning:
      // secrets stored under this derived key are still genuinely encrypted
      // (not plaintext), just not independently rotatable from JWT_SECRET —
      // set ENCRYPTION_KEY explicitly before production use.
      this.logger.warn(
        'ENCRYPTION_KEY not set — deriving encryption key from JWT_SECRET instead. Set a dedicated ENCRYPTION_KEY for production.',
      );
      const jwtSecret = config.get<string>('jwt.secret') ?? 'insecure-fallback-secret';
      this.key = scryptSync(jwtSecret, 'haive-encryption-salt', KEY_LENGTH);
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
  }

  decrypt(payload: string): string {
    const [ivB64, authTagB64, ciphertextB64] = payload.split(':');
    if (!ivB64 || !authTagB64 || !ciphertextB64) {
      throw new Error('Malformed encrypted payload');
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextB64, 'base64')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  }
}
