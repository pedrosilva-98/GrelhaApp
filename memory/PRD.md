# PRD — Grelha de Avaliação Docente

## Original problem statement
Web app de "Grelhas de Avaliação" para professores em Portugal com JWT auth (React + FastAPI + MongoDB), contas criadas apenas pelo administrador, sem painel admin para ver grelhas dos professores, exportação PDF, e redesign moderno.

## Refactor 2026-01 — Múltiplas turmas por professor
- Admin apenas cria conta (nome, email, palavra-passe). Não gere disciplina/ano/turma.
- Cada professor cria e gere as suas próprias **turmas** (nome interno + disciplina + ano + letra).
- Alunos, instrumentos e ponderações passam a ser por turma (isolados entre turmas).
- Seletor de turma no cabeçalho do professor (dropdown com criar/eliminar).

## Personas
- **Administrador** — cria/elimina contas de professores.
- **Professor** — cria as suas turmas, gere alunos, instrumentos, notas, ponderações, exporta PDF por turma.

## Static requirements
- Cada professor só vê os seus dados (turmas, alunos, instrumentos, notas).
- Ponderações CP/RRP/CM/ER devem somar 100% para guardar.
- Cálculo automático: classificação por instrumento, média por domínio, média final ponderada, nível qualitativo (Muito Bom → Reduzido).

## Implemented
- **Auth**: `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`. JWT Bearer + bcrypt. Admin seed.
- **Admin**: `/api/admin/teachers` (list/create/delete). Delete cascades para todas as turmas.
- **Turmas**: `/api/turmas` CRUD, cascade delete para alunos/instrumentos/ponderacoes.
- **Alunos**: `/api/alunos?turma_id=...` (GET/POST), `/api/alunos/{id}` (DELETE, com auth por turma dono).
- **Instrumentos**: `/api/instrumentos?turma_id=...` + `PUT /notas` + `DELETE`.
- **Ponderacoes**: `/api/ponderacoes?turma_id=...` (GET/PUT, valida soma=100).
- **Frontend**:
  - `/login` split-screen com foto Costa Nova (design "organic & earthy").
  - `/admin` — formulário simplificado (nome, email, password).
  - `/app` — empty state de "criar 1ª turma"; seletor de turma no header; abas Resumo, Turma, Instrumentos, Lançar notas (auto-save 600 ms), Configurar; exportação PDF landscape.
- Tipografia Playfair Display + IBM Plex Sans + JetBrains Mono.

## Backlog
- **P1** — Recuperação/mudança de palavra-passe.
- **P2** — Renomear/editar turma via UI (endpoint PUT já existe).
- **P2** — Observações qualitativas por instrumento; anexos.
- **P2** — Importação CSV de alunos.
- **P2** — Atalhos de teclado (Enter/Tab) na grelha de lançar notas.
- **P3** — Painel admin agregado por disciplina/ano.

## Test credentials
`admin@escola.pt` / `admin123` (auto-seeded from `.env`).
