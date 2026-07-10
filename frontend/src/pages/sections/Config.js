import { useEffect, useState } from "react";
import { domColor } from "@/lib/grelha";
import { Save, Plus, X, Upload, Sparkles } from "lucide-react";
import CompetenciasImportModal from "@/components/CompetenciasImportModal";

export default function Config({ dominios, competencias, saveDominios, saveCompetencias }) {
    return (
        <div className="max-w-3xl space-y-10 anim-in" data-testid="config-view">
            <DominiosSection dominios={dominios} saveDominios={saveDominios} />
            <CompetenciasSection competencias={competencias || []} saveCompetencias={saveCompetencias} />
        </div>
    );
}

// ─── Dominios ────────────────────────────────────────────────────────────────
function DominiosSection({ dominios, saveDominios }) {
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

    function update(i, key, val) { setItems((s) => s.map((d, idx) => (idx === i ? { ...d, [key]: val } : d))); }
    function add() {
        let n = items.length + 1;
        let code;
        do { code = `D${n}`; n++; } while (items.some((d) => d.code === code));
        setItems((s) => [...s, { code, nome: "", peso: 0 }]);
    }
    function remove(i) { setItems((s) => s.filter((_, idx) => idx !== i)); }

    async function save() {
        setError(""); setBusy(true);
        try {
            await saveDominios(items.map((d) => ({
                code: (d.code || "").trim(),
                nome: (d.nome || "").trim(),
                peso: parseInt(d.peso) || 0,
            })));
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
        } catch (e) {
            setError(e?.response?.data?.detail || e?.message || "Erro ao guardar.");
        } finally { setBusy(false); }
    }

    return (
        <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-sage mb-1">Definições da turma</div>
            <h2 className="font-serif text-xl text-brand-forest mb-2">Domínios de avaliação</h2>
            <p className="text-sm text-brand-charcoal/70 mb-6 leading-relaxed max-w-lg">
                Configure os domínios utilizados nesta turma. Pode adicionar/remover, mudar o nome e ajustar a ponderação. A soma tem de ser <strong>100%</strong>.
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
                                <input data-testid={`dom-peso-${i}`} type="range" min={0} max={100} value={d.peso} onChange={(e) => update(i, "peso", parseInt(e.target.value))} className="forest-range w-full" style={{ accentColor: domColor(i) }} />
                            </div>
                        </div>
                    ))}
                </div>

                <button type="button" onClick={add} data-testid="dom-add-btn" className="text-sm text-brand-forest hover:text-brand-forest-hover flex items-center gap-1">
                    <Plus size={14} /> Adicionar domínio
                </button>

                {error && <div className="text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">{error}</div>}

                <button data-testid="dom-save-btn" onClick={save} disabled={!valid || busy} className="btn-primary w-full justify-center">
                    <Save size={16} />
                    {saved ? "Guardado ✓" : busy ? "A guardar..." : "Guardar domínios"}
                </button>
            </div>
        </div>
    );
}

// ─── Competencias ────────────────────────────────────────────────────────────
function CompetenciasSection({ competencias, saveCompetencias }) {
    const [items, setItems] = useState(competencias || []);
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");
    const [showImport, setShowImport] = useState(false);

    useEffect(() => { setItems(competencias || []); setError(""); }, [competencias]);

    const codes = items.map((c) => (c.code || "").trim());
    const codesUnique = new Set(codes).size === codes.length && codes.every((c) => c.length > 0);
    const namesFilled = items.every((c) => (c.nome || "").trim().length > 0);
    const valid = codesUnique && namesFilled;

    function update(i, key, val) { setItems((s) => s.map((c, idx) => (idx === i ? { ...c, [key]: val } : c))); }
    function add() {
        let n = items.length + 1;
        let code;
        do { code = `AE${n}`; n++; } while (items.some((c) => c.code === code));
        setItems((s) => [...s, { code, nome: "" }]);
    }
    function remove(i) { setItems((s) => s.filter((_, idx) => idx !== i)); }

    async function save() {
        setError(""); setBusy(true);
        try {
            await saveCompetencias(items.map((c) => ({
                code: (c.code || "").trim().toUpperCase(),
                nome: (c.nome || "").trim(),
            })));
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
        } catch (e) {
            setError(e?.response?.data?.detail || e?.message || "Erro ao guardar.");
        } finally { setBusy(false); }
    }

    async function handleImport(newComps) {
        // Merge with existing (keep existing, add new). Then persist.
        const merged = [...items];
        const codes = new Set(items.map((c) => c.code));
        for (const c of newComps) {
            if (!codes.has(c.code)) {
                merged.push(c);
                codes.add(c.code);
            }
        }
        await saveCompetencias(merged);
        setItems(merged);
    }

    return (
        <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-sage mb-1 flex items-center gap-2">
                <Sparkles size={12} /> Aprendizagens
            </div>
            <h2 className="font-serif text-xl text-brand-forest mb-2">Competências essenciais</h2>
            <p className="text-sm text-brand-charcoal/70 mb-6 leading-relaxed max-w-lg">
                Configure as competências essenciais desta turma. Depois, pode associar uma competência a cada questão dos instrumentos. Pode adicionar manualmente ou importar a partir de Excel/CSV.
            </p>

            <div className="card-surface p-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="text-sm">
                        <span className="text-brand-sage text-[11px] uppercase tracking-wider">Total</span>
                        <span className="font-serif text-2xl text-brand-forest ml-3 tabular-nums">{items.length}</span>
                    </div>
                    <button data-testid="comp-import-btn" onClick={() => setShowImport(true)} className="btn-ghost text-sm">
                        <Upload size={14} /> Importar Excel/CSV
                    </button>
                </div>

                {items.length === 0 ? (
                    <div className="border-2 border-dashed border-crisp rounded-lg py-8 text-center text-brand-sage text-sm">
                        Ainda não há competências definidas para esta turma.
                    </div>
                ) : (
                    <div className="space-y-2" data-testid="comp-list">
                        {items.map((c, i) => (
                            <div key={i} className="flex items-start gap-2" data-testid={`comp-row-${i}`}>
                                <span className="text-xs font-mono text-brand-sage w-6 mt-2 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                                <input
                                    data-testid={`comp-code-${i}`}
                                    className="input-forest font-mono text-sm w-28 mt-0.5"
                                    value={c.code}
                                    onChange={(e) => update(i, "code", e.target.value.toUpperCase())}
                                    maxLength={16}
                                    placeholder="AE1"
                                />
                                <textarea
                                    data-testid={`comp-nome-${i}`}
                                    className="input-forest flex-1 text-sm"
                                    rows={1}
                                    value={c.nome}
                                    onChange={(e) => update(i, "nome", e.target.value)}
                                    placeholder="Descritor da competência..."
                                />
                                <button type="button" onClick={() => remove(i)} className="btn-danger-ghost mt-1" title="Remover">
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <button type="button" onClick={add} data-testid="comp-add-btn" className="text-sm text-brand-forest hover:text-brand-forest-hover flex items-center gap-1">
                    <Plus size={14} /> Adicionar competência
                </button>

                {error && <div className="text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">{error}</div>}

                <button data-testid="comp-save-btn" onClick={save} disabled={!valid || busy} className="btn-primary w-full justify-center">
                    <Save size={16} />
                    {saved ? "Guardado ✓" : busy ? "A guardar..." : "Guardar competências"}
                </button>
            </div>

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
