# PRD — Grelha de Avaliação Docente

## Original problem statement
Web app "Grelha de Avaliação" para professores em Portugal com auth JWT (React + FastAPI + MongoDB), contas criadas apenas pelo administrador, sem painel admin agregado, exportação PDF, e design moderno.

## Personas
- **Administrador** — cria/elimina contas de professores, redefine palavras-passe.
- **Professor** — cria as suas turmas (várias), gere alunos, instrumentos, notas, domínios/ponderações por turma, exporta PDF, altera a sua palavra-passe.

## Static requirements
- Cada professor só vê os seus dados.
- Domínios de avaliação configuráveis por turma (código, nome, ponderação, soma=100).
- Notas na escala 0-10 em cada questão; a classificação % é ponderada pela cotação.
- Cálculo automático: classificação por instrumento, médias por domínio, média final ponderada, nível qualitativo.

## Implemented
### Auth
- `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`.
- `/api/auth/change-password` (`{current_password, new_password}`).
- JWT Bearer + bcrypt. Admin único gerido pelo `.env`.

### Admin
- `GET|POST|DELETE /api/admin/teachers[/{id}]`.
- `POST /api/admin/teachers/{id}/reset-password` (`{new_password}`) — admin gera nova PW e partilha.

### Turmas (por professor)
- `GET|POST|PUT|DELETE /api/turmas[/{id}]`. Body de criação: `{disciplina, ano, turma}` (sem "nome interno").
- `POST /api/turmas/{id}/duplicate` — duplica estrutura (disciplina/ano + domínios; SEM alunos/instrumentos). Adiciona " (cópia)" ao turma.
- `PUT /api/turmas/{id}/dominios` — domínios editáveis (adicionar/remover/renomear/pesos).

### Alunos / Instrumentos / Notas
- `GET|POST /api/alunos?turma_id=…`, `DELETE /api/alunos/{id}`.
- `POST /api/alunos/bulk?turma_id=…` — importação em massa.
- `GET|POST|PUT|DELETE /api/instrumentos[/{id}]` (edição pós-criação com trim de notas para questões removidas).
- `PUT /api/instrumentos/{id}/notas`.

### Frontend
- `/login` split-screen (Playfair + IBM Plex + JetBrains). "Esqueci-me da palavra-passe" mostra instruções para contactar admin.
- `/admin` — form (nome/email/password), botão de eliminar e botão de redefinir palavra-passe (`reset-teacher-{id}`).
- `/app`:
  - Empty state para 1ª turma.
  - Header com **seletor de turma** (renomear, duplicar, nova, eliminar).
  - Menu de utilizador (**Alterar palavra-passe**, Sair).
  - Abas: Resumo, Turma (adicionar aluno + **Importar CSV**), Instrumentos (criar + **editar**), Lançar notas (0-10 + **atalhos de teclado** Enter/Shift+Enter/Tab/Arrows), Configurar (domínios editáveis).
- Exportação PDF landscape.

