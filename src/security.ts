import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const AES_ALGORITHM = "aes-256-gcm";
const BCRYPT_ROUNDS = 12;

function getCpfEncryptionKey(): Buffer {
  const configuredKey = process.env.CPF_ENCRYPTION_KEY;

  if (!configuredKey) {
    throw new Error("CPF_ENCRYPTION_KEY não está configurada.");
  }

  const key = Buffer.from(configuredKey, "base64");
  if (key.length !== 32 || key.toString("base64") !== configuredKey) {
    throw new Error("CPF_ENCRYPTION_KEY deve ser uma chave Base64 de 32 bytes.");
  }

  return key;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function encryptCpf(cpf: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(AES_ALGORITHM, getCpfEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(cpf, "utf8"),
    cipher.final(),
  ]);

  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptCpf(encryptedCpf: string): string {
  const [version, encodedIv, encodedTag, encodedData] = encryptedCpf.split(":");
  if (
    version !== "v1" ||
    !encodedIv ||
    !encodedTag ||
    !encodedData
  ) {
    throw new Error("CPF cifrado possui formato inválido.");
  }

  const decipher = createDecipheriv(
    AES_ALGORITHM,
    getCpfEncryptionKey(),
    Buffer.from(encodedIv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encodedData, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
