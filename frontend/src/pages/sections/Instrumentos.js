import { useState } from "react";
import { Plus, X, Trash2, FilePlus } from "lucide-react";
import { TIPOS_INSTRUMENTO, DOM_KEYS, DOMINIOS } from "@/lib/grelha";

export default function Instrumentos({ insts, addInstrumento, delInstrumento }) {
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ nome: "", tipo: "F.Sumativa", data: "" });
    const [questoes, setQuestoes] = useState([{ id: "q1", dom: "CP", cotacao: "" }]);
    const [error, setError] = useState("");

    function reset() {
        setForm({ nome: "", tipo: "F.Sumativa", data: "" });
        setQuestoes([{ id: "q1", dom: "CP", cotacao: "" }]);
        setError("");
    }
    function addQ() {
        setQuestoes((qs) => [...qs, { id: "q" + (qs.length + 1), dom: "CP", cotacao: "" }]);
    }
    function removeQ(idx) {
        setQuestoes((qs) => qs.filter((_, i) => i !== idx));
    }
    function updateQ(idx, k, v) {
        setQuestoes((qs) => qs.map((q, i) => (i === idx ? { ...q, [k]: v } : q)));
    }
    async function submit(e) {
        e.preventDefault();
        setError("");
        if (!form.nome.trim()) { setError("Indique um nome."); return; }
        const qs = questoes
            .filter((q) => q.id.trim() && q.cotacao !== "" && !Number.isNaN(parseFloat(q.cotacao)))
            .map((q) => ({ id: q.id.trim(), dom: q.dom, cotacao: parseFloat(q.cotacao) }));
        if (!qs.length) { setError("Adicione pelo menos uma questão com cotação."); return; }
        try {
            await addInstrumento({ ...form, questoes: qs });
            reset();
            setShowForm(false);
        } catch (err) {
            setError(err.message || "Erro ao guardar.");
        }
    }
    const totalCot = questoes.reduce((s, q) => s + (parseFloat(q.cotacao) || 0), 0);

    return (
        <div className="space-y-6 anim-in" data-testid="instrumentos-view">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-sage mb-1">Avaliação</div>
                    <h2 className="font-serif text-xl text-brand-forest">Instrumentos</h2>
                </div>
                {!showForm && (
                    <button data-testid="new-instrumento-btn" onClick={() => setShowForm(true)} className="btn-primary">
                        <FilePlus size={16} /> Novo instrumento
                    </button>
                )}
            </div>

            {showForm && (
                <div className="card-surface p-6 space-y-5" data-testid="instrumento-form">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-sage mb-1">Criar</div>
                            <h3 className="font-serif text-lg text-brand-forest">Novo instrumento</h3>
                        </div>
                        <button onClick={() => { reset(); setShowForm(false); }} className="text-brand-sage hover:text-brand-charcoal">
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
                                {TIPOS_INSTRUMENTO.map((t) => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage block mb-1.5">Data</label>
                            <input data-testid="inst-data" className="input-forest" placeholder="dd/mm/aaaa" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
                        </div>
                    </div>

                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage mb-3">
                            Questões · Total: <span className="text-brand-forest">{totalCot.toFixed(1)} pts</span>
                        </div>
                        <div className="space-y-2">
                            {questoes.map((q, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-brand-sage w-6 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                                    <input data-testid={`q-id-${i}`} className="input-forest w-28" placeholder="ID (ex: 1.1)" value={q.id} onChange={(e) => updateQ(i, "id", e.target.value)} />
                                    <select data-testid={`q-dom-${i}`} className="input-forest w-24" value={q.dom} onChange={(e) => updateQ(i, "dom", e.target.value)} style={{ color: DOMINIOS[q.dom]?.color }}>
                                        {DOM_KEYS.map((d) => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                    <input data-testid={`q-cot-${i}`} type="number" step="0.1" className="input-forest w-24" placeholder="Pts" value={q.cotacao} onChange={(e) => updateQ(i, "cotacao", e.target.value)} />
                                    <button type="button" onClick={() => removeQ(i)} className="btn-danger-ghost" disabled={questoes.length === 1}>
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
                        <button onClick={() => { reset(); setShowForm(false); }} className="btn-ghost">Cancelar</button>
                        <button data-testid="inst-save" onClick={submit} className="btn-primary">Guardar instrumento</button>
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
                            <th className="px-5 py-2.5 font-semibold w-16"></th>
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
                                <td className="px-5 py-3 text-brand-charcoal/70">{inst.data || "—"}</td>
                                <td className="px-5 py-3 tabular-nums font-mono text-xs">{inst.questoes.length}</td>
                                <td className="px-5 py-3 tabular-nums font-mono text-xs">{inst.questoes.reduce((s, q) => s + Number(q.cotacao), 0).toFixed(1)}</td>
                                <td className="px-5 py-3 text-right">
                                    <button data-testid={`del-inst-${inst.id}`} onClick={() => delInstrumento(inst.id)} className="btn-danger-ghost">
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
