import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { X, School, ChevronLeft, Plus, Save, Upload, Sparkles, Download, Loader2 } from "lucide-react";
import CompetenciasImportModal from "@/components/CompetenciasImportModal";
import { exportConfiguracoesTurmasPDF } from "@/lib/pdf";

// Admin: ver as turmas de um professor e gerir as Aprendizagens Essenciais de cada uma.
export default function TeacherTurmasModal({ teacher, onClose }) {
    const [turmas, setTurmas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [turmaId, setTurmaId] = useState(null);
    const [exportingId, setExportingId] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const r = await api.get(`/admin/teachers/${teacher.id}/turmas`);
                setTurmas(r.data);
            } catch (e) {
                setError(formatApiError(e));
            } finally {
                setLoading(false);
            }
        })();
    }, [teacher.id]);

    const turma = turmas.find((t) => t.id === turmaId);

    function onSavedComp(turmaIdSalva, competencias) {
        setTurmas((s) => s.map((t) => (t.id === turmaIdSalva ? { ...t, competencias } : t)));
    }

    function exportarTurma(t) {
        setExportingId(t.id);
        try {
            exportConfiguracoesTurmasPDF({ turmas: [{ ...t, prof_nome: teacher.nome, prof_email: teacher.email }] });
        } finally {
            setExportingId(null);
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="card-surface w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden anim-in" onClick={(e) => e.stopPropagation()} data-testid="teacher-turmas-modal">
                <div className="p-6 border-b border-crisp">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="text-[11px] uppercase tracking-[0.25em] text-brand-sage mb-1 flex items-center gap-2">
                                <School size={12} /> {teacher.nome}
                            </div>
                            <h2 className="font-serif text-xl text-brand-forest">
                                {turma ? "Aprendizagens essenciais" : "Turmas"}
                            </h2>
                        </div>
                        <button onClick={onClose} className="text-brand-sage hover:text-brand-charcoal">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {error && <div className="mb-4 text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">{error}</div>}
                    {loading ? (
                        <div className="text-center text-brand-sage py-10 text-sm">A carregar...</div>
                    ) : turma ? (
                        <AprendizagensEditor turma={turma} onBack={() => setTurmaId(null)} onSaved={onSavedComp} />
                    ) : turmas.length === 0 ? (
                        <div className="text-center text-brand-sage py-10 text-sm">Este professor ainda não criou nenhuma turma.</div>
                    ) : (
                        <ul className="space-y-2" data-testid="teacher-turmas-list">
                            {turmas.map((t) => (
                                <li key={t.id} className="flex items-stretch gap-2">
                                    <button
                                        data-testid={`teacher-turma-${t.id}`}
                                        onClick={() => setTurmaId(t.id)}
                                        className="flex-1 min-w-0 text-left flex items-center justify-between gap-3 px-4 py-3 rounded-md border border-crisp hover:bg-page transition-colors"
                                    >
                                        <div>
                                            <div className="font-medium text-brand-charcoal">{t.disciplina}</div>
                                            <div className="text-xs text-brand-charcoal/60">{t.ano} {t.turma}</div>
                                        </div>
                                        <span className="text-[11px] text-brand-sage flex items-center gap-1 shrink-0">
                                            <Sparkles size={11} /> {(t.competencias || []).length} aprendizagem(s)
                                        </span>
                                    </button>
                                    <button
                                        data-testid={`export-turma-${t.id}`}
                                        onClick={() => exportarTurma(t)}
                                        disabled={exportingId === t.id}
                                        title="Exportar relatório de configurações desta turma"
                                        className="btn-ghost !px-3 shrink-0"
                                    >
                                        {exportingId === t.id ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

function AprendizagensEditor({ turma, onBack, onSaved }) {
    const [items, setItems] = useState(turma.competencias || []);
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");
    const [showImport, setShowImport] = useState(false);

    const nonEmptyCodes = items.map((c) => (c.code || "").trim()).filter(Boolean);
    const codesUnique = new Set(nonEmptyCodes).size === nonEmptyCodes.length;
    const namesFilled = items.every((c) => (c.nome || "").trim().length > 0);
    const valid = codesUnique && namesFilled;

    function update(i, key, val) { setItems((s) => s.map((c, idx) => (idx === i ? { ...c, [key]: val } : c))); }
    function add() { setItems((s) => [...s, { code: "", nome: "" }]); }
    function remove(i) { setItems((s) => s.filter((_, idx) => idx !== i)); }

    async function persist(list) {
        const { data } = await api.put(`/admin/turmas/${turma.id}/competencias`, { competencias: list });
        onSaved(turma.id, data.competencias);
        return data.competencias;
    }

    async function save() {
        setError(""); setBusy(true);
        try {
            const usedCodes = new Set(items.map((c) => (c.code || "").trim()).filter(Boolean));
            let counter = 1;
            const withCodes = items.map((c) => {
                let code = (c.code || "").trim();
                if (!code) {
                    while (usedCodes.has(`AE${counter}`)) counter++;
                    code = `AE${counter}`;
                    usedCodes.add(code);
                    counter++;
                }
                return { code, nome: (c.nome || "").trim() };
            });
            const saved = await persist(withCodes);
            setItems(saved);
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
        } catch (e) {
            setError(e?.response?.data?.detail || e?.message || "Erro ao guardar.");
        } finally { setBusy(false); }
    }

    async function handleImport(newComps) {
        const merged = [...items];
        const codes = new Set(items.map((c) => c.code));
        for (const c of newComps) {
            if (!codes.has(c.code)) {
                merged.push(c);
                codes.add(c.code);
            }
        }
        const saved = await persist(merged);
        setItems(saved);
    }

    return (
        <div>
            <button onClick={onBack} className="text-sm text-brand-forest hover:underline flex items-center gap-1 mb-4">
                <ChevronLeft size={14} /> Voltar às turmas
            </button>
            <p className="text-sm text-brand-charcoal/70 mb-4 leading-relaxed">
                <strong>{turma.disciplina}</strong> · {turma.ano} {turma.turma}. Estas aprendizagens ficam disponíveis para o professor associar a questões nos instrumentos de avaliação.
            </p>

            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div className="text-sm">
                    <span className="text-brand-sage text-[11px] uppercase tracking-wider">Total</span>
                    <span className="font-serif text-2xl text-brand-forest ml-3 tabular-nums">{items.length}</span>
                </div>
                <button data-testid="admin-comp-import-btn" onClick={() => setShowImport(true)} className="btn-ghost text-sm">
                    <Upload size={14} /> Importar Excel/CSV
                </button>
            </div>

            {items.length === 0 ? (
                <div className="border-2 border-dashed border-crisp rounded-lg py-8 text-center text-brand-sage text-sm">
                    Ainda não há aprendizagens definidas para esta turma.
                </div>
            ) : (
                <div className="space-y-3" data-testid="admin-comp-list">
                    {items.map((c, i) => (
                        <div key={i} className="flex items-start gap-2" data-testid={`admin-comp-row-${i}`}>
                            <span className="text-xs font-mono text-brand-sage w-8 mt-3 tabular-nums shrink-0">{String(i + 1).padStart(2, "0")}</span>
                            <textarea
                                data-testid={`admin-comp-nome-${i}`}
                                className="input-forest flex-1 text-sm leading-relaxed resize-y"
                                rows={3}
                                value={c.nome}
                                onChange={(e) => update(i, "nome", e.target.value)}
                                placeholder="Descreva a aprendizagem essencial..."
                            />
                            <button type="button" onClick={() => remove(i)} className="btn-danger-ghost mt-2 shrink-0" title="Remover">
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <button type="button" onClick={add} data-testid="admin-comp-add-btn" className="text-sm text-brand-forest hover:text-brand-forest-hover flex items-center gap-1 mt-3">
                <Plus size={14} /> Adicionar aprendizagem
            </button>

            {error && <div className="text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2 mt-3">{error}</div>}

            <button data-testid="admin-comp-save-btn" onClick={save} disabled={!valid || busy} className="btn-primary w-full justify-center mt-4">
                <Save size={16} />
                {saved ? "Guardado ✓" : busy ? "A guardar..." : "Guardar aprendizagens"}
            </button>

            {showImport && (
                <CompetenciasImportModal
                    existing={items}
                    onClose={() => setShowImport(false)}
                    onImport={handleImport}
                />
            )}
        </div>
    );
}
