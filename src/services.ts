import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./db";
import { decryptCpf, verifyPassword } from "./security";

const SESSION_INACTIVITY_MS = 30 * 60 * 1000;

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function loginUsuario(
  login: string,
  senha: string,
): Promise<{ token: string; usuario: { id: number; nome: string; login: string } } | null> {
  const usuario = await prisma.usuario.findUnique({
    where: { login },
    select: { id: true, nome: true, login: true, senha: true },
  });

  if (!usuario || !(await verifyPassword(senha, usuario.senha))) {
    return null;
  }

  const token = randomBytes(32).toString("base64url");
  await prisma.sessaoUsuario.create({
    data: {
      tokenHash: hashSessionToken(token),
      usuarioId: usuario.id,
    },
  });

  return {
    token,
    usuario: { id: usuario.id, nome: usuario.nome, login: usuario.login },
  };
}

export async function obterSessaoAtiva(token: string): Promise<{
  usuario: { id: number; nome: string; login: string };
  loginAt: Date;
} | null> {
  const sessao = await prisma.sessaoUsuario.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      loginAt: true,
      lastActivityAt: true,
      usuario: { select: { id: true, nome: true, login: true } },
    },
  });

  if (!sessao) {
    return null;
  }

  const agora = new Date();
  if (agora.getTime() - sessao.lastActivityAt.getTime() >= SESSION_INACTIVITY_MS) {
    await prisma.sessaoUsuario.delete({ where: { id: sessao.id } });
    return null;
  }

  await prisma.sessaoUsuario.update({
    where: { id: sessao.id },
    data: { lastActivityAt: agora },
  });

  return { usuario: sessao.usuario, loginAt: sessao.loginAt };
}

export async function encerrarSessao(token: string): Promise<void> {
  await prisma.sessaoUsuario.deleteMany({
    where: { tokenHash: hashSessionToken(token) },
  });
}

export async function buscarColaboradoresPorNome(nome: string) {
  const termo = nome.trim();
  if (!termo) {
    return [];
  }

  const colaboradores = await prisma.$queryRaw<
    Array<{ id: number; nome: string; cpf: string; email: string }>
  >`
    SELECT id, nome, cpf, email
    FROM colaboradores
    WHERE nome LIKE ${`%${termo}%`}
    ORDER BY nome ASC
  `;

  return colaboradores.map((colaborador) => ({
    ...colaborador,
    cpf: decryptCpf(colaborador.cpf),
  }));
}

export async function listarAgendamentos() {
  return prisma.$queryRaw<
    Array<{
      id: number;
      data_entrega: Date;
      id_tarefa: number;
      titulo: string;
      status: string;
      id_colaborador: number;
      colaborador: string;
    }>
  >`
    SELECT
      a.id,
      a.data_entrega,
      t.id AS id_tarefa,
      t.titulo,
      t.status,
      c.id AS id_colaborador,
      c.nome AS colaborador
    FROM agendamentos AS a
    INNER JOIN tarefas AS t ON t.id = a.id_tarefa
    INNER JOIN colaboradores AS c ON c.id = t.id_colaborador
    ORDER BY a.data_entrega ASC
  `;
}
