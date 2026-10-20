import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./db";
import { decryptCpf, encryptCpf, hashPassword, verifyPassword } from "./security";

const INATIVIDADE_MS = 30 * 60 * 1000;

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function loginUsuario(login: string, senha: string) {
  const usuario = await prisma.usuario.findUnique({ where: { login } });

  if (!usuario || !(await verifyPassword(senha, usuario.senhaHash))) {
    return null;
  }

  const token = randomBytes(32).toString("base64url");
  await prisma.sessaoUsuario.create({
    data: { tokenHash: hashToken(token), usuarioId: usuario.id },
  });

  return { token, usuario: { id: usuario.id, nome: usuario.nome, login: usuario.login } };
}

// Devolve null se o login já estiver em uso.
export async function cadastrarUsuario(nome: string, login: string, senha: string) {
  if (await prisma.usuario.findUnique({ where: { login } })) {
    return null;
  }

  return prisma.usuario.create({
    data: { nome, login, senhaHash: await hashPassword(senha) },
  });
}

export async function obterSessaoAtiva(token: string) {
  const sessao = await prisma.sessaoUsuario.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { usuario: { select: { id: true, nome: true, login: true } } },
  });

  if (!sessao) {
    return null;
  }

  if (Date.now() - sessao.lastActivityAt.getTime() >= INATIVIDADE_MS) {
    await prisma.sessaoUsuario.delete({ where: { id: sessao.id } });
    return null;
  }

  await prisma.sessaoUsuario.update({
    where: { id: sessao.id },
    data: { lastActivityAt: new Date() },
  });

  return { usuario: sessao.usuario, loginAt: sessao.loginAt };
}

export async function encerrarSessao(token: string) {
  await prisma.sessaoUsuario.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export async function buscarColaboradoresPorNome(nome: string) {
  const termo = nome.trim();

  const colaboradores = await prisma.$queryRaw<
    { id: number; nome: string; cpf: string; email: string }[]
  >`
    SELECT id, nome, cpf, email
    FROM colaboradores
    WHERE nome ILIKE ${`%${termo}%`}
    ORDER BY nome
  `;

  return colaboradores.map((c) => ({ ...c, cpf: decryptCpf(c.cpf) }));
}

export async function listarAgendamentos() {
  return prisma.$queryRaw<
    { id: number; data_entrega: Date; id_tarefa: number; titulo: string; descricao: string; status: string; id_colaborador: number; colaborador: string; email: string }[]
  >`
    SELECT a.id, a.data_entrega, t.id AS id_tarefa, t.titulo, t.descricao, t.status,
           c.id AS id_colaborador, c.nome AS colaborador, c.email
    FROM agendamentos AS a
    INNER JOIN tarefas AS t ON t.id = a.id_tarefa
    INNER JOIN colaboradores AS c ON c.id = t.id_colaborador
    ORDER BY a.data_entrega
  `;
}

export async function cadastrarColaborador(nome: string, cpf: string, email: string) {
  return prisma.colaborador.create({
    data: { nome, email, cpfCifrado: encryptCpf(cpf) },
  });
}

export async function listarTarefas() {
  return prisma.tarefa.findMany({
    include: { colaborador: true },
    orderBy: { id: "desc" },
  });
}

export async function cadastrarTarefa(
  titulo: string,
  descricao: string,
  status: string,
  idColaborador: number,
  dataEntrega: Date,
) {
  const colaborador = await prisma.colaborador.findUnique({ where: { id: idColaborador } });
  if (!colaborador) {
    throw new Error("Colaborador não encontrado.");
  }

  return prisma.tarefa.create({
    data: {
      titulo,
      descricao,
      status,
      id_colaborador: idColaborador,
      agendamentos: { create: { data_entrega: dataEntrega } },
    },
  });
}
