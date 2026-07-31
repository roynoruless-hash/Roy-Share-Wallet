import crypto from 'crypto';

// Reusable encryption key derived from environment or static fallback.
// In production, ADMIN_SECRET_KEY should be set in environment variables.
const ENCRYPTION_KEY = process.env.ADMIN_SECRET_KEY || 'royshare_secure_encryption_key_32bytes_long!'; 
const IV_LENGTH = 16;

/**
 * Encrypts a string using aes-256-cbc.
 * Returns a hex string in format: iv:encryptedContent
 */
export function encrypt(text: string): string {
  if (!text) return '';
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc', 
      Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), 
      iv
    );
    let encrypted = cipher.update(text, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (err) {
    console.error('Encryption failed:', err);
    return text;
  }
}

/**
 * Decrypts a hex string in format iv:encryptedContent back to string.
 * Fallbacks to returning the raw text if decryption fails (e.g. if plain-text was stored).
 */
export function decrypt(text: string): string {
  if (!text) return '';
  if (!text.includes(':')) {
    // If it doesn't have a colon, it's probably stored as plain text before migration, return as-is.
    return text;
  }
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc', 
      Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), 
      iv
    );
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.warn('Decryption failed, returning input text directly:', err);
    return text;
  }
}
