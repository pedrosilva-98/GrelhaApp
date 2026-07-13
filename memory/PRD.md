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
- **iter 6 (Fase 2 · Fev/2026)** — Semestres (datas + pesos, soma 100%) e Meta de Sucesso do Agrupamento por turma; Parâmetros de Observação Direta (rubrica editável para trabalhos individuais/grupo); Instrumentos ganharam campo `semestre` (1/2) e secção `observacao_direta` (nota 0-10 por parâmetro + domínio associado); validação de data contra o intervalo do semestre selecionado (backend + frontend); Redesign das Questões em cartões verticais com Nº, Domínio, Cotação, Aprendizagem (cinza quando vazio); Dashboard com filtro Todo o ano / 1º / 2º Semestre e KPI Média com hint da meta (verde ≥ meta / vermelho abaixo); novo endpoint `PUT /api/turmas/{id}/config`.
- **iter 5 (Fase 1)** — Agrupamento por professor; Data de nascimento + Nº de processo para alunos; nomenclatura "Aprendizagens Essenciais" padronizada.
- **iter 4** — MongoDB Atlas; fix escala 0-10; import Excel/CSV das aprendizagens; PDFs por aprendizagem (linhas transpostas).
- **iter 3** — Duplicar turma; renomear; alteração/reset de palavra-passe; importação CSV de alunos; atalhos de teclado em Lançar Notas.
- **iter 2** — Domínios editáveis; edição de instrumentos; notas 0-10.
- **iter 1** — MVP + múltiplas turmas + fix ObjectId.

## Backlog
- **P1 (Fase 3)** — Perfil do Aluno (botão "Olho" na Turma): dados do aluno, avaliação por domínio, Radar Chart (Recharts) e tabela de Educação Especial (medidas Universais/Adicionais/Seletivas).
- **P1 (Fase 3)** — PDFs individuais por Aprendizagem Essencial: seletor de alunos → um PDF por aluno com percentagens de domínio no nome (ex.: "Pedro Miguel (CP-89%, RRP-20%)").
- **P2** — Vista comparativa entre turmas do mesmo professor.
- **P3** — Recuperação de palavra-passe self-service via email.
- **P3** — Anexos/observações qualitativas por instrumento; backup/exportação JSON.

## Credenciais
`passilva2005@gmail.com` / `!grelhaadmin2005!` (admin, auto-seeded via `/app/backend/.env`).
