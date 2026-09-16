import { useEffect, useMemo, useState } from "react";
import { Plus, X, Trash2, FilePlus, Pencil, ClipboardCheck, FileText, Sparkles, Save } from "lucide-react";
import { TIPOS_INSTRUMENTO, TIPOS_SEM_NOTA_FINAL, domColor } from "@/lib/grelha";

function buildInitial(dominios) {
    return {
        nome: "",
        tipo: TIPOS_INSTRUMENTO[0],
        data: "",
        semestre: "",
        questoes: [{ id: "", dom: dominios[0]?.code || "", cotacao: "", comp: "" }],
    };
}

function fromInst(inst) {
    return {
        nome: inst.nome,
        tipo: inst.tipo,
        data: inst.data || "",
        semestre: inst.semestre != null ? String(inst.semestre) : "",
        questoes: inst.questoes.map((q) => ({ id: q.id, dom: q.dom, cotacao: String(q.cotacao), comp: q.comp || "" })),
    };
}

export default function Instrumentos({
    turma,
    insts,
    alunos = [],
    dominios,
    competencias = [],
    parametrosOD = [],
    addInstrumento,
    updateInstrumento,
    delInstrumento,
    saveODAvaliacao,
    onClassify,
    onExportRelatorio,
}) {
    const [editing, setEditing] = useState(null); // null | 'new' | inst_id
    const [form, setForm] = useState(buildInitial(dominios));
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [odClassifying, setOdClassifying] = useState(null); // parametro object

    function openNew() { setForm(buildInitial(dominios)); setEditing("new"); setError(""); }
    function openEdit(inst) { setForm(fromInst(inst)); setEditing(inst.id); setError(""); }
    function close() { setEditing(null); setForm(buildInitial(dominios)); setError(""); }

    function addQ() {
        setForm((f) => ({ ...f, questoes: [...f.questoes, { id: "", dom: dominios[0]?.code || "", cotacao: "", comp: "" }] }));
    }
    function removeQ(idx) { setForm((f) => ({ ...f, questoes: f.questoes.filter((_, i) => i !== idx) })); }
    function updateQ(idx, k, v) {
        setForm((f) => ({ ...f, questoes: f.questoes.map((q, i) => (i === idx ? { ...q, [k]: v } : q)) }));
    }

    // Semestre date validation (client-side)
    const semestres = turma?.semestres || {};
    const semRange = form.semestre ? semestres[form.semestre] : null;
    const dateOutOfRange =
        form.semestre && form.data && semRange && semRange.inicio && semRange.fim &&
        (form.data < semRange.inicio || form.data > semRange.fim);

    async function submit(e) {
        e.preventDefault();
        setError("");
        if (!form.nome.trim()) { setError("Indique um nome."); return; }
        if (dateOutOfRange) {
            setError(`A data está fora do intervalo do ${form.semestre}º Semestre (${semRange.inicio} — ${semRange.fim}).`);
            return;
        }
        const qs = form.questoes
            .filter((q) => q.id.trim() && q.cotacao !== "" && !Number.isNaN(parseFloat(q.cotacao)))
            .map((q) => ({ id: q.id.trim(), dom: q.dom, cotacao: parseFloat(q.cotacao), comp: q.comp || null }));
        if (!qs.length) { setError("Adicione pelo menos uma questão preenchida."); return; }
        const ids = qs.map((q) => q.id);
        if (new Set(ids).size !== ids.length) { setError("Os identificadores de questão têm de ser únicos."); return; }
        setBusy(true);
        try {
            const payload = {
                nome: form.nome.trim(),
                tipo: form.tipo,
                data: form.data,
                semestre: form.semestre ? parseInt(form.semestre) : null,
                questoes: qs,
            };
            if (editing === "new") await addInstrumento(payload);
            else await updateInstrumento(editing, payload);
            close();
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || "Erro ao guardar.");
        } finally { setBusy(false); }
    }

    const totalCot = form.questoes.reduce((s, q) => s + (parseFloat(q.cotacao) || 0), 0);
    const domByCode = Object.fromEntries(dominios.map((d, i) => [d.code, { ...d, color: domColor(i) }]));

    function fmtDate(iso) {
        if (!iso) return "—";
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
        if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        return iso;
    }

    return (
        <div className="space-y-8 anim-in" data-testid="instrumentos-view">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-serif text-xl text-brand-forest">Instrumentos de avaliação</h2>
                </div>
                {!editing && (
                    <button data-testid="new-instrumento-btn" onClick={openNew} className="btn-primary">
                        <FilePlus size={16} /> Novo instrumento
                    </button>
                )}
            </div>

            {editing && (
                <div className="card-surface p-6 space-y-6" data-testid="instrumento-form">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-sage mb-1">
                                {editing === "new" ? "Criar" : "Editar"}
                            </div>
                            <h3 className="font-serif text-lg text-brand-forest">
                                {editing === "new" ? "Novo instrumento" : "Alterar instrumento"}
                            </h3>
                        </div>
                        <button onClick={close} className="text-brand-sage hover:text-brand-charcoal">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage block mb-1.5">Nome</label>
                            <input data-testid="inst-nome" className="input-forest" placeholder="Ex: Ficha Sumativa 3" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage block mb-1.5">Tipo</label>
                            <select data-testid="inst-tipo" className="input-forest" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>
                                {TIPOS_INSTRUMENTO.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                            {TIPOS_SEM_NOTA_FINAL.includes(form.tipo) && (
                                <div className="text-[11px] text-brand-sage mt-1 italic">Não conta para a avaliação final.</div>
                            )}
                        </div>
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage block mb-1.5">Semestre</label>
                            <select data-testid="inst-semestre" className="input-forest" value={form.semestre} onChange={(e) => setForm((f) => ({ ...f, semestre: e.target.value }))}>
                                <option value="">—</option>
                                <option value="1">1º Semestre</option>
                                <option value="2">2º Semestre</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage block mb-1.5">Data</label>
                            <input
                                data-testid="inst-data"
                                type="date"
                                className={`input-forest ${dateOutOfRange ? "border-[#9E3921]" : ""}`}
                                value={form.data && /^\d{4}-\d{2}-\d{2}$/.test(form.data) ? form.data : ""}
                                onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                            />
                        </div>
                    </div>

                    {dateOutOfRange && (
                        <div data-testid="date-oor-warning" className="text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">
                            A data está fora do intervalo do {form.semestre}º Semestre ({semRange.inicio} — {semRange.fim}).
                        </div>
                    )}

                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage mb-3">
                            Questões · Total: <span className="text-brand-forest">{totalCot.toFixed(1)} pts</span>
                        </div>
                        <div className="space-y-4">
                            {form.questoes.map((q, i) => {
                                const empty = !q.id.trim() && !q.cotacao;
                                return (
                                    <div key={i} className={`border border-crisp rounded-md p-4 space-y-3 transition-opacity ${empty ? "opacity-60 bg-page/60" : "bg-surface"}`} data-testid={`q-card-${i}`}>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] uppercase tracking-[0.2em] text-brand-sage">Questão {String(i + 1).padStart(2, "0")}</span>
                                            <button type="button" onClick={() => removeQ(i)} className="btn-danger-ghost" disabled={form.questoes.length === 1} title="Remover questão">
                                                <X size={14} />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div>
                                                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Nº da questão</label>
                                                <input data-testid={`q-id-${i}`} className="input-forest" placeholder="Ex: 1a, Q2, 3.1" value={q.id} onChange={(e) => updateQ(i, "id", e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Domínio</label>
                                                <select data-testid={`q-dom-${i}`} className="input-forest" value={q.dom} onChange={(e) => updateQ(i, "dom", e.target.value)} style={{ color: domByCode[q.dom]?.color }}>
                                                    {dominios.map((d) => <option key={d.code} value={d.code}>{`${d.code} — ${d.nome}`}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Cotação (pts)</label>
                                                <input data-testid={`q-cot-${i}`} type="number" step="0.1" className="input-forest" placeholder="Ex: 5" value={q.cotacao} onChange={(e) => updateQ(i, "cotacao", e.target.value)} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Aprendizagem essencial</label>
                                            {competencias.length > 0 ? (
                                                <select data-testid={`q-comp-${i}`} className="input-forest text-sm" value={q.comp || ""} onChange={(e) => updateQ(i, "comp", e.target.value)}>
                                                    <option value="">— Sem aprendizagem associada —</option>
                                                    {competencias.map((c) => (
                                                        <option key={c.code} value={c.code}>{c.nome.length > 120 ? c.nome.slice(0, 117) + "…" : c.nome}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div className="text-xs text-brand-sage italic bg-page rounded px-2 py-2 border border-dashed border-crisp">
                                                    Ainda não há aprendizagens configuradas. Adicione-as em Configurar.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <button type="button" onClick={addQ} className="mt-3 text-sm text-brand-forest hover:text-brand-forest-hover flex items-center gap-1">
                            <Plus size={14} /> Adicionar questão
                        </button>
                    </div>

                    {error && <div className="text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">{error}</div>}

                    <div className="flex gap-3 pt-2">
                        <button onClick={close} className="btn-ghost">Cancelar</button>
                        <button data-testid="inst-save" onClick={submit} disabled={busy || dateOutOfRange} className="btn-primary">
                            {busy ? "A guardar..." : (editing === "new" ? "Guardar instrumento" : "Guardar alterações")}
                        </button>
                    </div>
                </div>
            )}

            <div className="card-surface overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-page border-b border-crisp">
                        <tr className="text-left text-[11px] uppercase tracking-[0.15em] text-brand-sage">
                            <th className="px-5 py-2.5 font-semibold">Nome</th>
                            <th className="px-5 py-2.5 font-semibold">Tipo</th>
                            <th className="px-5 py-2.5 font-semibold">Sem.</th>
                            <th className="px-5 py-2.5 font-semibold">Data</th>
                            <th className="px-5 py-2.5 font-semibold">Questões</th>
                            <th className="px-5 py-2.5 font-semibold">Total pts</th>
                            <th className="px-5 py-2.5 font-semibold w-36 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody data-testid="instrumentos-list">
                        {insts.length === 0 ? (
                            <tr><td colSpan={7} className="px-5 py-12 text-center text-brand-sage">Sem instrumentos criados.</td></tr>
                        ) : insts.map((inst, i) => (
                            <tr key={inst.id} className={`border-b border-crisp last:border-0 row-hover ${i % 2 === 1 ? "bg-page/60" : ""}`}>
                                <td className="px-5 py-3 font-medium text-brand-charcoal">{inst.nome}</td>
                                <td className="px-5 py-3">
                                    <span className="text-[11px] bg-page border border-crisp text-brand-charcoal/80 px-2 py-0.5 rounded-full">{inst.tipo}</span>
                                    {TIPOS_SEM_NOTA_FINAL.includes(inst.tipo) && (
                                        <span className="block text-[10px] text-brand-sage italic mt-0.5">não conta p/ final</span>
                                    )}
                                </td>
                                <td className="px-5 py-3 tabular-nums font-mono text-xs">{inst.semestre ? `${inst.semestre}º` : "—"}</td>
                                <td className="px-5 py-3 text-brand-charcoal/70">{fmtDate(inst.data)}</td>
                                <td className="px-5 py-3 tabular-nums font-mono text-xs">{inst.questoes.length}</td>
                                <td className="px-5 py-3 tabular-nums font-mono text-xs">{inst.questoes.reduce((s, q) => s + Number(q.cotacao), 0).toFixed(1)}</td>
                                <td className="px-5 py-3 text-right">
                                    <div className="flex justify-end gap-1 flex-wrap">
                                        <button data-testid={`classif-inst-${inst.id}`} onClick={() => onClassify && onClassify(inst.id)} className="btn-primary !px-3 !py-1.5 text-xs" title="Abrir classificações">
                                            <ClipboardCheck size={13} /> Classificações
                                        </button>
                                        <button data-testid={`relatorio-inst-${inst.id}`} onClick={() => onExportRelatorio && onExportRelatorio(inst)} className="btn-ghost !px-2 !py-1.5" title="Exportar relatório por aprendizagens (PDF)">
                                            <FileText size={14} />
                                        </button>
                                        <button data-testid={`edit-inst-${inst.id}`} onClick={() => openEdit(inst)} className="btn-ghost !px-2 !py-1.5" title="Editar">
                                            <Pencil size={14} />
                                        </button>
                                        <button data-testid={`del-inst-${inst.id}`} onClick={() => delInstrumento(inst.id)} className="btn-danger-ghost" title="Eliminar">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Observação Direta panel — separate section listing each parameter */}
            {parametrosOD.length > 0 && (
                <div data-testid="od-panel">
                    <div className="flex items-baseline justify-between mb-3">
                        <div>
                            <h2 className="font-serif text-xl text-brand-forest">Observação Direta</h2>
                        </div>
                        <div className="text-xs text-brand-charcoal/60">{parametrosOD.length} parâmetro(s) · {alunos.length} aluno(s)</div>
                    </div>
                    <div className="card-surface overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-page border-b border-crisp">
                                <tr className="text-left text-[11px] uppercase tracking-[0.15em] text-brand-sage">
                                    <th className="px-5 py-2.5 font-semibold">Parâmetro</th>
                                    <th className="px-5 py-2.5 font-semibold w-32">Domínio</th>
                                    <th className="px-5 py-2.5 font-semibold w-24 text-right">Notas</th>
                                    <th className="px-5 py-2.5 font-semibold w-36 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody data-testid="od-list">
                                {parametrosOD.map((p, i) => {
                                    const entry = (turma?.od_avaliacoes || {})[p.id] || {};
                                    const notasCount = Object.keys(entry.notas || {}).length;
                                    const dom = entry.dom || null;
                                    const domIdx = dominios.findIndex((d) => d.code === dom);
                                    return (
                                        <tr key={p.id} className={`border-b border-crisp last:border-0 row-hover ${i % 2 === 1 ? "bg-page/60" : ""}`} data-testid={`od-row-${p.id}`}>
                                            <td className="px-5 py-3 font-medium text-brand-charcoal">{p.nome}</td>
                                            <td className="px-5 py-3">
                                                {dom ? (
                                                    <span className="text-[11px] px-2 py-0.5 rounded-full font-mono" style={{ background: domColor(domIdx) + "22", color: domColor(domIdx) }}>{dom}</span>
                                                ) : <span className="text-brand-sage text-xs">—</span>}
                                            </td>
                                            <td className="px-5 py-3 text-right tabular-nums font-mono text-xs text-brand-charcoal/70">{notasCount} / {alunos.length}</td>
                                            <td className="px-5 py-3 text-right">
                                                <button data-testid={`od-classif-${p.id}`} onClick={() => setOdClassifying(p)} className="btn-primary !px-3 !py-1.5 text-xs">
                                                    <ClipboardCheck size={13} /> Classificar
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {odClassifying && (
                <ODClassifModal
                    parametro={odClassifying}
                    entry={(turma?.od_avaliacoes || {})[odClassifying.id] || {}}
                    dominios={dominios}
                    alunos={alunos}
                    onClose={() => setOdClassifying(null)}
                    onSave={async (payload) => {
                        await saveODAvaliacao(odClassifying.id, payload);
                    }}
                />
            )}
        </div>
    );
}

// ─── Modal to grade one OD parameter across all alunos ───────────────────────
function ODClassifModal({ parametro, entry, dominios, alunos, onClose, onSave }) {
    const [dom, setDom] = useState(entry.dom || dominios[0]?.code || "");
    const [semestre, setSemestre] = useState(entry.semestre != null ? String(entry.semestre) : "1");
    const initialNotas = useMemo(() => {
        const n = {};
        for (const a of alunos) n[a.id] = entry.notas?.[a.id] != null ? String(entry.notas[a.id]) : "";
        return n;
    }, [alunos, entry.notas]);
    const [notas, setNotas] = useState(initialNotas);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);

    useEffect(() => { setNotas(initialNotas); }, [initialNotas]);

    // Any invalid nota
    const invalid = Object.values(notas).some((v) => {
        if (v === "" || v == null) return false;
        const n = Number(v);
        return Number.isNaN(n) || n < 0 || n > 10;
    });

    function updateNota(id, val) {
        setNotas((s) => ({ ...s, [id]: val }));
    }

    async function save() {
        setError(""); setBusy(true);
        try {
            const cleaned = {};
            for (const [id, v] of Object.entries(notas)) {
                cleaned[id] = v === "" || v == null ? null : Number(v);
            }
            await onSave({ dom, semestre: parseInt(semestre), notas: cleaned });
            setSaved(true);
            setTimeout(onClose, 900);
        } catch (e) {
            setError(e?.response?.data?.detail || e.message || "Erro ao guardar.");
        } finally { setBusy(false); }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="card-surface w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden anim-in" onClick={(e) => e.stopPropagation()} data-testid="od-modal">
                <div className="p-6 border-b border-crisp">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="text-[11px] uppercase tracking-[0.25em] text-brand-sage mb-1 flex items-center gap-2">
                                <Sparkles size={12} /> Observação Direta
                            </div>
                            <h2 className="font-serif text-xl text-brand-forest">{parametro.nome}</h2>
                        </div>
                        <button onClick={onClose} className="text-brand-sage hover:text-brand-charcoal">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Domínio</label>
                            <select data-testid="od-modal-dom" className="input-forest" value={dom} onChange={(e) => setDom(e.target.value)}>
                                {dominios.map((d) => <option key={d.code} value={d.code}>{`${d.code} — ${d.nome}`}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Semestre</label>
                            <select data-testid="od-modal-sem" className="input-forest" value={semestre} onChange={(e) => setSemestre(e.target.value)}>
                                <option value="1">1º Semestre</option>
                                <option value="2">2º Semestre</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                    {alunos.length === 0 ? (
                        <div className="text-center text-brand-sage py-10 text-sm">Sem alunos na turma.</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-page border-b border-crisp sticky top-0">
                                <tr className="text-left text-[11px] uppercase tracking-[0.15em] text-brand-sage">
                                    <th className="px-3 py-2 font-semibold">Aluno</th>
                                    <th className="px-3 py-2 font-semibold w-24 text-right">Nota (0–10)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {alunos.map((a, i) => (
                                    <tr key={a.id} className={`border-b border-crisp last:border-0 ${i % 2 === 1 ? "bg-page/40" : ""}`}>
                                        <td className="px-3 py-1.5 text-brand-charcoal">{a.nome}</td>
                                        <td className="px-3 py-1.5 text-right">
                                            <input
                                                data-testid={`od-nota-${a.id}`}
                                                type="number"
                                                step="0.1"
                                                min={0}
                                                max={10}
                                                className="input-forest w-20 text-right tabular-nums font-mono text-sm"
                                                value={notas[a.id] ?? ""}
                                                onChange={(e) => updateNota(a.id, e.target.value)}
                                                placeholder="—"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="p-4 border-t border-crisp flex items-center gap-3 justify-end bg-surface">
                    {error && <span className="text-sm text-[#9E3921] mr-auto">{error}</span>}
                    <button onClick={onClose} className="btn-ghost">Cancelar</button>
                    <button data-testid="od-modal-save" onClick={save} disabled={busy || invalid} className="btn-primary">
                        <Save size={15} />
                        {saved ? "Guardado ✓" : busy ? "A guardar..." : "Guardar"}
                    </button>
                </div>
            </div>
        </div>
    );
}
