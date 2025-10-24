// --- NEW AES ENCRYPTION/DECRYPTION FUNCTIONS (e.g., in a new file) ---

// Constants for AES-GCM
const ALGORITHM = "AES-GCM"; // Galois/Counter Mode is excellent for authenticated encryption
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM

/**
 * Derives an encryption key from the user's PIN using PBKDF2 (Key Stretching).
 * This makes brute-forcing the key much harder.
 * @param {string} pin The user's PIN.
 * @returns {Promise<CryptoKey>} The derived AES key.
 */
const deriveKey = async (pin) => {
  const encoder = new TextEncoder();
  const salt = encoder.encode("a-secure-salt-for-your-app"); // IMPORTANT: Use a real, unique salt in a production app!

  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000, // High number for security
      hash: "SHA-256",
    },
    baseKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
};

/**
 * Encrypts a string of text using AES-256 GCM.
 * The output includes the IV prepended to the ciphertext.
 * @param {string} plaintext The text to encrypt.
 * @param {string} pin The user's PIN.
 * @returns {Promise<string>} The base64-encoded result: IV + Ciphertext + Tag.
 */
export const aesEncrypt = async (plaintext, pin) => {
  const key = await deriveKey(pin);
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: ALGORITHM, iv: iv },
    key,
    data
  );

  // Combine IV and Ciphertext for storage/transfer
  const fullEncryptedData = new Uint8Array(
    iv.length + ciphertextBuffer.byteLength
  );
  fullEncryptedData.set(iv, 0);
  fullEncryptedData.set(new Uint8Array(ciphertextBuffer), iv.length);

  // Convert to a binary string (or Base64 if you prefer) for PNG encoding
  return Array.from(fullEncryptedData)
    .map((byte) => String.fromCharCode(byte))
    .join("");
};

/**
 * Decrypts a string of text using AES-256 GCM.
 * @param {string} encryptedText The raw binary string (IV + Ciphertext) to decrypt.
 * @param {string} pin The user's PIN.
 * @returns {Promise<string>} The decrypted plaintext.
 */
export const aesDecrypt = async (encryptedText, pin) => {
  const key = await deriveKey(pin);

  // Convert the binary string back to a Uint8Array
  const fullEncryptedData = new Uint8Array(encryptedText.length);
  for (let i = 0; i < encryptedText.length; i++) {
    fullEncryptedData[i] = encryptedText.charCodeAt(i);
  }

  // Split the full data back into IV and Ciphertext
  const iv = fullEncryptedData.slice(0, IV_LENGTH);
  const ciphertextBuffer = fullEncryptedData.slice(IV_LENGTH);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: ALGORITHM, iv: iv },
    key,
    ciphertextBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
};
