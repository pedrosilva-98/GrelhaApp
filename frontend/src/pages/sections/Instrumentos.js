import { useState } from "react";
import { Plus, X, Trash2, FilePlus, Pencil, ClipboardCheck, FileText, Sparkles } from "lucide-react";
import { TIPOS_INSTRUMENTO, domColor } from "@/lib/grelha";

function buildInitial(dominios) {
    return {
        nome: "",
        tipo: TIPOS_INSTRUMENTO[0],
        data: "",
        semestre: "",
        questoes: [{ id: "", dom: dominios[0]?.code || "", cotacao: "", comp: "" }],
        observacao_direta: [],
    };
}

function fromInst(inst, parametrosOD, dominios) {
    // Seed OD from turma parameters if instrument has no OD saved yet
    const currentOD = inst.observacao_direta || [];
    const byId = Object.fromEntries(currentOD.map((o) => [o.parametro_id, o]));
    const merged = (parametrosOD || []).map((p) => {
        const existing = byId[p.id];
        return {
            parametro_id: p.id,
            nome: p.nome,
            dom: existing?.dom || p.dom || dominios[0]?.code || "",
            nota: existing?.nota != null ? String(existing.nota) : "",
        };
    });
    return {
        nome: inst.nome,
        tipo: inst.tipo,
        data: inst.data || "",
        semestre: inst.semestre != null ? String(inst.semestre) : "",
        questoes: inst.questoes.map((q) => ({ id: q.id, dom: q.dom, cotacao: String(q.cotacao), comp: q.comp || "" })),
        observacao_direta: merged,
    };
}

function buildInitialWithOD(dominios, parametrosOD) {
    const base = buildInitial(dominios);
    base.observacao_direta = (parametrosOD || []).map((p) => ({
        parametro_id: p.id,
        nome: p.nome,
        dom: p.dom || dominios[0]?.code || "",
        nota: "",
    }));
    return base;
}

