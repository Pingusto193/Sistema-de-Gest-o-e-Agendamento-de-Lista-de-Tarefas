import "dotenv/config";
import { readFileSync } from "node:fs";
import pg from "pg";

// Cria o banco (se ainda não existir) e cria as tabelas nele.
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
// Apaga as tabelas antigas (inclusive as da versão anterior), para o script poder rodar de novo
await banco.query(
  `DROP TABLE IF EXISTS "sessoes_usuarios", "agendamentos", "tarefas", "colaboradores", "usuarios" CASCADE`,
);
await banco.query(readFileSync("prisma/migrations/20261014111149_init/migration.sql", "utf8"));
await banco.end();

console.info(`Banco ${nomeBanco} criado.`);
