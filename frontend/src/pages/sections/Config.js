import { useEffect, useState } from "react";
import { DOM_KEYS, DOMINIOS } from "@/lib/grelha";
import { Save } from "lucide-react";

export default function Config({ ponderacoes, savePonderacoes }) {
    const [vals, setVals] = useState({ ...ponderacoes });
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => { setVals({ ...ponderacoes }); }, [ponderacoes]);

    const total = DOM_KEYS.reduce((s, d) => s + (parseInt(vals[d]) || 0), 0);
    const valid = total === 100;

    async function save() {
        setError("");
        setBusy(true);
        try {
            await savePonderacoes(vals);
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
        } catch (e) {
            setError(e.message || "Erro ao guardar.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="max-w-xl anim-in" data-testid="config-view">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-sage mb-1">Definições</div>
            <h2 className="font-serif text-xl text-brand-forest mb-6">Ponderações dos domínios</h2>

            <div className="card-surface p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.2em] text-brand-sage">Soma atual</div>
                        <div className={`font-serif text-3xl tabular-nums ${valid ? "text-[#2E6B2E]" : "text-[#9E3921]"}`}>{total}%</div>
                    </div>
                    <div className={`text-xs px-3 py-1 rounded-full border ${valid ? "bg-[#E6F3E6] text-[#2E6B2E] border-[#B3D9B3]" : "bg-[#FDF0ED] text-[#9E3921] border-[#F5C2B8]"}`}>
                        {valid ? "Válido" : "Deve totalizar 100%"}
                    </div>
                </div>

                {DOM_KEYS.map((d) => (
                    <div key={d}>
                        <div className="flex justify-between items-baseline mb-2">
                            <div>
                                <span className="font-medium text-brand-charcoal">{d}</span>
                                <span className="text-brand-charcoal/50 text-xs ml-2">— {DOMINIOS[d].nome}</span>
                            </div>
                            <span className="font-mono text-base text-brand-forest tabular-nums">{vals[d]}%</span>
                        </div>
                        <input
                            data-testid={`pond-${d}`}
                            type="range"
                            min={0}
                            max={100}
                            value={vals[d]}
                            onChange={(e) => setVals((v) => ({ ...v, [d]: parseInt(e.target.value) }))}
                            className="forest-range w-full"
                            style={{ accentColor: DOMINIOS[d].color }}
                        />
                    </div>
                ))}

                {error && <div className="text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">{error}</div>}

                <button
                    data-testid="pond-save-btn"
                    onClick={save}
                    disabled={!valid || busy}
                    className="btn-primary w-full justify-center"
                >
                    <Save size={16} />
                    {saved ? "Guardado ✓" : busy ? "A guardar..." : "Guardar ponderações"}
                </button>
            </div>
        </div>
    );
}
