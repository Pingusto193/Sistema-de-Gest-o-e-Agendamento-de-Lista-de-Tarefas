import express, { type NextFunction, type Request, type Response } from "express";
import {
  buscarColaboradoresPorNome,
  cadastrarColaborador,
  cadastrarTarefa,
  cadastrarUsuario,
  encerrarSessao,
  listarAgendamentos,
  listarTarefas,
  loginUsuario,
  obterSessaoAtiva,
} from "../src/services";

type Usuario = { id: number; nome: string; login: string };

const app = express();
app.use(express.urlencoded({ extended: false }));

const esc = (v: unknown) =>
  String(v).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const data = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "UTC" });

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
        <a href="/">Painel</a> |
        <a href="/colaboradores">Colaboradores</a> |
        <a href="/tarefas">Tarefas</a> |
        <a href="/agendamento">Agendamento</a> |
        <form method="post" action="/logout" style="display:inline"><button>Sair</button></form>
      </nav><hr>`
    : "";
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titulo)}</title></head>
<body>${menu}<h1>${esc(titulo)}</h1>${corpo}</body></html>`;
}

const tabela = (cabecalho: string[], linhas: string[]) =>
  `<table border="1" cellpadding="4">
    <tr>${cabecalho.map((c) => `<th>${c}</th>`).join("")}</tr>
    ${linhas.join("") || `<tr><td colspan="${cabecalho.length}">Nenhum registro.</td></tr>`}
  </table>`;

const linha = (...colunas: unknown[]) =>
  `<tr>${colunas.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`;

// ---------- Login ----------
const formLogin = (erro = "") =>
  pagina(
    "Login",
    `${erro ? `<p style="color:red">${esc(erro)}</p>` : ""}
    <form method="post" action="/login">
      <p><label>Usuário <input name="login" required></label></p>
      <p><label>Senha <input name="senha" type="password" required></label></p>
      <button>Entrar</button>
    </form>
    <p><a href="/cadastro">Criar conta</a></p>`,
  );

// Abre a sessão e vai para o painel. Devolve false se usuário ou senha estiverem errados.
async function entrar(res: Response, login: string, senha: string) {
  const resultado = await loginUsuario(login, senha);
  if (!resultado) {
    return false;
  }
  res.setHeader("Set-Cookie", `sessao=${resultado.token}; HttpOnly; SameSite=Lax; Path=/`);
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
    `${erro ? `<p style="color:red">${esc(erro)}</p>` : ""}
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
  if (!(await cadastrarUsuario(nome, login, senha))) {
    res.status(400).send(formCadastro("Esse usuário já existe. Escolha outro."));
    return;
  }
  await entrar(res, login, senha);
});

app.post("/logout", async (req, res) => {
  const token = pegarToken(req);
  if (token) {
    await encerrarSessao(token);
  }
  res.setHeader("Set-Cookie", "sessao=; Max-Age=0; Path=/");
  res.redirect("/login");
});

// ---------- Tudo abaixo exige login ----------
app.use(async (req: Request, res: Response, next: NextFunction) => {
  const token = pegarToken(req);
  const sessao = token ? await obterSessaoAtiva(token) : null;
  if (!sessao) {
    res.redirect("/login");
    return;
  }
  res.locals.usuario = sessao.usuario;
  next();
});

// ---------- Painel ----------
app.get("/", (_req, res) => {
  const usuario: Usuario = res.locals.usuario;
  res.send(
    pagina(
      "Painel",
      `<p>Olá, ${esc(usuario.nome)}!</p>
      <ul>
        <li><a href="/colaboradores">Colaboradores</a></li>
        <li><a href="/tarefas">Tarefas</a></li>
        <li><a href="/agendamento">Agendamento</a></li>
      </ul>`,
      usuario,
    ),
  );
});

// ---------- Colaboradores ----------
async function telaColaboradores(req: Request, res: Response, erro = "") {
  const busca = String(req.query.busca ?? "");
  const lista = await buscarColaboradoresPorNome(busca);

  res.send(
    pagina(
      "Colaboradores",
      `<form method="get">
        <input name="busca" placeholder="Buscar por nome" value="${esc(busca)}">
        <button>Buscar</button>
      </form>
      ${tabela(["Nome", "CPF", "E-mail"], lista.map((c) => linha(c.nome, c.cpf, c.email)))}
      <h2>Novo colaborador</h2>
      ${erro ? `<p style="color:red">${esc(erro)}</p>` : ""}
      <form method="post">
        <p><label>Nome <input name="nome" required></label></p>
        <p><label>CPF <input name="cpf" required></label></p>
        <p><label>E-mail <input name="email" type="email" required></label></p>
        <button>Cadastrar</button>
      </form>`,
      res.locals.usuario,
    ),
  );
}

app.get("/colaboradores", (req, res) => telaColaboradores(req, res));

app.post("/colaboradores", async (req, res) => {
  try {
    await cadastrarColaborador(
      String(req.body.nome).trim(),
      String(req.body.cpf).trim(),
      String(req.body.email).trim(),
    );
    res.redirect("/colaboradores");
  } catch {
    await telaColaboradores(req, res, "Não foi possível cadastrar (e-mail já existe?).");
  }
});

// ---------- Tarefas ----------
async function telaTarefas(_req: Request, res: Response, erro = "") {
  const [tarefas, colaboradores] = await Promise.all([
    listarTarefas(),
    buscarColaboradoresPorNome(""),
  ]);
  const opcoes = colaboradores
    .map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`)
    .join("");

  res.send(
    pagina(
      "Tarefas",
      `${tabela(
        ["Título", "Descrição", "Status", "Responsável"],
        tarefas.map((t) => linha(t.titulo, t.descricao, t.status, t.colaborador.nome)),
      )}
      <h2>Nova tarefa</h2>
      ${erro ? `<p style="color:red">${esc(erro)}</p>` : ""}
      <form method="post">
        <p><label>Título <input name="titulo" required></label></p>
        <p><label>Descrição <input name="descricao" required></label></p>
        <p><label>Status
          <select name="status">
            <option>Pendente</option><option>Em andamento</option><option>Concluída</option>
          </select></label></p>
        <p><label>Responsável
          <select name="colaborador" required><option value="">Selecione</option>${opcoes}</select></label></p>
        <p><label>Data de entrega <input name="data" type="date" required></label></p>
        <button>Cadastrar</button>
      </form>`,
      res.locals.usuario,
    ),
  );
}

app.get("/tarefas", (req, res) => telaTarefas(req, res));

app.post("/tarefas", async (req, res) => {
  try {
    await cadastrarTarefa(
      String(req.body.titulo).trim(),
      String(req.body.descricao).trim(),
      String(req.body.status),
      Number(req.body.colaborador),
      new Date(`${req.body.data}T12:00:00Z`),
    );
    res.redirect("/tarefas");
  } catch {
    await telaTarefas(req, res, "Escolha um colaborador cadastrado e uma data válida.");
  }
});

// ---------- Agendamento ----------
app.get("/agendamento", async (_req, res) => {
  const lista = await listarAgendamentos();

  res.send(
    pagina(
      "Agendamento",
      tabela(
        ["Entrega", "Tarefa", "Descrição", "Status", "Responsável", "E-mail"],
        lista.map((a) =>
          linha(data(a.data_entrega), a.titulo, a.descricao, a.status, a.colaborador, a.email),
        ),
      ),
      res.locals.usuario,
    ),
  );
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
