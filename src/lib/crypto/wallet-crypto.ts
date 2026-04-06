import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { assertWalletEncryptionEnv, serverEnv } from "@/lib/config/server-env";

const ALGORITHM = "aes-256-gcm";

export type WalletEncryptionResult = {
  encryptedPrivateKey: string;
  nonceOrIv: string;
  authTag: string;
  cryptoAlg: "AES-256-GCM";
  keyProvider: "app_managed";
  encryptionKeyId: string;
  keyVersion: string;
  encryptedDek: string | null;
};

function deriveKey(): Buffer {
  assertWalletEncryptionEnv();
  return createHash("sha256").update(serverEnv.walletEncryptionKey, "utf8").digest();
}

export function encryptWalletPrivateKey(plainSecret: string): WalletEncryptionResult {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainSecret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedPrivateKey: encrypted.toString("base64"),
    nonceOrIv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    cryptoAlg: "AES-256-GCM",
    keyProvider: "app_managed",
    encryptionKeyId: `env:WALLET_ENCRYPTION_KEY:${serverEnv.walletEncryptionKeyVersion}`,
    keyVersion: serverEnv.walletEncryptionKeyVersion,
    encryptedDek: null,
  };
}

export function decryptWalletPrivateKey(payload: {
  encryptedPrivateKey: string;
  nonceOrIv: string;
  authTag: string | null;
}): string {
  if (!payload.authTag) {
    throw new Error("Missing auth_tag for encrypted private key payload.");
  }

  const key = deriveKey();
  const iv = Buffer.from(payload.nonceOrIv, "base64");
  const encrypted = Buffer.from(payload.encryptedPrivateKey, "base64");
  const tag = Buffer.from(payload.authTag, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
