/**
 * lib/crypto.ts
 *
 * Chiffrement des tokens Gmail (AES-256-GCM) et signature du paramètre
 * `state` utilisé dans le flux OAuth Google.
 *
 * Aucune donnée sensible ne doit transiter par ce fichier sans passer par
 * encrypt()/decrypt(). Le refresh_token Gmail ne doit JAMAIS être stocké
 * en clair, ni loggé, ni renvoyé dans une réponse HTTP.
 */

import { randomBytes, randomUUID, createCipheriv, createDecipheriv, createHmac, timingSafeEqual } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12; // recommandé pour GCM
const KEY_LENGTH_BYTES = 32; // AES-256

interface EncryptedPayload {
  v: 1; // version du format, pour permettre une migration future
  iv: string; // base64
  ciphertext: string; // base64
  authTag: string; // base64
}

function getEncryptionKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY manquante. Générez-la avec : openssl rand -base64 32"
    );
  }
  const key = Buffer.from(secret, "base64");
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY doit décoder en exactement ${KEY_LENGTH_BYTES} octets (actuel : ${key.length}). Régénérez-la avec : openssl rand -base64 32`
    );
  }
  return key;
}

/**
 * Chiffre une chaîne (typiquement un refresh_token ou access_token Gmail).
 * Retourne une chaîne unique, sûre à stocker telle quelle dans une colonne
 * `text` (ex. gmail_accounts.refresh_token_encrypted).
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    throw new Error("encrypt() a reçu une valeur vide");
  }
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const payload: EncryptedPayload = {
    v: 1,
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: authTag.toString("base64"),
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

/**
 * Déchiffre une valeur produite par encrypt(). Lève une erreur si le tag
 * d'authentification ne correspond pas (donnée corrompue ou falsifiée).
 */
export function decrypt(encoded: string): string {
  const key = getEncryptionKey();

  let payload: EncryptedPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    throw new Error("Valeur chiffrée illisible (format invalide)");
  }

  if (payload.v !== 1) {
    throw new Error(`Version de chiffrement non supportée : ${payload.v}`);
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(), // lève une erreur si authTag invalide
  ]);

  return plaintext.toString("utf8");
}

/* ------------------------------------------------------------------ */
/* State OAuth signé (protection CSRF sur /api/gmail/connect|callback) */
/* ------------------------------------------------------------------ */

export interface OAuthStatePayload {
  entreprise_id: string;
  nonce: string;
}

function getStateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) {
    throw new Error(
      "OAUTH_STATE_SECRET manquante. Générez-la avec : openssl rand -hex 32"
    );
  }
  return secret;
}

/**
 * Construit un `state` signé (HMAC-SHA256) à passer à Google. Le nonce
 * qu'il contient doit aussi être posé dans un cookie httpOnly côté
 * connect/route.ts, puis comparé côté callback/route.ts.
 */
export function createOAuthState(entrepriseId: string): {
  state: string;
  nonce: string;
} {
  const nonce = randomUUID();
  const payload: OAuthStatePayload = { entreprise_id: entrepriseId, nonce };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const signature = createHmac("sha256", getStateSecret())
    .update(body)
    .digest("base64url");

  return { state: `${body}.${signature}`, nonce };
}

/**
 * Vérifie la signature d'un `state` reçu sur le callback OAuth et retourne
 * son contenu. Lève une erreur si la signature ne correspond pas.
 */
export function verifyOAuthState(state: string): OAuthStatePayload {
  const [body, signature] = state.split(".");
  if (!body || !signature) {
    throw new Error("state OAuth malformé");
  }

  const expected = createHmac("sha256", getStateSecret())
    .update(body)
    .digest("base64url");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("state OAuth invalide (signature ne correspond pas)");
  }

  return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
}
