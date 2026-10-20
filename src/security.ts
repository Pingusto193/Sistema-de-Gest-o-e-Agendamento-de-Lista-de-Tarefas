import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

function chave(): Buffer {
  const key = Buffer.from(process.env.CPF_ENCRYPTION_KEY ?? "", "base64");
  if (key.length !== 32) {
    throw new Error("CPF_ENCRYPTION_KEY deve ser uma chave Base64 de 32 bytes.");
  }
  return key;
}

export const hashPassword = (senha: string) => bcrypt.hash(senha, 12);

export const verifyPassword = (senha: string, hash: string) =>
  bcrypt.compare(senha, hash);

// Formato guardado: iv:tag:dado (base64url)
export function encryptCpf(cpf: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chave(), iv);
  const dado = Buffer.concat([cipher.update(cpf, "utf8"), cipher.final()]);

  return [iv, cipher.getAuthTag(), dado].map((b) => b.toString("base64url")).join(":");
}

export function decryptCpf(cifrado: string): string {
  const [iv, tag, dado] = cifrado.split(":").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !dado) {
    throw new Error("CPF cifrado possui formato inválido.");
  }

  const decipher = createDecipheriv("aes-256-gcm", chave(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(dado), decipher.final()]).toString("utf8");
}
