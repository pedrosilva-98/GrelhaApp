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
- **iter 7 (Fase 3 · Fev/2026)** — Perfil do Aluno como modal completo (botão "Olho" na Turma) com 3 tabs: **Dados** (edição de nome/DN/nº processo + mini-stats), **Avaliação** (tabela por domínio + **Radar Chart** com Recharts) e **Educação Especial** (Medidas Universais/Adicionais/Seletivas, DL 54/2018); novo endpoint `PUT /api/alunos/{id}` com `medidas` persistidas por aluno. Exportação **PDF por Aprendizagens** convertida em **PDFs individuais**: clicar no ícone abre um seletor de alunos (com "Selecionar/Desmarcar todos") e gera um PDF por aluno selecionado, com o nome do aluno seguido das percentagens dos domínios (ex.: `Pedro Miguel (CP-89%, RRP-20%)`).
- **iter 6 (Fase 2)** — Semestres (datas + pesos), Meta de Sucesso do Agrupamento, Parâmetros de Observação Direta, campo `semestre` e `observacao_direta` nos Instrumentos, validação de data contra intervalo do semestre, redesign vertical das Questões, filtro por semestre e KPI da meta no Dashboard, endpoint `PUT /api/turmas/{id}/config`.
- **iter 5 (Fase 1)** — Agrupamento por professor; Data de nascimento + Nº de processo para alunos; nomenclatura "Aprendizagens Essenciais" padronizada.
- **iter 4** — MongoDB Atlas; fix escala 0-10; import Excel/CSV das aprendizagens; PDFs por aprendizagem (linhas transpostas).
- **iter 3** — Duplicar turma; renomear; alteração/reset de palavra-passe; importação CSV de alunos; atalhos de teclado em Lançar Notas.
- **iter 2** — Domínios editáveis; edição de instrumentos; notas 0-10.
- **iter 1** — MVP + múltiplas turmas + fix ObjectId.

## Backlog
- **P2** — Vista comparativa entre turmas do mesmo professor.
- **P2** — Mini-gráfico de evolução do aluno entre 1º e 2º Semestre no Perfil.
- **P3** — Recuperação de palavra-passe self-service via email.
- **P3** — Anexos/observações qualitativas por instrumento; backup/exportação JSON.

## Credenciais
`passilva2005@gmail.com` / `!grelhaadmin2005!` (admin, auto-seeded via `/app/backend/.env`).
