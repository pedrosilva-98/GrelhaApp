# PRD — Grelha de Avaliação Docente

## Original problem statement
Desenvolver web app com base num componente React de "Grelhas de Avaliação" para professores em Portugal.
Requisitos adicionais do utilizador:
- Autenticação (JWT email/password, stack React + FastAPI + MongoDB).
- Contas criadas apenas pelo administrador.
- Sem painel admin para ver grelhas de todos os professores (apenas dashboard do professor).
- Exportação de grelha em PDF.
- Redesign moderno e distintivo (não manter o layout minimalista original).

## Personas
- **Administrador** — cria e faz gestão das contas dos professores.
- **Professor** — introduz alunos, cria instrumentos de avaliação, lança notas, ajusta ponderações, exporta grelha em PDF.

## Core (static) requirements
- Cada professor só vê os seus dados.
- Ponderações dos domínios (CP, RRP, CM, ER) devem somar 100%.
- Cálculo automático de: classificação por instrumento, média por domínio, média final ponderada, nível qualitativo.

## Implemented (2026-01)
- Backend FastAPI: `/api/auth/*`, `/api/admin/teachers`, `/api/alunos`, `/api/instrumentos`, `/api/ponderacoes` com JWT bearer + bcrypt + Mongo indexes.
- Admin seed via env (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).
- Frontend React (react-router):
  - `/login` — split-screen com foto Costa Nova (design "organic & earthy").
  - `/admin` — lista, cria, elimina professores.
  - `/app` — abas Resumo, Turma, Instrumentos, Lançar notas, Configurar.
- Tipografia Playfair Display + IBM Plex Sans + JetBrains Mono.
- Auto-guardar de notas (debounce 600 ms).
- Exportação PDF landscape com `jspdf` + `jspdf-autotable`.
- Badges qualitativos (Muito Bom / Bom / Suficiente / Insuficiente / Reduzido).

## Backlog
- **P1** — Suporte a múltiplas turmas por professor.
- **P1** — Recuperação de palavra-passe / mudança pelo próprio professor.
- **P2** — Anexos / observações qualitativas por instrumento.
- **P2** — Estatísticas comparativas entre períodos.
- **P2** — Importação de alunos via CSV.
- **P3** — Painel administrador com vista agregada por turma / disciplina.

## Next tasks
1. Testes end-to-end via testing agent (login, admin cria professor, professor completa fluxo, PDF).
2. Fix de eventuais bugs reportados.
