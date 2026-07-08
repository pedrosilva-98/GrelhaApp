import { useEffect, useState } from "react";
import { domColor } from "@/lib/grelha";
import { Save, Plus, X } from "lucide-react";

export default function Config({ dominios, saveDominios }) {
    const [items, setItems] = useState(dominios || []);
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => { setItems(dominios || []); setError(""); }, [dominios]);

    const total = items.reduce((s, d) => s + (parseInt(d.peso) || 0), 0);
    const codes = items.map((d) => (d.code || "").trim());
    const codesUnique = new Set(codes).size === codes.length && codes.every((c) => c.length > 0);
    const namesFilled = items.every((d) => (d.nome || "").trim().length > 0);
    const valid = total === 100 && items.length > 0 && codesUnique && namesFilled;

    function update(i, key, val) {
        setItems((s) => s.map((d, idx) => (idx === i ? { ...d, [key]: val } : d)));
    }
    function add() {
        // Suggest a fresh code
        let n = items.length + 1;
        let code;
        do { code = `D${n}`; n++; } while (items.some((d) => d.code === code));
        setItems((s) => [...s, { code, nome: "", peso: 0 }]);
    }
    function remove(i) {
        setItems((s) => s.filter((_, idx) => idx !== i));
    }

    async function save() {
        setError("");
        setBusy(true);
        try {
            await saveDominios(items.map((d) => ({
                code: (d.code || "").trim(),
                nome: (d.nome || "").trim(),
                peso: parseInt(d.peso) || 0,
            })));
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
        } catch (e) {
            setError(e.message || "Erro ao guardar.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="max-w-2xl anim-in" data-testid="config-view">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-sage mb-1">Definições da turma</div>
            <h2 className="font-serif text-xl text-brand-forest mb-2">Domínios de avaliação</h2>
            <p className="text-sm text-brand-charcoal/70 mb-6 leading-relaxed max-w-lg">
                Configure os domínios utilizados nesta turma. Pode adicionar/remover domínios, mudar o nome e ajustar a ponderação. A soma das ponderações tem de ser <strong>100%</strong>.
            </p>

            <div className="card-surface p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.2em] text-brand-sage">Soma atual</div>
                        <div className={`font-serif text-3xl tabular-nums ${total === 100 ? "text-[#2E6B2E]" : "text-[#9E3921]"}`}>{total}%</div>
                    </div>
                    <div className={`text-xs px-3 py-1 rounded-full border ${valid ? "bg-[#E6F3E6] text-[#2E6B2E] border-[#B3D9B3]" : "bg-[#FDF0ED] text-[#9E3921] border-[#F5C2B8]"}`}>
                        {valid ? "Válido" : (total !== 100 ? "Deve totalizar 100%" : !codesUnique ? "Códigos duplicados/vazios" : "Nomes em falta")}
                    </div>
                </div>

                <div className="space-y-4">
                    {items.map((d, i) => (
                        <div key={i} className="border-t border-crisp pt-4 first:border-t-0 first:pt-0" data-testid={`dom-row-${i}`}>
                            <div className="flex items-start gap-3 mb-2">
                                <div className="w-8 h-8 rounded-md mt-1" style={{ background: domColor(i) }} />
                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-[100px_1fr] gap-2">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Código</label>
                                        <input data-testid={`dom-code-${i}`} className="input-forest font-mono text-sm" value={d.code} onChange={(e) => update(i, "code", e.target.value.toUpperCase())} placeholder="CP" maxLength={8} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Nome</label>
                                        <input data-testid={`dom-nome-${i}`} className="input-forest" value={d.nome} onChange={(e) => update(i, "nome", e.target.value)} placeholder="Nome do domínio" />
                                    </div>
                                </div>
                                <button type="button" onClick={() => remove(i)} className="btn-danger-ghost mt-6" title="Remover">
                                    <X size={14} />
                                </button>
                            </div>
                            <div className="ml-11">
                                <div className="flex justify-between items-baseline mb-1.5">
                                    <span className="text-[11px] uppercase tracking-[0.2em] text-brand-sage">Ponderação</span>
                                    <span className="font-mono text-brand-forest tabular-nums">{d.peso}%</span>
                                </div>
                                <input
                                    data-testid={`dom-peso-${i}`}
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={d.peso}
                                    onChange={(e) => update(i, "peso", parseInt(e.target.value))}
                                    className="forest-range w-full"
                                    style={{ accentColor: domColor(i) }}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <button type="button" onClick={add} data-testid="dom-add-btn" className="text-sm text-brand-forest hover:text-brand-forest-hover flex items-center gap-1">
                    <Plus size={14} /> Adicionar domínio
                </button>

                {error && <div className="text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">{error}</div>}

                <button
                    data-testid="dom-save-btn"
                    onClick={save}
                    disabled={!valid || busy}
                    className="btn-primary w-full justify-center"
                >
                    <Save size={16} />
                    {saved ? "Guardado ✓" : busy ? "A guardar..." : "Guardar domínios"}
                </button>
            </div>
        </div>
    );
}
