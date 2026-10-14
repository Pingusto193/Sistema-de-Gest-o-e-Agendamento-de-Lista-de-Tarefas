# Segurança e consultas

Este projeto usa Prisma com PostgreSQL. Campos `usuarios.senha` armazenam hashes bcrypt; não grave a senha em texto puro. O seed exige `SEED_USER_PASSWORD` e grava apenas o hash.

## Configuração local

Gere uma chave AES de 32 bytes codificada em Base64:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Adicione o resultado ao `.env` como `CPF_ENCRYPTION_KEY="<chave>"`. Mantenha a chave fora do Git e não a troque sem antes migrar os CPFs cifrados. Defina também `SEED_USER_PASSWORD` com pelo menos 12 caracteres antes de executar `npm run db:seed`. Os três usuários de demonstração são `demo1`, `demo2` e `demo3`, todos com a senha indicada nessa variável.

O CPF é cifrado com AES-256-GCM e um IV aleatório por registro; a função de busca por nome o decifra apenas ao retornar os colaboradores. A busca usa `LIKE` parametrizado. O CPF não deve ser incluído em logs.

## Autenticação e consultas

`loginUsuario` devolve `null` para qualquer combinação inválida; a camada HTTP deve responder sempre com a mesma mensagem, por exemplo “usuário ou senha inválidos”. Em caso de sucesso, o token aleatório retornado só é armazenado no banco como hash SHA-256. `obterSessaoAtiva` renova a atividade a cada uso e invalida sessões após 30 minutos de inatividade; `encerrarSessao` encerra a sessão explicitamente.

`buscarColaboradoresPorNome` usa uma query SQL parametrizada e devolve o CPF decifrado. `listarAgendamentos` faz `JOIN` de agendamentos, tarefas e colaboradores e ordena por `data_entrega`.

Depois de aplicar o schema ao banco, use `npm run db:seed` para inserir os dados demonstrativos. Rode `npm test` para validar hashing e cifra/decifra.
