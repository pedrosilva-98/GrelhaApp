import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, X, Loader2 } from "lucide-react";
import Badge from "@/components/Badge";
import { domColor, isEscala20, formatAvaliacao, resumoTurma } from "@/lib/grelha";
import { exportRelatorioSemestrePDF, exportRelatorioAnualPDF } from "@/lib/relatorios";

export default function Dashboard({ user, turma, alunos, insts, dominios }) {
    const [semFilter, setSemFilter] = useState(""); // "", "1", "2"
    const [showRelatorios, setShowRelatorios] = useState(false);
    const escala20 = isEscala20(turma);

    const { filteredInsts, medias, mediaGeral, taxaSucessoPct, meta, dist } = useMemo(
        () => resumoTurma({ turma, alunos, insts, dominios, sem: semFilter ? parseInt(semFilter) : null }),
        [turma, alunos, insts, dominios, semFilter]
    );

    // 10º-12º: média real na escala 0-20 (às centésimas) e nível = esse valor arredondado às unidades.
    const media20 = (pct) => (pct == null ? null : Math.round((pct / 100) * 20 * 100) / 100);
    const maxCount = Math.max(1, ...dist.map((d) => d.count));

    const kpis = [
        { label: "Alunos", value: alunos.length, hint: "na turma" },
        { label: "Instrumentos de avaliação", value: filteredInsts.length, hint: semFilter ? `${semFilter}º Semestre` : "criados" },
        {
            label: "Média da turma",
            value: mediaGeral != null ? formatAvaliacao(mediaGeral, turma) : "—",
            hint: "ponderada",
        },
        {
            label: "Taxa de sucesso",
            value: taxaSucessoPct != null ? taxaSucessoPct + "%" : "—",
            hint: meta != null ? `meta ${meta}%` : "≥ 50%",
            highlight: meta != null && taxaSucessoPct != null ? (taxaSucessoPct >= meta ? "ok" : "low") : null,
        },
    ];

    return (
        <div className="space-y-8 anim-in" data-testid="dashboard-view">
            {/* Semester filter */}
            <div className="flex items-center gap-2 flex-wrap" data-testid="sem-filter">
                {[{ id: "1", label: "1º Semestre" }, { id: "2", label: "2º Semestre" }, { id: "", label: "Anual" }].map((f) => (
                    <button
                        key={f.id || "all"}
                        data-testid={`sem-filter-${f.id || "all"}`}
                        onClick={() => setSemFilter(f.id)}
                        className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                            semFilter === f.id
                                ? "bg-brand-forest text-page border-brand-forest"
                                : "bg-surface border-crisp text-brand-charcoal hover:bg-page"
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
                {!semFilter && (
                    <button data-testid="relatorios-btn" onClick={() => setShowRelatorios(true)} className="btn-ghost ml-auto">
                        <FileText size={15} /> Relatórios
                    </button>
                )}
            </div>

            {showRelatorios && (
                <RelatoriosModal
                    onClose={() => setShowRelatorios(false)}
                    gerar={(tipo) => {
                        const params = { user, turma, alunos, insts, dominios };
                        if (tipo === "anual") exportRelatorioAnualPDF(params);
                        else exportRelatorioSemestrePDF({ ...params, sem: tipo === "s1" ? 1 : 2 });
                    }}
                />
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((k) => (
                    <div key={k.label} className="card-surface p-5 transition-transform duration-200 hover:-translate-y-[1px]">
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-sage mb-3">{k.label}</div>
                        <div className={`font-serif text-3xl tabular-nums ${
                            k.highlight === "ok" ? "text-[#2E6B2E]" : k.highlight === "low" ? "text-[#9E3921]" : "text-brand-forest"
                        }`} data-testid={`kpi-${k.label.replace(/\s+/g, "-").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}>{k.value}</div>
                        <div className="text-[11px] text-brand-charcoal/50 mt-1">{k.hint}</div>
                    </div>
                ))}
            </div>

            <div className="card-surface overflow-hidden">
                <div className="px-5 pt-5 pb-3 flex items-baseline justify-between flex-wrap gap-3">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-sage">Visão Geral {semFilter ? `· ${semFilter}º Sem.` : ""}</div>
                        <h2 className="font-serif text-xl text-brand-forest">Avaliação dos alunos por domínio</h2>
                    </div>
                    <div className="text-[11px] text-brand-sage flex gap-3 flex-wrap">
                        {dominios.map((d, i) => (
                            <span key={d.code} className="flex items-center gap-1.5">
                                <span className="inline-block w-2 h-2 rounded-full" style={{ background: domColor(i) }} />
                                {d.code}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-page border-y border-crisp">
                            <tr className="text-left text-[11px] uppercase tracking-[0.15em] text-brand-sage">
                                <th className="px-5 py-2.5 font-semibold">Aluno</th>
                                {dominios.map((d, i) => (
                                    <th key={d.code} className="px-4 py-2.5 font-semibold tabular-nums" style={{ color: domColor(i) }}>{d.code}</th>
                                ))}
                                <th className="px-4 py-2.5 font-semibold">Média</th>
                                <th className="px-4 py-2.5 font-semibold">Nível</th>
                            </tr>
                        </thead>
                        <tbody>
                            {medias.length === 0 && (
                                <tr><td colSpan={dominios.length + 3} className="px-5 py-10 text-center text-brand-sage">Sem alunos ainda.</td></tr>
                            )}
                            {medias.map((a, i) => (
                                <tr key={a.id} className={`border-b border-crisp last:border-0 row-hover ${i % 2 === 1 ? "bg-page/60" : ""}`}>
                                    <td className="px-5 py-3 font-medium text-brand-charcoal"><span className="font-mono text-xs text-brand-sage tabular-nums mr-2">{a.numero}</span>{a.nome}</td>
                                    {dominios.map((d) => (
                                        <td key={d.code} className="px-4 py-3 tabular-nums text-brand-charcoal/80 font-mono text-[13px]">
                                            {formatAvaliacao(a.doms[d.code], turma)}
                                        </td>
                                    ))}
                                    <td className="px-4 py-3 tabular-nums font-serif text-brand-forest text-base">
                                        {escala20
                                            ? (a.media != null ? media20(a.media).toFixed(2).replace(".", ",") : "—")
                                            : formatAvaliacao(a.media, turma)}
                                    </td>
                                    <td className="px-4 py-3">
                                        {escala20 ? (
                                            a.media != null ? (
                                                <span data-testid={`nivel20-${a.id}`} className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-medium font-mono min-w-[26px] border border-crisp bg-page text-brand-forest">
                                                    {Math.round(media20(a.media))}
                                                </span>
                                            ) : <span className="text-brand-sage text-xs">—</span>
                                        ) : (
                                            <Badge v={a.media} mode="number" />
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {!escala20 && (
                <div className="card-surface p-6">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-sage mb-1">Distribuição</div>
                    <h2 className="font-serif text-xl text-brand-forest mb-6">Níveis atribuídos</h2>
                    <div className="grid grid-cols-5 gap-4">
                        {dist.map((d) => (
                            <div key={d.n} className="flex flex-col items-start">
                                <div className="font-serif text-4xl text-brand-forest mb-2 tabular-nums">{d.count}</div>
                                <div className="w-full h-1.5 bg-crisp/60 rounded-full overflow-hidden mb-3">
                                    <div className="h-full bg-brand-forest rounded-full transition-all duration-500" style={{ width: `${(d.count / maxCount) * 100}%` }} />
                                </div>
                                <Badge level={d.n} mode="number" />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

const TIPOS_RELATORIO = [
    { id: "s1", label: "Avaliação de 1º semestre", hint: "A informação do Resumo no 1º semestre." },
    { id: "s2", label: "Avaliação de 2º semestre", hint: "A informação do Resumo no 2º semestre." },
    { id: "anual", label: "Relatório anual", hint: "Relatório de final de ano letivo, mais completo." },
];

function RelatoriosModal({ onClose, gerar }) {
    const [tipo, setTipo] = useState("anual");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function confirmar() {
        setBusy(true); setError("");
        try {
            await new Promise((r) => setTimeout(r, 30)); // deixa aparecer o "A gerar..."
            gerar(tipo);
            onClose();
        } catch (e) {
            setError(e?.message || "Erro ao gerar o relatório.");
        } finally { setBusy(false); }
    }

    return createPortal(
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="card-surface w-full max-w-md p-6 anim-in" onClick={(e) => e.stopPropagation()} data-testid="relatorios-modal">
                <div className="flex items-start justify-between mb-5">
                    <h2 className="font-serif text-xl text-brand-forest">Relatórios</h2>
                    <button onClick={onClose} className="text-brand-sage hover:text-brand-charcoal"><X size={20} /></button>
                </div>
                <div className="space-y-2">
                    {TIPOS_RELATORIO.map((t) => (
                        <label
                            key={t.id}
                            data-testid={`relatorio-tipo-${t.id}`}
                            className={`flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors ${tipo === t.id ? "border-brand-forest bg-page" : "border-crisp hover:bg-page"}`}
                        >
                            <input type="radio" name="tipo-relatorio" checked={tipo === t.id} onChange={() => setTipo(t.id)} className="mt-1 accent-brand-forest" />
                            <span>
                                <span className="block text-sm font-medium text-brand-charcoal">{t.label}</span>
                                <span className="block text-xs text-brand-charcoal/60">{t.hint}</span>
                            </span>
                        </label>
                    ))}
                </div>
                {error && <div className="mt-3 text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">{error}</div>}
                <div className="flex gap-3 mt-5">
                    <button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
                    <button data-testid="relatorio-gerar" onClick={confirmar} disabled={busy} className="btn-primary flex-1 justify-center">
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} {busy ? "A gerar..." : "Gerar PDF"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
