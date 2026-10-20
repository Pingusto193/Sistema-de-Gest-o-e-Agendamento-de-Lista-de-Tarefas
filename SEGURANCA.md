# Segurança

- Senhas: guardadas só como hash bcrypt.
- CPF: cifrado com AES-256-GCM. A chave fica no `.env` como `CPF_ENCRYPTION_KEY`. Os CPFs do `saep_db.sql` foram cifrados com essa chave, então não troque ela.
- Sessão: o token só é guardado como hash SHA-256 e expira após 30 min sem uso.
- Consultas SQL são parametrizadas.
- Testes: `npm test`.
