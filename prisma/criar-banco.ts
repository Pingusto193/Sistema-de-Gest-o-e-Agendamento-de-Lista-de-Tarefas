import "dotenv/config";
import { readFileSync } from "node:fs";
import pg from "pg";

// Cria o banco (se ainda não existir) e roda o saep_db.sql nele.
const url = new URL(process.env.DATABASE_URL ?? "");
const nomeBanco = decodeURIComponent(url.pathname.slice(1));

const urlServidor = new URL(url);
urlServidor.pathname = "/postgres";

const servidor = new pg.Client({ connectionString: urlServidor.href });
await servidor.connect();
const existe = await servidor.query("SELECT 1 FROM pg_database WHERE datname = $1", [nomeBanco]);
if (existe.rowCount === 0) {
  await servidor.query(`CREATE DATABASE "${nomeBanco}"`);
}
await servidor.end();

const banco = new pg.Client({ connectionString: url.href });
await banco.connect();
await banco.query(readFileSync("saep_db.sql", "utf8"));
await banco.end();

console.info(`Banco ${nomeBanco} criado e populado.`);
