import { useEffect, useRef, useState } from "react";
import Badge from "@/components/Badge";
import { calcClassif, DOMINIOS } from "@/lib/grelha";

// Debounce hook for saving notas
function useDebouncedCallback(cb, delay) {
    const t = useRef(null);
    return (...args) => {
        if (t.current) clearTimeout(t.current);
        t.current = setTimeout(() => cb(...args), delay);
    };
}

export default function LancarNotas({ alunos, insts, saveNotas }) {
    const [instId, setInstId] = useState(insts[0]?.id || null);

    useEffect(() => {
        if (!insts.find((i) => i.id === instId)) {
            setInstId(insts[0]?.id || null);
        }
    }, [insts, instId]);

    const inst = insts.find((i) => i.id === instId);
    const [notas, setNotas] = useState(inst?.notas || {});
    const [savedFlash, setSavedFlash] = useState(false);

    useEffect(() => { setNotas(inst?.notas || {}); }, [inst?.id]);

    const debouncedSave = useDebouncedCallback(async (id, payload) => {
        await saveNotas(id, payload);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1200);
    }, 600);

    function updateNota(alunoId, qId, value, maxCot) {
        let v = value === "" ? "" : parseFloat(value);
        if (typeof v === "number" && !Number.isNaN(v)) {
            if (v < 0) v = 0;
            if (v > maxCot) v = maxCot;
        }
        const next = {
            ...notas,
            [alunoId]: { ...(notas[alunoId] || {}), [qId]: v === "" ? undefined : v },
        };
        // clean undefined
        if (next[alunoId][qId] === undefined) delete next[alunoId][qId];
        setNotas(next);
        // Build clean payload
        const clean = {};
        for (const [aid, nMap] of Object.entries(next)) {
            const inner = {};
            for (const [qk, val] of Object.entries(nMap)) {
                if (val != null && val !== "") inner[qk] = Number(val);
            }
            if (Object.keys(inner).length) clean[aid] = inner;
        }
        debouncedSave(inst.id, clean);
    }

    if (!insts.length) {
        return (
            <div className="card-surface p-12 text-center anim-in">
                <div className="text-[10px] uppercase tracking-[0.25em] text-brand-sage mb-2">Sem instrumentos</div>
                <h2 className="font-serif text-2xl text-brand-forest mb-3">Nada para lançar ainda</h2>
                <p className="text-brand-charcoal/70 text-sm max-w-sm mx-auto">
                    Crie primeiro um instrumento de avaliação em <em>Instrumentos</em>.
                </p>
            </div>
        );
    }

    // Simulate instrument-with-current-notas for calc
    const instWithNotas = inst ? { ...inst, notas } : null;

    return (
        <div className="space-y-5 anim-in" data-testid="notas-view">
            <div className="flex items-center gap-3 flex-wrap">
                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage">Instrumento</label>
                <select
                    data-testid="notas-inst-select"
                    className="input-forest max-w-md"
                    style={{ width: "auto" }}
                    value={instId || ""}
                    onChange={(e) => setInstId(e.target.value)}
                >
                    {insts.map((i) => <option key={i.id} value={i.id}>{i.nome} · {i.tipo}</option>)}
                </select>
                <div className="ml-auto text-xs text-brand-sage flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${savedFlash ? "bg-[#2E6B2E]" : "bg-brand-sage/40"}`} />
                    {savedFlash ? "Guardado" : "Auto-guardar ativo"}
                </div>
            </div>

            {inst && (
                <div className="card-surface overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-page border-b border-crisp sticky top-0">
                                <tr>
                                    <th className="text-left px-5 py-3 text-[11px] uppercase tracking-[0.15em] text-brand-sage font-semibold min-w-[180px]">Aluno</th>
                                    {inst.questoes.map((q) => (
                                        <th key={q.id} className="px-2 py-2 text-center">
                                            <div className="text-[13px] font-medium text-brand-charcoal font-mono">{q.id}</div>
                                            <div className="text-[10px] tabular-nums font-mono" style={{ color: DOMINIOS[q.dom]?.color }}>
                                                {q.dom} · {Number(q.cotacao).toFixed(1)}
                                            </div>
                                        </th>
                                    ))}
                                    <th className="px-4 py-3 text-[11px] uppercase tracking-[0.15em] text-brand-sage font-semibold">Classif.</th>
                                    <th className="px-4 py-3 text-[11px] uppercase tracking-[0.15em] text-brand-sage font-semibold">Nível</th>
                                </tr>
                            </thead>
                            <tbody>
                                {alunos.length === 0 ? (
                                    <tr><td colSpan={inst.questoes.length + 3} className="px-5 py-10 text-center text-brand-sage">Adicione alunos primeiro.</td></tr>
                                ) : alunos.map((a, i) => {
                                    const classif = calcClassif(instWithNotas, a.id);
                                    return (
                                        <tr key={a.id} className={`border-b border-crisp last:border-0 row-hover ${i % 2 === 1 ? "bg-page/60" : ""}`}>
                                            <td className="px-5 py-2.5 font-medium text-brand-charcoal whitespace-nowrap">{a.nome}</td>
                                            {inst.questoes.map((q) => {
                                                const cur = notas[a.id]?.[q.id];
                                                return (
                                                    <td key={q.id} className="px-1.5 py-1.5 text-center">
                                                        <input
                                                            data-testid={`nota-${a.id}-${q.id}`}
                                                            type="number"
                                                            step="0.1"
                                                            min={0}
                                                            max={q.cotacao}
                                                            value={cur ?? ""}
                                                            onChange={(e) => updateNota(a.id, q.id, e.target.value, q.cotacao)}
                                                            className="grid-cell-input"
                                                        />
                                                    </td>
                                                );
                                            })}
                                            <td className="px-4 py-2.5 tabular-nums font-serif text-base text-brand-forest">
                                                {classif != null ? classif.toFixed(1) + "%" : "—"}
                                            </td>
                                            <td className="px-4 py-2.5"><Badge v={classif} /></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
