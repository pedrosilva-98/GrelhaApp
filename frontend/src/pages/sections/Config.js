import { useEffect, useState } from "react";
import { domColor } from "@/lib/grelha";
import { Save, Plus, X, Upload, CalendarRange } from "lucide-react";

export default function Config({
    turma,
    dominios,
    saveDominios,
    saveTurmaConfig,
}) {
    return (
        <div className="max-w-3xl space-y-10 anim-in" data-testid="config-view">
            <SemestresSection turma={turma} saveTurmaConfig={saveTurmaConfig} />
            <MetaSucessoSection turma={turma} saveTurmaConfig={saveTurmaConfig} />
            <DominiosSection dominios={dominios} saveDominios={saveDominios} />
            <ParametrosODSection turma={turma} saveTurmaConfig={saveTurmaConfig} />
            <div className="card-surface p-5 text-sm text-brand-charcoal/70">
                As <strong>Aprendizagens essenciais</strong> desta turma são agora geridas pelo administrador do agrupamento. Continuam disponíveis para associar a questões nos instrumentos de avaliação.
            </div>
        </div>
    );
}

// ─── Semestres ───────────────────────────────────────────────────────────────
function SemestresSection({ turma, saveTurmaConfig }) {
    const initial = turma?.semestres || {};
    const [s1, setS1] = useState({ inicio: "", fim: "", peso: 50, ...(initial["1"] || {}) });
    const [s2, setS2] = useState({ inicio: "", fim: "", peso: 50, ...(initial["2"] || {}) });
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const cur = turma?.semestres || {};
        setS1({ inicio: "", fim: "", peso: 50, ...(cur["1"] || {}) });
        setS2({ inicio: "", fim: "", peso: 50, ...(cur["2"] || {}) });
        setError("");
    }, [turma?.id, turma?.semestres]);

    const total = (parseInt(s1.peso) || 0) + (parseInt(s2.peso) || 0);
    const datesValid = (!s1.inicio || !s1.fim || s1.inicio <= s1.fim) &&
                       (!s2.inicio || !s2.fim || s2.inicio <= s2.fim);
    const valid = total === 100 && datesValid;

    async function save() {
        setError(""); setBusy(true);
        try {
            await saveTurmaConfig({
                semestres: {
                    "1": { inicio: s1.inicio || "", fim: s1.fim || "", peso: parseInt(s1.peso) || 0 },
                    "2": { inicio: s2.inicio || "", fim: s2.fim || "", peso: parseInt(s2.peso) || 0 },
                },
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
        } catch (e) {
            setError(e?.response?.data?.detail || e?.message || "Erro ao guardar.");
        } finally { setBusy(false); }
    }

    return (
        <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-sage mb-1 flex items-center gap-2">
                <CalendarRange size={12} /> Calendário
            </div>
            <h2 className="font-serif text-xl text-brand-forest mb-2">Semestres</h2>
            <p className="text-sm text-brand-charcoal/70 mb-6 leading-relaxed max-w-lg">
                Defina as datas de início e fim dos semestres e os pesos respetivos. A soma dos pesos tem de ser <strong>100%</strong>. Os instrumentos serão validados contra estas datas.
            </p>

            <div className="card-surface p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.2em] text-brand-sage">Soma dos pesos</div>
                        <div className={`font-serif text-3xl tabular-nums ${total === 100 ? "text-[#2E6B2E]" : "text-[#9E3921]"}`}>{total}%</div>
                    </div>
                    <div className={`text-xs px-3 py-1 rounded-full border ${valid ? "bg-[#E6F3E6] text-[#2E6B2E] border-[#B3D9B3]" : "bg-[#FDF0ED] text-[#9E3921] border-[#F5C2B8]"}`}>
                        {valid ? "Válido" : total !== 100 ? "Pesos devem totalizar 100%" : "Datas inválidas"}
                    </div>
                </div>

                {[{ key: "1", label: "1º Semestre", data: s1, setData: setS1 },
                  { key: "2", label: "2º Semestre", data: s2, setData: setS2 }].map(({ key, label, data, setData }) => (
                    <div key={key} className="border-t border-crisp pt-4 first:border-t-0 first:pt-0" data-testid={`sem-${key}`}>
                        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-forest mb-3">{label}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Início</label>
                                <input data-testid={`sem-${key}-inicio`} type="date" className="input-forest" value={data.inicio || ""} onChange={(e) => setData((d) => ({ ...d, inicio: e.target.value }))} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Fim</label>
                                <input data-testid={`sem-${key}-fim`} type="date" className="input-forest" value={data.fim || ""} onChange={(e) => setData((d) => ({ ...d, fim: e.target.value }))} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Peso (%)</label>
                                <input data-testid={`sem-${key}-peso`} type="number" min={0} max={100} className="input-forest" value={data.peso} onChange={(e) => setData((d) => ({ ...d, peso: e.target.value }))} />
                            </div>
                        </div>
                    </div>
                ))}

                {error && <div className="text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">{error}</div>}

                <button data-testid="sem-save-btn" onClick={save} disabled={!valid || busy} className="btn-primary w-full justify-center">
                    <Save size={16} />
                    {saved ? "Guardado ✓" : busy ? "A guardar..." : "Guardar semestres"}
                </button>
            </div>
        </div>
    );
}

// ─── Meta de sucesso ────────────────────────────────────────────────────────
function MetaSucessoSection({ turma, saveTurmaConfig }) {
    const [val, setVal] = useState(turma?.meta_sucesso != null ? String(turma.meta_sucesso) : "");
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        setVal(turma?.meta_sucesso != null ? String(turma.meta_sucesso) : "");
        setError("");
    }, [turma?.id, turma?.meta_sucesso]);

    const num = val === "" ? null : parseFloat(val);
    const valid = num != null && !Number.isNaN(num) && num >= 0 && num <= 100;

    async function save() {
        setError(""); setBusy(true);
        try {
            await saveTurmaConfig({ meta_sucesso: num });
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
        } catch (e) {
            setError(e?.response?.data?.detail || e?.message || "Erro ao guardar.");
        } finally { setBusy(false); }
    }

    return (
        <div>
            <h2 className="font-serif text-xl text-brand-forest mb-2">Meta de sucesso do Agrupamento</h2>
            <p className="text-sm text-brand-charcoal/70 mb-6 leading-relaxed max-w-lg">
                Aparecerá no Resumo sob a taxa de sucesso.
            </p>
            <div className="card-surface p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3 items-end">
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Meta (%)</label>
                        <input data-testid="meta-sucesso-input" type="number" min={0} max={100} step="0.1" className="input-forest" value={val} onChange={(e) => setVal(e.target.value)} placeholder="Ex: 60" />
                    </div>
                </div>
                {error && <div className="text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">{error}</div>}
                <button data-testid="meta-save-btn" onClick={save} disabled={!valid || busy} className="btn-primary w-full justify-center">
                    <Save size={16} />
                    {saved ? "Guardado ✓" : busy ? "A guardar..." : "Guardar meta"}
                </button>
            </div>
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

// ─── Parâmetros Observação Direta ────────────────────────────────────────────
function ParametrosODSection({ turma, saveTurmaConfig }) {
    const [items, setItems] = useState(turma?.parametros_od || []);
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => { setItems(turma?.parametros_od || []); setError(""); }, [turma?.id, turma?.parametros_od]);

    const namesFilled = items.every((p) => (p.nome || "").trim().length > 0);
    const valid = namesFilled;

    function update(i, key, val) { setItems((s) => s.map((p, idx) => (idx === i ? { ...p, [key]: val } : p))); }
    function add() {
        setItems((s) => [...s, { id: `P${Date.now().toString(36)}${s.length}`, nome: "" }]);
    }
    function remove(i) { setItems((s) => s.filter((_, idx) => idx !== i)); }

    async function save() {
        setError(""); setBusy(true);
        try {
            await saveTurmaConfig({
                parametros_od: items.map((p) => ({
                    id: (p.id || `P${Date.now().toString(36)}`).trim(),
                    nome: (p.nome || "").trim(),
                    dom: null,
                })),
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
        } catch (e) {
            setError(e?.response?.data?.detail || e?.message || "Erro ao guardar.");
        } finally { setBusy(false); }
    }

    return (
        <div>
            <h2 className="font-serif text-xl text-brand-forest mb-2">Parâmetros de Observação Direta</h2>
            <p className="text-sm text-brand-charcoal/70 mb-6 leading-relaxed max-w-lg">
                Configure os parâmetros a avaliar por observação direta. Estes parâmetros aparecerão na página <strong>Instrumentos de avaliação</strong> para lhes atribuir uma nota 0–10 por aluno e escolher o domínio correspondente.
            </p>

            <div className="card-surface p-6 space-y-4">
                {items.length === 0 ? (
                    <div className="border-2 border-dashed border-crisp rounded-lg py-8 text-center text-brand-sage text-sm">
                        Ainda não há parâmetros definidos para esta turma.
                    </div>
                ) : (
                    <div className="space-y-3" data-testid="param-od-list">
                        {items.map((p, i) => (
                            <div key={i} className="flex items-start gap-2" data-testid={`param-row-${i}`}>
                                <span className="text-xs font-mono text-brand-sage w-8 mt-3 tabular-nums shrink-0">{String(i + 1).padStart(2, "0")}</span>
                                <input
                                    data-testid={`param-nome-${i}`}
                                    className="input-forest flex-1 text-sm"
                                    value={p.nome}
                                    onChange={(e) => update(i, "nome", e.target.value)}
                                    placeholder="Ex: Participação, Cooperação, Autonomia..."
                                />
                                <button type="button" onClick={() => remove(i)} className="btn-danger-ghost shrink-0" title="Remover">
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <button type="button" onClick={add} data-testid="param-add-btn" className="text-sm text-brand-forest hover:text-brand-forest-hover flex items-center gap-1">
                    <Plus size={14} /> Adicionar parâmetro
                </button>

                {error && <div className="text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">{error}</div>}

                <button data-testid="param-save-btn" onClick={save} disabled={!valid || busy} className="btn-primary w-full justify-center">
                    <Save size={16} />
                    {saved ? "Guardado ✓" : busy ? "A guardar..." : "Guardar parâmetros"}
                </button>
            </div>
        </div>
    );
}