## Changelog
- **iter 9 (escala 0-20, envio de relatórios por email, admin · Set/2026)** — Filtro do Resumo passa a "1º/2º Semestre/Anual" (antes "Todo o ano" em 1º lugar); a Meta de sucesso compara agora com a **Taxa de sucesso**, não com a Média da turma. Instrumentos de avaliação: Lançar notas mostra a avaliação quantitativa por domínio junto da global; a avaliação qualitativa usa os rótulos ("Muito Bom"…) em vez do nível 1-5. Novos tipos de instrumento **Rubricas** e **Trabalhos de Pesquisa e Relatórios** (contam para a final); "Avaliação Formativa" e "Avaliação de Diagnóstico" deixam de contar para a avaliação final (continuam a admitir classificações/relatórios) — ver `TIPOS_SEM_NOTA_FINAL`/`instsParaFinal` em `grelha.js`. Turmas de **10º/11º/12º ano** passam a usar escala **0-20** sem avaliação qualitativa em todos os ecrãs e PDFs (`isEscala20`/`formatAvaliacao`). Alunos passam a ter **email** (manual, importação CSV/Excel e perfil). Relatório por Aprendizagens: botão **Enviar por e-mail** ao lado de Gerar PDF (novo endpoint `POST /api/relatorios/enviar-email`); relatório individual passa a ter o título "Situação atual" antes do nome do aluno.
- **iter 9b (envio de email por professor · Set/2026)** — Trocado o envio de email de Resend para **SMTP por professor** (`smtplib`): cada professor configura a sua própria palavra-passe de aplicação (Gmail/Outlook/Yahoo — auto-deteta o servidor SMTP pelo domínio do email de login) em **"Configurar envio de email"** no menu do utilizador, e os relatórios saem sempre do email do próprio professor, não de uma conta única do sistema. A palavra-passe de aplicação fica cifrada na BD (`smtp_app_password_enc`, `cryptography.fernet`) — nunca é devolvida pela API. Novos endpoints `GET/PUT/DELETE /api/auth/email-config`. Requer a variável `FERNET_KEY` (uma chave gerada uma única vez) no ambiente do backend; sem ela, guardar/enviar devolve 503. Motivo da troca: o modo de teste do Resend só permite enviar para o email da própria conta Resend, e o professor não tem domínio próprio para verificar. Admin: criação de professor passa a incluir **Ano Letivo** e **Máx. turmas** (`TeacherCreate.ano_letivo/max_turmas`); a criação/duplicação de turma é bloqueada ao atingir o limite.
- **iter 8 (OD refactor + Excel import · Fev/2026)** — Observação Direta movida para fora do formulário de instrumento: aparece agora como painel próprio na página **Instrumentos de avaliação**, com uma linha por parâmetro (nome + Domínio + contagem de notas + botão "Classificar"). O modal de classificação permite escolher o Domínio, o Semestre (opcional) e atribuir nota 0-10 a cada aluno da turma. Em Configurar, o subtítulo "Trabalhos individuais ou de grupo" foi removido e o selector de domínio saiu da linha do parâmetro (linha inteira só para o nome). Novo endpoint `PUT /api/turmas/{id}/od/{parametro_id}`; os cálculos de média (Dashboard, Perfil e PDFs) passam a incluir as notas de OD via `turma.od_avaliacoes`. Importação de alunos aceita agora **Excel (.xlsx)** além de CSV, com deteção automática das colunas Nome / Data Nascimento / Nº Processo e conversão de datas PT (DD/MM/AAAA) e datas em série do Excel para ISO.
- **iter 7 (Fase 3)** — Perfil do Aluno (botão "Olho") com tabs Dados / Avaliação (Radar) / Educação Especial; endpoint `PUT /api/alunos/{id}` com `medidas`; PDFs individuais por aprendizagem com nome + percentagens dos domínios.
- **iter 6 (Fase 2)** — Semestres, Meta de sucesso, Parâmetros OD, campo `semestre` nos Instrumentos, filtro de semestre no Dashboard, endpoint `PUT /api/turmas/{id}/config`.
- **iter 5 (Fase 1)** — Agrupamento por professor; DN + Nº Processo por aluno; nomenclatura "Aprendizagens Essenciais".
- **iter 4** — MongoDB Atlas; escala 0-10; import Excel das aprendizagens; PDFs transpostos.
- **iter 3** — Duplicar/renomear turma; alteração/reset de palavra-passe; import CSV; atalhos de teclado.
- **iter 2** — Domínios editáveis; edição de instrumentos; notas 0-10.
- **iter 1** — MVP + múltiplas turmas + fix ObjectId.

## Backlog
- **P2** — Vista comparativa entre turmas do mesmo professor.
- **P2** — Mini-gráfico de evolução 1º ↔ 2º Semestre no Perfil do Aluno.
- **P3** — Recuperação de palavra-passe self-service via email.
- **P3** — Anexos/observações qualitativas por instrumento; backup/exportação JSON.
- **Cleanup** — Remover campo dead-code `instrumento.observacao_direta` do backend (após 1 release estável).

## Credenciais
`passilva2005@gmail.com` / `!grelhaadmin2005!` (admin, auto-seeded via `/app/backend/.env`).
