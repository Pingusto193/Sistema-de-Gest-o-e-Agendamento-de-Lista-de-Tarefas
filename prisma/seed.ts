import "dotenv/config";
import { prisma } from "../src/db";
import { encryptCpf, hashPassword } from "../src/security";

const seedPassword = process.env.SEED_USER_PASSWORD;
if (!seedPassword || seedPassword.length < 12) {
  throw new Error("Defina SEED_USER_PASSWORD com pelo menos 12 caracteres antes do seed.");
}

const passwordHash = await hashPassword(seedPassword);

const usuarios = [
  { nome: "Usuário Demonstração 1", login: "demo1" },
  { nome: "Usuário Demonstração 2", login: "demo2" },
  { nome: "Usuário Demonstração 3", login: "demo3" },
];

const colaboradores = [
  {
    nome: "Ana Souza",
    cpf: "000.000.000-00",
    email: "ana.souza@example.test",
  },
  {
    nome: "Bruno Lima",
    cpf: "111.111.111-11",
    email: "bruno.lima@example.test",
  },
  {
    nome: "Carla Alves",
    cpf: "222.222.222-22",
    email: "carla.alves@example.test",
  },
];

const tarefas = [
  { titulo: "Preparar relatório", descricao: "Organizar dados do período.", status: "Pendente", email: colaboradores[0].email },
  { titulo: "Revisar cadastro", descricao: "Conferir os dados cadastrados.", status: "Em andamento", email: colaboradores[1].email },
  { titulo: "Enviar proposta", descricao: "Finalizar e enviar a proposta.", status: "Concluída", email: colaboradores[2].email },
];

try {
  for (const usuario of usuarios) {
    await prisma.usuario.upsert({
      where: { login: usuario.login },
      update: { nome: usuario.nome, senhaHash: passwordHash },
      create: { ...usuario, senhaHash: passwordHash },
    });
  }

  const colaboradoresCriados = [];
  for (const colaborador of colaboradores) {
    colaboradoresCriados.push(
      await prisma.colaborador.upsert({
        where: { email: colaborador.email },
        update: {
          nome: colaborador.nome,
          cpfCifrado: encryptCpf(colaborador.cpf),
        },
        create: {
          nome: colaborador.nome,
          email: colaborador.email,
          cpfCifrado: encryptCpf(colaborador.cpf),
        },
      }),
    );
  }

  const agendamentos = [];
  for (const [index, tarefa] of tarefas.entries()) {
    const colaborador = colaboradoresCriados.find(
      (item) => item.email === tarefa.email,
    );
    if (!colaborador) {
      throw new Error(`Colaborador seed não encontrado: ${tarefa.email}`);
    }

    const existente = await prisma.tarefa.findFirst({
      where: { titulo: tarefa.titulo, id_colaborador: colaborador.id },
    });
    const tarefaCriada =
      existente ??
      (await prisma.tarefa.create({
        data: {
          titulo: tarefa.titulo,
          descricao: tarefa.descricao,
          status: tarefa.status,
          id_colaborador: colaborador.id,
        },
      }));

    agendamentos.push({
      tarefaId: tarefaCriada.id,
      dataEntrega: new Date(`2026-11-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`),
    });
  }

  for (const agendamento of agendamentos) {
    const existente = await prisma.agendamento.findFirst({
      where: {
        id_tarefa: agendamento.tarefaId,
        data_entrega: agendamento.dataEntrega,
      },
    });

    if (!existente) {
      await prisma.agendamento.create({
        data: {
          id_tarefa: agendamento.tarefaId,
          data_entrega: agendamento.dataEntrega,
        },
      });
    }
  }

  console.info("Seed concluído: 3 usuários, 3 colaboradores, 3 tarefas e 3 agendamentos.");
} finally {
  await prisma.$disconnect();
}
