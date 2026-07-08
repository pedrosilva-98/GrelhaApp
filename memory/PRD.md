# PRD — Grelha de Avaliação Docente

## Original problem statement
Web app "Grelha de Avaliação" para professores em Portugal com auth JWT (React + FastAPI + MongoDB), contas criadas apenas pelo administrador, sem painel admin agregado, exportação PDF, e design moderno.

## Personas
- **Administrador** — cria/elimina contas de professores.
- **Professor** — cria as suas turmas (várias), gere alunos, instrumentos, notas, domínios/ponderações por turma, exporta PDF.

## Static requirements
- Cada professor só vê os seus dados (turmas, alunos, instrumentos, notas).
- Domínios são configuráveis por turma (código, nome, ponderação). Soma dos pesos = 100.
- Notas são introduzidas na escala 0-10 em cada questão. A classificação % é ponderada pela cotação de cada questão.
- Cálculo automático: classificação por instrumento, média por domínio, média final ponderada, nível qualitativo.

## Implemented
### Auth
- `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`. JWT Bearer + bcrypt.
- Admin único gerido pelo `.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`). Startup remove admins com email diferente e sincroniza credenciais.

### Admin
- `GET|POST|DELETE /api/admin/teachers[/{id}]` — payload de criação: `{email, password, nome}`.

### Turmas (por professor)
- `GET|POST|PUT|DELETE /api/turmas[/{id}]`. Body: `{disciplina, ano, turma}` (sem "nome interno").
- Cada turma tem embedded `dominios: [{code, nome, peso}]` com 4 defaults (CP/RRP/CM/ER 50/25/10/15).
- `PUT /api/turmas/{id}/dominios` — atualiza lista. Validações: soma=100, códigos únicos e não-vazios, não permite remover domínios referenciados por instrumentos.

### Alunos / Instrumentos / Notas
- `GET|POST /api/alunos?turma_id=…`, `DELETE /api/alunos/{id}`.
- `GET|POST /api/instrumentos?turma_id=…`; `PUT /api/instrumentos/{id}` (edição, com trim de notas para questões removidas); `PUT /api/instrumentos/{id}/notas`; `DELETE /api/instrumentos/{id}`.

### Frontend
- `/login` split-screen (Playfair + IBM Plex + JetBrains).
- `/admin` — form simplificado (nome, email, password).
- `/app` — empty state para 1ª turma; seletor de turma no header (novo/eliminar); abas Resumo, Turma, Instrumentos (agora com **editar**), Lançar notas (0-10 com **nota explicativa**), Configurar (**domínios editáveis** — código, nome, peso, adicionar/remover); exportação PDF landscape.

## Changelog
- **2026-01 iter 4** — Admin creds atualizadas para `passilva2005@gmail.com`. Removida field "nome interno" da turma. Domínios agora editáveis (número, nome, peso). Instrumentos podem ser editados após criação. Notas na escala 0-10 com nota explicativa. Endpoint `/api/ponderacoes` removido (substituído por dominios embedded).
- **2026-01 iter 3** — Múltiplas turmas por professor.
- **2026-01 iter 2** — Fix ObjectId no create teacher.
- **2026-01 iter 1** — MVP inicial.

## Backlog
- **P1** — Recuperação/mudança de palavra-passe pelo professor.
- **P2** — Renomear turma via UI (endpoint `PUT /api/turmas/{id}` já existe).
- **P2** — Importação CSV de alunos.
- **P2** — Atalhos de teclado (Enter/Tab) em Lançar notas.
- **P3** — Vista comparativa entre turmas do mesmo professor.

## Credenciais de teste
`passilva2005@gmail.com` / `!grelhaadmin2005!` (admin, auto-seeded).
