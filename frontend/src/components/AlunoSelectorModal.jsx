import { useState } from "react";
import { X, Users, FileText, Mail, CheckSquare, Square, Sparkles, Loader2, ChevronDown, Trash2, RefreshCw } from "lucide-react";

const MAX_QUESTOES = 10;
const PARALELISMO = 3;

export default function AlunoSelectorModal({
    alunos,
    title = "Selecionar alunos",
    subtitle,
    confirmLabel = "Gerar",
    onClose,
    onConfirm,
    secondaryLabel,
    onSecondaryConfirm,
    recuperacao, // { gerar: async (aluno, n) => ({ questoes } | { semDados: true }) } — ativa a proposta de recuperação
}) {
    const [selected, setSelected] = useState(new Set(alunos.map((a) => a.id)));
    const [busy, setBusy] = useState(false);
    const [busySecondary, setBusySecondary] = useState(false);
    const [error, setError] = useState("");
    const allSelected = selected.size === alunos.length;

    const [comProposta, setComProposta] = useState(false);
    const [numQuestoes, setNumQuestoes] = useState("5");
    const [incluirSolucoes, setIncluirSolucoes] = useState(false);
    const [propostas, setPropostas] = useState({}); // alunoId -> { estado, questoes, erro }
    const [gerando, setGerando] = useState(false);
    const [expandido, setExpandido] = useState(null);

    const n = parseInt(numQuestoes, 10);
    const nValido = Number.isInteger(n) && n >= 1 && n <= MAX_QUESTOES;
    const chosen = alunos.filter((a) => selected.has(a.id));
    const porGerar = chosen.filter((a) => !["ok", "sem_dados"].includes(propostas[a.id]?.estado));
    const bloqueado = comProposta && (gerando || porGerar.length > 0);

    function toggle(id) {
        setSelected((s) => {
            const next = new Set(s);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }
    function toggleAll() {
        setSelected(allSelected ? new Set() : new Set(alunos.map((a) => a.id)));
    }

    async function gerarPara(lista) {
        if (!nValido || !lista.length) return;
        setGerando(true);
        setError("");
        const fila = [...lista];
        async function worker() {
            while (fila.length) {
                const a = fila.shift();
                setPropostas((p) => ({ ...p, [a.id]: { estado: "a_gerar", questoes: p[a.id]?.questoes || [] } }));
                try {
                    const res = await recuperacao.gerar(a, n);
                    setPropostas((p) => ({
                        ...p,
                        [a.id]: res.semDados ? { estado: "sem_dados", questoes: [] } : { estado: "ok", questoes: res.questoes },
                    }));
                } catch (e) {
                    setPropostas((p) => ({
                        ...p,
                        [a.id]: { estado: "erro", questoes: [], erro: e?.response?.data?.detail || e?.message || "Erro ao gerar." },
                    }));
                }
            }
        }
        await Promise.all(Array.from({ length: PARALELISMO }, worker));
        setGerando(false);
    }

    function editarQuestao(alunoId, idx, campo, valor) {
        setPropostas((p) => ({
            ...p,
            [alunoId]: { ...p[alunoId], questoes: p[alunoId].questoes.map((q, i) => (i === idx ? { ...q, [campo]: valor } : q)) },
        }));
    }
    function removerQuestao(alunoId, idx) {
        setPropostas((p) => ({
            ...p,
            [alunoId]: { ...p[alunoId], questoes: p[alunoId].questoes.filter((_, i) => i !== idx) },
        }));
    }

    function opcoes() {
        if (!comProposta) return {};
        const out = {};
        for (const a of chosen) {
            const p = propostas[a.id];
            if (p?.estado === "ok" && p.questoes.length) out[a.id] = { questoes: p.questoes };
        }
        return { propostas: out, incluirSolucoes };
    }

    async function confirm() {
        setBusy(true);
        try {
            await onConfirm(chosen, opcoes());
            onClose();
        } finally { setBusy(false); }
    }

    async function confirmSecondary() {
        setError("");
        const comEmail = chosen.filter((a) => (a.email || "").trim());
        if (!comEmail.length) {
            setError("Nenhum dos alunos selecionados tem email registado. Adicione o email em Turma ou no perfil do aluno.");
            return;
        }
        setBusySecondary(true);
        try {
            await onSecondaryConfirm(comEmail, opcoes());
            onClose();
        } catch (e) {
            setError(e?.response?.data?.detail || e?.message || "Erro ao enviar email.");
        } finally { setBusySecondary(false); }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className={`card-surface w-full ${recuperacao ? "max-w-2xl" : "max-w-lg"} max-h-[90vh] flex flex-col overflow-hidden anim-in`} onClick={(e) => e.stopPropagation()} data-testid="aluno-selector-modal">
                <div className="p-6 border-b border-crisp">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="text-[11px] uppercase tracking-[0.25em] text-brand-sage mb-1 flex items-center gap-2">
                                <Users size={12} /> Alunos
                            </div>
                            <h2 className="font-serif text-xl text-brand-forest">{title}</h2>
                            {subtitle && <p className="text-sm text-brand-charcoal/70 mt-1">{subtitle}</p>}
                        </div>
                        <button onClick={onClose} className="text-brand-sage hover:text-brand-charcoal">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {recuperacao && (
                    <div className="px-6 py-3 border-b border-crisp bg-page/50 space-y-3" data-testid="recuperacao-opcoes">
                        <label className="flex items-center gap-2 text-sm text-brand-charcoal cursor-pointer">
                            <input
                                type="checkbox"
                                data-testid="com-proposta"
                                checked={comProposta}
                                onChange={(e) => setComProposta(e.target.checked)}
                                className="accent-[#2C4A3B]"
                            />
                            <Sparkles size={14} className="text-brand-ochre" />
                            <span className="font-medium">Com proposta de recuperação</span>
                            <span className="text-[11px] text-brand-sage">(gerada por IA)</span>
                        </label>
                        {comProposta && (
                            <div className="space-y-3">
                                <div className="flex items-end gap-4 flex-wrap">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Número de questões</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={MAX_QUESTOES}
                                            data-testid="num-questoes"
                                            className={`input-forest w-24 ${nValido ? "" : "border-[#9E3921]"}`}
                                            value={numQuestoes}
                                            onChange={(e) => setNumQuestoes(e.target.value)}
                                        />
                                    </div>
                                    <label className="flex items-center gap-2 text-xs text-brand-charcoal/80 cursor-pointer pb-2.5">
                                        <input type="checkbox" checked={incluirSolucoes} onChange={(e) => setIncluirSolucoes(e.target.checked)} className="accent-[#2C4A3B]" />
                                        Incluir soluções no PDF
                                    </label>
                                    <button
                                        type="button"
                                        data-testid="gerar-propostas"
                                        onClick={() => gerarPara(porGerar)}
                                        disabled={gerando || !nValido || porGerar.length === 0}
                                        className="btn-primary !py-2 text-sm ml-auto"
                                    >
                                        {gerando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                        {gerando ? "A gerar..." : `Gerar propostas (${porGerar.length})`}
                                    </button>
                                </div>
                                {!nValido && <div className="text-xs text-[#9E3921]">Indique um número entre 1 e {MAX_QUESTOES}.</div>}
                                <div className="text-[11px] text-brand-charcoal/60 leading-relaxed">
                                    A IA recebe apenas o resumo de aprendizagem (sem nome, email nem nº de processo). Reveja e edite as questões antes de gerar os PDFs ou enviar. Só entram alunos com aprendizagens essenciais abaixo de 60% na avaliação mais recente.
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="px-6 py-3 border-b border-crisp flex items-center justify-between text-sm">
                    <button data-testid="toggle-all-alunos" onClick={toggleAll} className="flex items-center gap-2 text-brand-forest hover:text-brand-forest-hover">
                        {allSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                        {allSelected ? "Desmarcar todos" : "Selecionar todos"}
                    </button>
                    <span className="text-xs text-brand-sage tabular-nums" data-testid="selection-count">
                        {selected.size} / {alunos.length} selecionado(s)
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                    {alunos.length === 0 ? (
                        <div className="text-center text-brand-sage py-10 text-sm">Sem alunos na turma.</div>
                    ) : (
                        <ul className="space-y-1">
                            {alunos.map((a, i) => {
                                const on = selected.has(a.id);
                                const p = propostas[a.id];
                                return (
                                    <li key={a.id}>
                                        <div className={`rounded-md border transition-colors ${on ? "border-brand-forest bg-page" : "border-crisp hover:bg-page"}`}>
                                            <div className="flex items-center">
                                                <button
                                                    data-testid={`select-aluno-${a.id}`}
                                                    onClick={() => toggle(a.id)}
                                                    className="flex-1 min-w-0 text-left flex items-center gap-3 px-3 py-2"
                                                >
                                                    {on ? <CheckSquare size={16} className="text-brand-forest shrink-0" /> : <Square size={16} className="text-brand-sage shrink-0" />}
                                                    <span className="text-xs font-mono text-brand-sage w-6 tabular-nums shrink-0">{String(i + 1).padStart(2, "0")}</span>
                                                    <span className="text-sm text-brand-charcoal truncate">{a.nome}</span>
                                                    {onSecondaryConfirm && (
                                                        <span className={`ml-auto text-[10px] truncate ${a.email ? "text-brand-sage" : "text-brand-sage/50 italic"}`}>
                                                            {a.email || "sem email"}
                                                        </span>
                                                    )}
                                                </button>
                                                {comProposta && p && (
                                                    <div className="pr-3 shrink-0 text-xs" data-testid={`proposta-estado-${a.id}`}>
                                                        {p.estado === "a_gerar" && (
                                                            <span className="flex items-center gap-1 text-brand-sage"><Loader2 size={12} className="animate-spin" /> A gerar…</span>
                                                        )}
                                                        {p.estado === "sem_dados" && <span className="text-brand-sage italic">Sem AE &lt; 60%</span>}
                                                        {p.estado === "erro" && <span className="text-[#9E3921]">Erro</span>}
                                                        {p.estado === "ok" && (
                                                            <button
                                                                type="button"
                                                                data-testid={`rever-proposta-${a.id}`}
                                                                onClick={() => setExpandido(expandido === a.id ? null : a.id)}
                                                                className="flex items-center gap-1 text-brand-forest hover:underline"
                                                            >
                                                                Rever ({p.questoes.length}) <ChevronDown size={12} className={expandido === a.id ? "rotate-180" : ""} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {comProposta && p?.estado === "erro" && (
                                                <div className="px-3 pb-2 flex items-start gap-2 text-xs text-[#9E3921]">
                                                    <span className="flex-1">{p.erro}</span>
                                                    <button type="button" onClick={() => gerarPara([a])} disabled={gerando || !nValido} className="underline shrink-0">Tentar de novo</button>
                                                </div>
                                            )}

                                            {comProposta && p?.estado === "ok" && expandido === a.id && (
                                                <div className="px-3 pb-3 pt-1 space-y-3 border-t border-crisp/60" data-testid={`proposta-editor-${a.id}`}>
                                                    {p.questoes.length === 0 && <div className="text-xs text-brand-sage italic pt-2">Sem questões (todas removidas).</div>}
                                                    {p.questoes.map((q, qi) => (
                                                        <div key={qi} className="pt-2">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-[11px] font-bold text-brand-forest">
                                                                    {qi + 1}. {q.ae_code && <span className="font-mono">[{q.ae_code}]</span>}
                                                                    <span className="font-normal text-brand-sage ml-1">{[q.tipo, q.dificuldade].filter(Boolean).join(" · ")}</span>
                                                                </span>
                                                                <button type="button" onClick={() => removerQuestao(a.id, qi)} className="btn-danger-ghost" title="Remover questão">
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                            <textarea
                                                                className="input-forest text-sm leading-relaxed resize-y"
                                                                rows={3}
                                                                value={q.enunciado}
                                                                onChange={(e) => editarQuestao(a.id, qi, "enunciado", e.target.value)}
                                                            />
                                                            <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mt-1.5 mb-1">Solução (para o professor)</label>
                                                            <textarea
                                                                className="input-forest text-xs leading-relaxed resize-y"
                                                                rows={2}
                                                                value={q.solucao}
                                                                onChange={(e) => editarQuestao(a.id, qi, "solucao", e.target.value)}
                                                            />
                                                        </div>
                                                    ))}
                                                    <button type="button" onClick={() => gerarPara([a])} disabled={gerando || !nValido} className="text-xs text-brand-forest hover:underline flex items-center gap-1">
                                                        <RefreshCw size={12} /> Gerar de novo ({n || "?"} questões)
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="p-4 border-t border-crisp bg-surface">
                    {error && <div className="mb-3 text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">{error}</div>}
                    {comProposta && bloqueado && !gerando && (
                        <div className="mb-3 text-xs text-brand-charcoal/70" data-testid="proposta-pendente">
                            Gere (e reveja) as propostas dos alunos selecionados antes de continuar.
                        </div>
                    )}
                    <div className="flex items-center gap-3 justify-end flex-wrap">
                        <button onClick={onClose} className="btn-ghost">Cancelar</button>
                        {onSecondaryConfirm && (
                            <button
                                data-testid="aluno-selector-secondary"
                                onClick={confirmSecondary}
                                disabled={busy || busySecondary || selected.size === 0 || bloqueado}
                                className="btn-ghost"
                            >
                                <Mail size={15} />
                                {busySecondary ? "A enviar..." : `${secondaryLabel || "Enviar por e-mail"} (${selected.size})`}
                            </button>
                        )}
                        <button data-testid="aluno-selector-confirm" onClick={confirm} disabled={busy || busySecondary || selected.size === 0 || bloqueado} className="btn-primary">
                            <FileText size={15} />
                            {busy ? "A gerar..." : `${confirmLabel} (${selected.size})`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
