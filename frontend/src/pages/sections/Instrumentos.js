import { useState } from "react";
import { Plus, X, Trash2, FilePlus, Pencil, ClipboardCheck } from "lucide-react";
import { TIPOS_INSTRUMENTO, domColor } from "@/lib/grelha";

function buildInitial(dominios) {
    return {
        nome: "",
        tipo: TIPOS_INSTRUMENTO[0],
        data: "",
        questoes: [{ id: "", dom: dominios[0]?.code || "", cotacao: "", comp: "" }],
    };
}

export default function Instrumentos({ insts, dominios, competencias = [], addInstrumento, updateInstrumento, delInstrumento, onClassify }) {
    const [editing, setEditing] = useState(null); // null | 'new' | inst_id
    const [form, setForm] = useState(buildInitial(dominios));
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    function openNew() {
        setForm(buildInitial(dominios));
        setEditing("new");
        setError("");
    }

    function openEdit(inst) {
        setForm({
            nome: inst.nome,
            tipo: inst.tipo,
            data: inst.data || "",
            questoes: inst.questoes.map((q) => ({ id: q.id, dom: q.dom, cotacao: String(q.cotacao), comp: q.comp || "" })),
        });
        setEditing(inst.id);
        setError("");
    }

    function close() {
        setEditing(null);
        setForm(buildInitial(dominios));
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

    async function submit(e) {
        e.preventDefault();
        setError("");
        if (!form.nome.trim()) { setError("Indique um nome."); return; }
        const qs = form.questoes
            .filter((q) => q.id.trim() && q.cotacao !== "" && !Number.isNaN(parseFloat(q.cotacao)))
            .map((q) => ({
                id: q.id.trim(),
                dom: q.dom,
                cotacao: parseFloat(q.cotacao),
                comp: q.comp || null,
            }));
        if (!qs.length) { setError("Adicione pelo menos uma questão com identificador e cotação."); return; }
        // Guard against duplicate question IDs within the same instrument
        const ids = qs.map((q) => q.id);
        if (new Set(ids).size !== ids.length) { setError("Os identificadores de questão têm de ser únicos."); return; }
        setBusy(true);
        try {
            const payload = { nome: form.nome.trim(), tipo: form.tipo, data: form.data, questoes: qs };
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
        return iso; // legacy free-text values remain readable
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
                <div className="card-surface p-6 space-y-5" data-testid="instrumento-form">
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage block mb-1.5">Data</label>
                            <input
                                data-testid="inst-data"
                                type="date"
                                className="input-forest"
                                value={form.data && /^\d{4}-\d{2}-\d{2}$/.test(form.data) ? form.data : ""}
                                onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage mb-3">
                            Questões · Total: <span className="text-brand-forest">{totalCot.toFixed(1)} pts</span>
                        </div>
                        <div className="space-y-2">
                            {form.questoes.map((q, i) => (
                                <div key={i} className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-mono text-brand-sage w-6 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                                    <input data-testid={`q-id-${i}`} className="input-forest w-32" placeholder="Identificador" value={q.id} onChange={(e) => updateQ(i, "id", e.target.value)} />
                                    <select
                                        data-testid={`q-dom-${i}`}
                                        className="input-forest w-32"
                                        value={q.dom}
                                        onChange={(e) => updateQ(i, "dom", e.target.value)}
                                        style={{ color: domByCode[q.dom]?.color }}
                                    >
                                        {dominios.map((d) => <option key={d.code} value={d.code}>{d.code}</option>)}
                                    </select>
                                    <input data-testid={`q-cot-${i}`} type="number" step="0.1" className="input-forest w-24" placeholder="Pts" value={q.cotacao} onChange={(e) => updateQ(i, "cotacao", e.target.value)} />
                                    {competencias.length > 0 && (
                                        <select
                                            data-testid={`q-comp-${i}`}
                                            className="input-forest flex-1 min-w-[220px] text-xs"
                                            value={q.comp || ""}
                                            onChange={(e) => updateQ(i, "comp", e.target.value)}
                                            title="Competência essencial"
                                        >
                                            <option value="">— Competência —</option>
                                            {competencias.map((c) => (
                                                <option key={c.code} value={c.code}>{c.code} · {c.nome.length > 60 ? c.nome.slice(0, 57) + "…" : c.nome}</option>
                                            ))}
                                        </select>
                                    )}
                                    <button type="button" onClick={() => removeQ(i)} className="btn-danger-ghost" disabled={form.questoes.length === 1}>
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={addQ} className="mt-3 text-sm text-brand-forest hover:text-brand-forest-hover flex items-center gap-1">
                            <Plus size={14} /> Adicionar questão
                        </button>
                    </div>

                    {error && <div className="text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">{error}</div>}

                    <div className="flex gap-3 pt-2">
                        <button onClick={close} className="btn-ghost">Cancelar</button>
                        <button data-testid="inst-save" onClick={submit} disabled={busy} className="btn-primary">
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
                            <th className="px-5 py-2.5 font-semibold">Data</th>
                            <th className="px-5 py-2.5 font-semibold">Questões</th>
                            <th className="px-5 py-2.5 font-semibold">Total pts</th>
                            <th className="px-5 py-2.5 font-semibold w-36 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody data-testid="instrumentos-list">
                        {insts.length === 0 ? (
                            <tr><td colSpan={6} className="px-5 py-12 text-center text-brand-sage">Sem instrumentos criados.</td></tr>
                        ) : insts.map((inst, i) => (
                            <tr key={inst.id} className={`border-b border-crisp last:border-0 row-hover ${i % 2 === 1 ? "bg-page/60" : ""}`}>
                                <td className="px-5 py-3 font-medium text-brand-charcoal">{inst.nome}</td>
                                <td className="px-5 py-3">
                                    <span className="text-[11px] bg-page border border-crisp text-brand-charcoal/80 px-2 py-0.5 rounded-full">{inst.tipo}</span>
                                </td>
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
