import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import express, { type NextFunction, type Request, type Response } from "express";
import { prisma } from "./lib/prisma";

type Usuario = { id: number; nome: string; login: string };
type DadosTarefa = { titulo: string; descricao: string; status: string };

const INATIVIDADE_MS = 30 * 60 * 1000;
const STATUS = ["Pendente", "Em andamento", "Concluída"];

const app = express();
app.use(express.urlencoded({ extended: false }));

const esc = (v: unknown) =>
  String(v).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

function pegarToken(req: Request): string | undefined {
  return req.headers.cookie
    ?.split("; ")
    .find((c) => c.startsWith("sessao="))
    ?.slice("sessao=".length);
}

function pagina(titulo: string, corpo: string, usuario?: Usuario) {
  const menu = usuario
    ? `<nav>
        <b>${esc(usuario.nome)}</b> |
        <form method="post" action="/logout" style="display:inline"><button>Sair</button></form>
      </nav><hr>`
    : "";
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titulo)}</title></head>
<body>${menu}<h1>${esc(titulo)}</h1>${corpo}</body></html>`;
}

const mensagemErro = (erro: string) => (erro ? `<p style="color:red">${esc(erro)}</p>` : "");

// ---------- Login ----------
const formLogin = (erro = "") =>
  pagina(
    "Login",
    `${mensagemErro(erro)}
    <form method="post" action="/login">
      <p><label>Usuário <input name="login" required></label></p>
      <p><label>Senha <input name="senha" type="password" required></label></p>
      <button>Entrar</button>
    </form>
    <p><a href="/cadastro">Criar conta</a></p>`,
  );

// Abre a sessão e vai para as tarefas. Devolve false se usuário ou senha estiverem errados.
async function entrar(res: Response, login: string, senha: string) {
  const usuario = await prisma.usuario.findUnique({ where: { login } });
  if (!usuario || !(await bcrypt.compare(senha, usuario.senhaHash))) {
    return false;
  }

  const token = randomBytes(32).toString("base64url");
  await prisma.sessaoUsuario.create({ data: { tokenHash: hashToken(token), usuarioId: usuario.id } });
  res.setHeader("Set-Cookie", `sessao=${token}; HttpOnly; SameSite=Lax; Path=/`);
  res.redirect("/");
  return true;
}

app.get("/login", (_req, res) => {
  res.send(formLogin());
});

app.post("/login", async (req, res) => {
  if (!(await entrar(res, String(req.body.login ?? "").trim(), String(req.body.senha ?? "")))) {
    res.status(401).send(formLogin("Usuário ou senha inválidos."));
  }
});

// ---------- Criar conta ----------
const formCadastro = (erro = "") =>
  pagina(
    "Criar conta",
    `${mensagemErro(erro)}
    <form method="post" action="/cadastro">
      <p><label>Nome <input name="nome" required></label></p>
      <p><label>Usuário <input name="login" required></label></p>
      <p><label>Senha <input name="senha" type="password" minlength="8" required></label></p>
      <button>Criar conta</button>
    </form>
    <p><a href="/login">Já tenho conta</a></p>`,
  );

app.get("/cadastro", (_req, res) => {
  res.send(formCadastro());
});

app.post("/cadastro", async (req, res) => {
  const nome = String(req.body.nome ?? "").trim();
  const login = String(req.body.login ?? "").trim();
  const senha = String(req.body.senha ?? "");

  if (!nome || !login || senha.length < 8) {
    res.status(400).send(formCadastro("Preencha tudo. A senha precisa ter pelo menos 8 caracteres."));
    return;
  }
  if (await prisma.usuario.findUnique({ where: { login } })) {
    res.status(400).send(formCadastro("Esse usuário já existe. Escolha outro."));
    return;
  }
  await prisma.usuario.create({ data: { nome, login, senhaHash: await bcrypt.hash(senha, 12) } });
  await entrar(res, login, senha);
});

app.post("/logout", async (req, res) => {
  const token = pegarToken(req);
  if (token) {
    await prisma.sessaoUsuario.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  res.setHeader("Set-Cookie", "sessao=; Max-Age=0; Path=/");
  res.redirect("/login");
});

// ---------- Tudo abaixo exige login ----------
app.use(async (req: Request, res: Response, next: NextFunction) => {
  const token = pegarToken(req);
  const sessao = token
    ? await prisma.sessaoUsuario.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { usuario: { select: { id: true, nome: true, login: true } } },
      })
    : null;
  if (!sessao) {
    res.redirect("/login");
    return;
  }
  if (Date.now() - sessao.lastActivityAt.getTime() >= INATIVIDADE_MS) {
    await prisma.sessaoUsuario.delete({ where: { id: sessao.id } });
    res.redirect("/login");
    return;
  }
  await prisma.sessaoUsuario.update({ where: { id: sessao.id }, data: { lastActivityAt: new Date() } });
  res.locals.usuario = sessao.usuario;
  next();
});

// ---------- Tarefas ----------
// Toda consulta de tarefa filtra pelo usuário logado, para ninguém mexer na tarefa de outro.
const lerTarefa = (req: Request): DadosTarefa => ({
  titulo: String(req.body.titulo ?? "").trim(),
  descricao: String(req.body.descricao ?? "").trim(),
  status: String(req.body.status ?? ""),
});

const tarefaValida = (t: DadosTarefa) => t.titulo !== "" && t.descricao !== "" && STATUS.includes(t.status);

const idTarefa = (req: Request) => Number.parseInt(String(req.params.id), 10) || 0;

const formTarefa = (acao: string, botao: string, t?: DadosTarefa) =>
  `<form method="post" action="${acao}">
    <p><label>Título <input name="titulo" value="${esc(t?.titulo ?? "")}" required></label></p>
    <p><label>Descrição <input name="descricao" value="${esc(t?.descricao ?? "")}" required></label></p>
    <p><label>Status
      <select name="status">
        ${STATUS.map((s) => `<option${s === t?.status ? " selected" : ""}>${s}</option>`).join("")}
      </select></label></p>
    <button>${botao}</button>
  </form>`;

async function telaTarefas(res: Response, erro = "") {
  const usuario: Usuario = res.locals.usuario;
  const tarefas = await prisma.tarefa.findMany({ where: { usuarioId: usuario.id }, orderBy: { id: "desc" } });
  const linhas = tarefas.map(
    (t) => `<tr>
      <td>${esc(t.titulo)}</td><td>${esc(t.descricao)}</td><td>${esc(t.status)}</td>
      <td>
        <a href="/tarefas/${t.id}">Editar</a>
        <form method="post" action="/tarefas/${t.id}/excluir" style="display:inline"
          onsubmit="return confirm('Excluir esta tarefa?')"><button>Excluir</button></form>
      </td>
    </tr>`,
  );

  res.send(
    pagina(
      "Tarefas",
      `<table border="1" cellpadding="4">
        <tr><th>Título</th><th>Descrição</th><th>Status</th><th></th></tr>
        ${linhas.join("") || `<tr><td colspan="4">Nenhuma tarefa.</td></tr>`}
      </table>
      <h2>Nova tarefa</h2>
      ${mensagemErro(erro)}
      ${formTarefa("/tarefas", "Cadastrar")}`,
      usuario,
    ),
  );
}

const telaEditar = (res: Response, id: number, t: DadosTarefa, erro = "") =>
  res.send(
    pagina(
      "Editar tarefa",
      `${mensagemErro(erro)}${formTarefa(`/tarefas/${id}`, "Salvar", t)}<p><a href="/">Voltar</a></p>`,
      res.locals.usuario,
    ),
  );

const naoEncontrada = (res: Response) =>
  res.status(404).send(pagina("Tarefa não encontrada", `<p><a href="/">Voltar</a></p>`, res.locals.usuario));

app.get("/", (_req, res) => telaTarefas(res));

app.post("/tarefas", async (req, res) => {
  const dados = lerTarefa(req);
  if (!tarefaValida(dados)) {
    res.status(400);
    await telaTarefas(res, "Preencha o título e a descrição.");
    return;
  }
  await prisma.tarefa.create({ data: { ...dados, usuarioId: res.locals.usuario.id } });
  res.redirect("/");
});

app.get("/tarefas/:id", async (req, res) => {
  const tarefa = await prisma.tarefa.findFirst({ where: { id: idTarefa(req), usuarioId: res.locals.usuario.id } });
  if (!tarefa) {
    naoEncontrada(res);
    return;
  }
  telaEditar(res, tarefa.id, tarefa);
});

app.post("/tarefas/:id", async (req, res) => {
  const id = idTarefa(req);
  const dados = lerTarefa(req);
  if (!tarefaValida(dados)) {
    res.status(400);
    telaEditar(res, id, dados, "Preencha o título e a descrição.");
    return;
  }
  const { count } = await prisma.tarefa.updateMany({ where: { id, usuarioId: res.locals.usuario.id }, data: dados });
  if (count === 0) {
    naoEncontrada(res);
    return;
  }
  res.redirect("/");
});

app.post("/tarefas/:id/excluir", async (req, res) => {
  await prisma.tarefa.deleteMany({ where: { id: idTarefa(req), usuarioId: res.locals.usuario.id } });
  res.redirect("/");
});

// ---------- Erros ----------
app.use((erro: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(erro);
  res.status(500).send(
    pagina(
      "Erro",
      `<p style="color:red">Não foi possível acessar o banco de dados. Confira se o PostgreSQL está ligado e o DATABASE_URL no arquivo .env.</p>
      <p><a href="/login">Voltar</a></p>`,
    ),
  );
});

app.listen(3000, (erro) => {
  if (erro) {
    console.error("A porta 3000 já está em uso: o sistema já está aberto em outro terminal. Feche ele ou use http://localhost:3000");
    process.exit(1);
  }
  console.info("Rodando em http://localhost:3000");
});
