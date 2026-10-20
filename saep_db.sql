-- Banco: saep_db (PostgreSQL). Crie o banco antes: CREATE DATABASE saep_db;
-- Senhas (bcrypt) e CPFs (AES-256-GCM) já estão criptografados.
-- Os CPFs só são lidos pelo sistema com a CPF_ENCRYPTION_KEY usada para gerar este script.
-- Usuários demo1, demo2 e demo3: senha Senha@12345

-- Apaga as tabelas antigas, para o script poder rodar de novo
DROP TABLE IF EXISTS "sessoes_usuarios", "agendamentos", "tarefas", "colaboradores", "usuarios" CASCADE;

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "senha" TEXT NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaboradores" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "colaboradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarefas" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "id_colaborador" INTEGER NOT NULL,

    CONSTRAINT "tarefas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamentos" (
    "id" SERIAL NOT NULL,
    "id_tarefa" INTEGER NOT NULL,
    "data_entrega" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes_usuarios" (
    "id" SERIAL NOT NULL,
    "token_hash" TEXT NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "login_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessoes_usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_login_key" ON "usuarios"("login");

-- CreateIndex
CREATE UNIQUE INDEX "colaboradores_email_key" ON "colaboradores"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_usuarios_token_hash_key" ON "sessoes_usuarios"("token_hash");

-- CreateIndex
CREATE INDEX "sessoes_usuarios_usuario_id_idx" ON "sessoes_usuarios"("usuario_id");

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_id_colaborador_fkey" FOREIGN KEY ("id_colaborador") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_id_tarefa_fkey" FOREIGN KEY ("id_tarefa") REFERENCES "tarefas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_usuarios" ADD CONSTRAINT "sessoes_usuarios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO usuarios (nome, login, senha) VALUES
('Usuário Demonstração 1', 'demo1', '$2b$12$oE/wTI6K1xWyO6/cj7owVOl6qbou1j8EKr8s/2v6NY4HZmZGBp02K'),
('Usuário Demonstração 2', 'demo2', '$2b$12$oE/wTI6K1xWyO6/cj7owVOl6qbou1j8EKr8s/2v6NY4HZmZGBp02K'),
('Usuário Demonstração 3', 'demo3', '$2b$12$oE/wTI6K1xWyO6/cj7owVOl6qbou1j8EKr8s/2v6NY4HZmZGBp02K');

INSERT INTO colaboradores (nome, cpf, email) VALUES
('Ana Souza', 'qwrttr454e-IeWFc:U1oAIFHVoLE4k3PPJZCnYw:QbhdFIITO54dYHgydfQ', 'ana.souza@example.test'),
('Bruno Lima', '583QUBuEtseF5Reo:-IeM5nbQZQcIYx9bC-Fnnw:iGRbCXWz4ZlBaq8VCJY', 'bruno.lima@example.test'),
('Carla Alves', 'K_bTZ_rOm3wmkZpQ:zDlSt9WmVlkagz72olUQrg:7I_eLMIeJUu_bXH89pk', 'carla.alves@example.test');

INSERT INTO tarefas (titulo, descricao, status, id_colaborador) VALUES
('Preparar relatório', 'Organizar dados do período.', 'Pendente', 1),
('Revisar cadastro', 'Conferir os dados cadastrados.', 'Em andamento', 2),
('Enviar proposta', 'Finalizar e enviar a proposta.', 'Concluída', 3);

INSERT INTO agendamentos (id_tarefa, data_entrega) VALUES
(1, '2026-11-01 12:00:00'),
(2, '2026-11-02 12:00:00'),
(3, '2026-11-03 12:00:00');

INSERT INTO sessoes_usuarios (token_hash, usuario_id) VALUES
('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 1),
('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 2),
('cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', 3);
