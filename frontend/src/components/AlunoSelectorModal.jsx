import { useState } from "react";
import { X, Users, FileText, Mail, CheckSquare, Square } from "lucide-react";

export default function AlunoSelectorModal({
    alunos,
    title = "Selecionar alunos",
    subtitle,
    confirmLabel = "Gerar",
    onClose,
    onConfirm,
    secondaryLabel,
    onSecondaryConfirm,
}) {
    const [selected, setSelected] = useState(new Set(alunos.map((a) => a.id)));
    const [busy, setBusy] = useState(false);
    const [busySecondary, setBusySecondary] = useState(false);
    const [error, setError] = useState("");
    const allSelected = selected.size === alunos.length;

    function toggle(id) {
        setSelected((s) => {
            const n = new Set(s);
            if (n.has(id)) n.delete(id); else n.add(id);
            return n;
        });
    }
    function toggleAll() {
        setSelected(allSelected ? new Set() : new Set(alunos.map((a) => a.id)));
    }

    async function confirm() {
        setBusy(true);
        const chosen = alunos.filter((a) => selected.has(a.id));
        try {
            await onConfirm(chosen);
            onClose();
        } finally { setBusy(false); }
    }

    async function confirmSecondary() {
        setError("");
        const chosen = alunos.filter((a) => selected.has(a.id));
        const comEmail = chosen.filter((a) => (a.email || "").trim());
        if (!comEmail.length) {
            setError("Nenhum dos alunos selecionados tem email registado. Adicione o email em Turma ou no perfil do aluno.");
            return;
        }
        setBusySecondary(true);
        try {
            await onSecondaryConfirm(comEmail);
            onClose();
        } catch (e) {
            setError(e?.response?.data?.detail || e?.message || "Erro ao enviar email.");
        } finally { setBusySecondary(false); }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="card-surface w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden anim-in" onClick={(e) => e.stopPropagation()} data-testid="aluno-selector-modal">
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
                                return (
                                    <li key={a.id}>
                                        <button
                                            data-testid={`select-aluno-${a.id}`}
                                            onClick={() => toggle(a.id)}
                                            className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-md border transition-colors ${
                                                on ? "border-brand-forest bg-page" : "border-crisp hover:bg-page"
                                            }`}
                                        >
                                            {on ? <CheckSquare size={16} className="text-brand-forest" /> : <Square size={16} className="text-brand-sage" />}
                                            <span className="text-xs font-mono text-brand-sage w-6 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                                            <span className="text-sm text-brand-charcoal">{a.nome}</span>
                                            {onSecondaryConfirm && (
                                                <span className={`ml-auto text-[10px] ${a.email ? "text-brand-sage" : "text-brand-sage/50 italic"}`}>
                                                    {a.email || "sem email"}
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="p-4 border-t border-crisp bg-surface">
                    {error && <div className="mb-3 text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">{error}</div>}
                    <div className="flex items-center gap-3 justify-end flex-wrap">
                        <button onClick={onClose} className="btn-ghost">Cancelar</button>
                        {onSecondaryConfirm && (
                            <button
                                data-testid="aluno-selector-secondary"
                                onClick={confirmSecondary}
                                disabled={busy || busySecondary || selected.size === 0}
                                className="btn-ghost"
                            >
                                <Mail size={15} />
                                {busySecondary ? "A enviar..." : `${secondaryLabel || "Enviar por e-mail"} (${selected.size})`}
                            </button>
                        )}
                        <button data-testid="aluno-selector-confirm" onClick={confirm} disabled={busy || busySecondary || selected.size === 0} className="btn-primary">
                            <FileText size={15} />
                            {busy ? "A gerar..." : `${confirmLabel} (${selected.size})`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
