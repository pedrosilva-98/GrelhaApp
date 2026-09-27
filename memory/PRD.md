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
- **iter 13 (Aprendizagens Essenciais geridas pelo admin + relatório de configurações · Set/2026)** — As **Aprendizagens Essenciais** deixam de ser editáveis pelo professor (removida a secção em Configurar); passam a ser geridas pelo **Admin**, por turma, em **Professores → botão "Turmas"** (`TeacherTurmasModal.jsx`): lista as turmas do professor e permite adicionar/editar/remover/importar (Excel/CSV, reaproveitando `CompetenciasImportModal`) as AE de cada uma. O professor continua a poder associá-las a questões dos instrumentos (leitura). Backend: rota `PUT /turmas/{id}/competencias` do professor foi substituída por `PUT /api/admin/turmas/{id}/competencias` (admin, qualquer turma) + `GET /api/admin/teachers/{id}/turmas`. No `TeacherTurmasModal` (Professores → botão "Turmas"), cada turma tem um botão de exportar que gera o PDF (`exportConfiguracoesTurmasPDF` em `pdf.js`) só dessa turma — não há exportação em massa, para evitar descarregar o relatório de todas as turmas de uma vez. (O endpoint `GET /admin/turmas`, que listava todas as turmas de uma vez, foi removido por já não ter uso.)
- **iter 12 (IA por professor, gerida pelo admin · Set/2026)** — A proposta de recuperação com IA passa a ser opcional **por professor**, escolhida pelo admin. `TeacherCreate.ia_ativa` (checkbox "Proposta de recuperação com IA" ao criar a conta) e novo `PUT /api/admin/teachers/{id}/ia` para o admin ativar/desativar depois (badge Ativa/Inativa na lista). `POST /api/ia/proposta-recuperacao` passa a exigir `user.ia_ativa` (403 caso contrário). No frontend, a opção "Com proposta de recuperação" só aparece no quadro "Relatório por aprendizagens" quando `user?.ia_ativa` é verdadeiro (`Teacher.js` só passa a prop `recuperacao` ao `AlunoSelectorModal` nesse caso).
- **iter 11 (proposta de recuperação com IA · Set/2026)** — No quadro "Relatório por aprendizagens": opção **"Com proposta de recuperação"** + **"Número de questões"** (1-10) + "Incluir soluções no PDF"; botão "Gerar propostas" (3 alunos em paralelo), revisão/edição por aluno (editar enunciado/solução, remover questões, gerar de novo) e só depois "Gerar PDFs"/"Enviar por e-mail" ficam ativos. A proposta entra numa página própria do PDF individual (`addPropostaRecuperacao` em `pdf.js`, com `textoParaPdf` a converter símbolos que o jsPDF não desenha). O perfil (`calcPerfilRecuperacao` em `grelha.js`) usa o domínio com pior média (instrumentos que contam para a final + OD) e as AE cuja avaliação **mais recente** (por data do instrumento) é < 60%; alunos sem AE nessas condições ficam "Sem AE < 60%" e sem proposta. Backend: `POST /api/ia/proposta-recuperacao` chama o **Gemini** (`GEMINI_API_KEY`; `GEMINI_MODEL`, por omissão `gemini-3.6-flash`, com modelos de reserva `GEMINI_FALLBACK_MODELS` (lista separada por vírgulas, por omissão `gemini-3.5-flash,gemini-3.1-flash-lite`, experimentados por ordem quando o principal dá 429/503 ou outro erro); retentativas em 429/503; resposta JSON estruturada; limite diário `IA_MAX_POR_DIA`=200 por professor na coleção `ia_uso`). A IA só recebe o resumo de aprendizagem (sem nome, email nem nº de processo). Protótipo/afinação do prompt: `backend/scripts/proposta_ia_prototipo.py`.
- **iter 10 (OD por semestre, perfil e avaliação do instrumento · Set/2026)** — **Observação Direta** passa a ser classificada individualmente por semestre: a página Instrumentos tem uma secção para o 1º e outra para o 2º semestre, e os dados ficam em `turma.od_avaliacoes[parametro_id]["1"|"2"] = {dom, notas}`; `PUT /api/turmas/{id}/od/{parametro_id}` exige `semestre` (1 ou 2). Dados antigos (`{dom, semestre, notas}`) são convertidos por `normalize_od` ao ler (uma entrada antiga "ambos" passa a existir nos dois semestres). **Perfil do aluno → Avaliação**: nova tabela com os parâmetros de OD (1º e 2º semestre) e o respetivo gráfico de teia. A **avaliação quantitativa de cada instrumento** (Lançar notas) deixa de somar as cotações de todas as questões: pondera as médias dos domínios pelas ponderações da turma, como a avaliação final (`calcClassifInstrumento`/`ponderarDominios` em `grelha.js`).
- **iter 9b (envio de email via relay Google Apps Script · Set/2026)** — O Render (plano gratuito) bloqueia SMTP (portas 25/465/587), por isso o envio deixou de usar SMTP/Resend. `POST /api/relatorios/enviar-email` faz agora um POST HTTPS para um web app do Google Apps Script (`backend/apps_script_relay.gs`), publicado numa conta Gmail dedicada da app, que envia o email com o PDF em anexo via `MailApp` (quota ~100 destinatários/dia). Requer `APPS_SCRIPT_URL` e `APPS_SCRIPT_SECRET` no ambiente do backend (sem elas devolve 503). O remetente é sempre a conta da app; o rodapé indica o professor e pede para não responder. Removidos o "Configurar envio de email" por professor, `FERNET_KEY` e os endpoints `/auth/email-config`; o arranque apaga o campo antigo `smtp_app_password_enc`.
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