export default function Instrumentos({
    turma,
    insts,
    dominios,
    competencias = [],
    parametrosOD = [],
    addInstrumento,
    updateInstrumento,
    delInstrumento,
    onClassify,
    onExportRelatorio,
}) {
    const [editing, setEditing] = useState(null); // null | 'new' | inst_id
    const [form, setForm] = useState(buildInitialWithOD(dominios, parametrosOD));
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    function openNew() {
        setForm(buildInitialWithOD(dominios, parametrosOD));
        setEditing("new");
        setError("");
    }

    function openEdit(inst) {
        setForm(fromInst(inst, parametrosOD, dominios));
        setEditing(inst.id);
        setError("");
    }

    function close() {
        setEditing(null);
        setForm(buildInitialWithOD(dominios, parametrosOD));
        setError("");
    }

    function addQ() {
        setForm((f) => ({
            ...f,
            questoes: [...f.questoes, { id: "", dom: dominios[0]?.code || "", cotacao: "", comp: "" }],
        }));
    }
    function removeQ(idx) {
        setForm((f) => ({ ...f, questoes: f.questoes.filter((_, i) => i !== idx) }));
    }
    function updateQ(idx, k, v) {
        setForm((f) => ({ ...f, questoes: f.questoes.map((q, i) => (i === idx ? { ...q, [k]: v } : q)) }));
    }

    function updateOD(idx, k, v) {
        setForm((f) => ({ ...f, observacao_direta: f.observacao_direta.map((o, i) => (i === idx ? { ...o, [k]: v } : o)) }));
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
            .map((q) => ({
                id: q.id.trim(),
                dom: q.dom,
                cotacao: parseFloat(q.cotacao),
                comp: q.comp || null,
            }));
        if (!qs.length && form.observacao_direta.every((o) => o.nota === "" || o.nota == null)) {
            setError("Adicione pelo menos uma questão preenchida ou uma nota em Observação Direta.");
            return;
        }
        const ids = qs.map((q) => q.id);
        if (new Set(ids).size !== ids.length) { setError("Os identificadores de questão têm de ser únicos."); return; }

        const ods = form.observacao_direta
            .filter((o) => o.nota !== "" && o.nota != null && !Number.isNaN(parseFloat(o.nota)))
            .map((o) => ({
                parametro_id: o.parametro_id,
                dom: o.dom,
                nota: parseFloat(o.nota),
            }));
        for (const o of ods) {
            if (o.nota < 0 || o.nota > 10) { setError("Notas de Observação Direta devem estar entre 0 e 10."); return; }
        }

        setBusy(true);
        try {
            const payload = {
                nome: form.nome.trim(),
                tipo: form.tipo,
                data: form.data,
                semestre: form.semestre ? parseInt(form.semestre) : null,
                questoes: qs,
                observacao_direta: ods,
            };
            if (editing === "new") await addInstrumento(payload);
            else await updateInstrumento(editing, payload);
            close();
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || "Erro ao guardar.");
        } finally {
            setBusy(false);
        }
    }

    const totalCot = form.questoes.reduce((s, q) => s + (parseFloat(q.cotacao) || 0), 0);
    const domByCode = Object.fromEntries(dominios.map((d, i) => [d.code, { ...d, color: domColor(i) }]));

    // Format ISO date "YYYY-MM-DD" to "DD/MM/YYYY" for display
    function fmtDate(iso) {
        if (!iso) return "—";
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
        if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        return iso;
    }

    return (
        <div className="space-y-6 anim-in" data-testid="instrumentos-view">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-sage mb-1">Avaliação</div>
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

                    {/* Questões — vertical stacked layout */}
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage mb-3">
                            Questões · Total: <span className="text-brand-forest">{totalCot.toFixed(1)} pts</span>
                        </div>
                        <div className="space-y-4">
                            {form.questoes.map((q, i) => {
                                const empty = !q.id.trim() && !q.cotacao && !q.dom;
                                return (
                                    <div
                                        key={i}
                                        className={`border border-crisp rounded-md p-4 space-y-3 transition-opacity ${empty ? "opacity-60 bg-page/60" : "bg-surface"}`}
                                        data-testid={`q-card-${i}`}
                                    >
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
                                                <select
                                                    data-testid={`q-dom-${i}`}
                                                    className="input-forest"
                                                    value={q.dom}
                                                    onChange={(e) => updateQ(i, "dom", e.target.value)}
                                                    style={{ color: domByCode[q.dom]?.color }}
                                                >
                                                    {dominios.map((d) => <option key={d.code} value={d.code}>{d.code} — {d.nome}</option>)}
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
                                                <select
                                                    data-testid={`q-comp-${i}`}
                                                    className="input-forest text-sm"
                                                    value={q.comp || ""}
                                                    onChange={(e) => updateQ(i, "comp", e.target.value)}
                                                >
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

                    {/* Observação Direta */}
                    {parametrosOD.length > 0 && (
                        <div className="border-t border-crisp pt-5" data-testid="od-section">
                            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-sage mb-1 flex items-center gap-2">
                                <Sparkles size={12} /> Trabalhos individuais ou de grupo
                            </div>
                            <h3 className="font-serif text-lg text-brand-forest mb-1">Observação Direta</h3>
                            <p className="text-sm text-brand-charcoal/70 mb-4">Atribua uma nota 0–10 a cada parâmetro. Escolha o domínio ao qual contribui.</p>
                            <div className="space-y-3">
                                {form.observacao_direta.map((o, i) => (
                                    <div key={o.parametro_id} className="grid grid-cols-1 sm:grid-cols-[1fr_140px_110px] gap-3 items-end" data-testid={`od-row-${i}`}>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Parâmetro</label>
                                            <div className="input-forest bg-page text-sm">{o.nome}</div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Domínio</label>
                                            <select
                                                data-testid={`od-dom-${i}`}
                                                className="input-forest"
                                                value={o.dom}
                                                onChange={(e) => updateOD(i, "dom", e.target.value)}
                                            >
                                                {dominios.map((d) => <option key={d.code} value={d.code}>{d.code}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Nota (0–10)</label>
                                            <input
                                                data-testid={`od-nota-${i}`}
                                                type="number"
                                                step="0.1"
                                                min={0}
                                                max={10}
                                                className="input-forest"
                                                value={o.nota}
                                                onChange={(e) => updateOD(i, "nota", e.target.value)}
                                                placeholder="—"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

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
                                </td>
                                <td className="px-5 py-3 tabular-nums font-mono text-xs">{inst.semestre ? `${inst.semestre}º` : "—"}</td>
                                <td className="px-5 py-3 text-brand-charcoal/70">{fmtDate(inst.data)}</td>
                                <td className="px-5 py-3 tabular-nums font-mono text-xs">{inst.questoes.length}</td>
                                <td className="px-5 py-3 tabular-nums font-mono text-xs">{inst.questoes.reduce((s, q) => s + Number(q.cotacao), 0).toFixed(1)}</td>
                                <td className="px-5 py-3 text-right">
                                    <div className="flex justify-end gap-1 flex-wrap">
                                        <button
                                            data-testid={`classif-inst-${inst.id}`}
                                            onClick={() => onClassify && onClassify(inst.id)}
                                            className="btn-primary !px-3 !py-1.5 text-xs"
                                            title="Abrir classificações"
                                        >
                                            <ClipboardCheck size={13} /> Classificações
                                        </button>
                                        <button
                                            data-testid={`relatorio-inst-${inst.id}`}
                                            onClick={() => onExportRelatorio && onExportRelatorio(inst)}
                                            className="btn-ghost !px-2 !py-1.5"
                                            title="Exportar relatório por aprendizagens (PDF)"
                                        >
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
        </div>
    );
}
