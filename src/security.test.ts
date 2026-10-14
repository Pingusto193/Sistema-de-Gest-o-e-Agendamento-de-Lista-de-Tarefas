import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { decryptCpf, encryptCpf, hashPassword, verifyPassword } from "./security";

process.env.CPF_ENCRYPTION_KEY = randomBytes(32).toString("base64");

test("CPF é cifrado e pode ser recuperado, sem gravar o valor original", () => {
  const cpf = "123.456.789-00";
  const cifrado = encryptCpf(cpf);

  assert.notEqual(cifrado, cpf);
  assert.equal(decryptCpf(cifrado), cpf);
});

test("hash de senha verifica a senha correta e rejeita a incorreta", async () => {
  const hash = await hashPassword("SenhaSegura123!");

  assert.notEqual(hash, "SenhaSegura123!");
  assert.equal(await verifyPassword("SenhaSegura123!", hash), true);
  assert.equal(await verifyPassword("senha-errada", hash), false);
});
