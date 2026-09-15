import { useMemo, useState } from "react";
import Badge from "@/components/Badge";
import { NIVEIS, calcMediaFinal, calcMediasDominioAluno, getNivel, domColor, filterBySemestre, instsParaFinal, isEscala20, formatAvaliacao } from "@/lib/grelha";

export default function Dashboard({ turma, alunos, insts, dominios }) {
    const [semFilter, setSemFilter] = useState(""); // "", "1", "2"
    const escala20 = isEscala20(turma);

    const filteredInsts = useMemo(() => {
        if (!semFilter) return insts;
        return filterBySemestre(insts, parseInt(semFilter), turma);
    }, [insts, semFilter, turma]);

    const finalInsts = useMemo(() => instsParaFinal(filteredInsts), [filteredInsts]);

    const medias = alunos.map((a) => ({
        ...a,
        media: calcMediaFinal(finalInsts, dominios, a.id, turma, semFilter ? parseInt(semFilter) : null),
        doms: calcMediasDominioAluno(finalInsts, a.id, dominios, turma, semFilter ? parseInt(semFilter) : null),
    }));
    const comMedia = medias.filter((a) => a.media != null);
    const mediaGeral = comMedia.length ? comMedia.reduce((s, a) => s + a.media, 0) / comMedia.length : null;
    const taxaSucesso = comMedia.length ? comMedia.filter((a) => a.media >= 50).length / comMedia.length : null;
    const taxaSucessoPct = taxaSucesso != null ? Math.round(taxaSucesso * 100) : null;

    const meta = turma?.meta_sucesso != null ? Number(turma.meta_sucesso) : null;

    const dist = [5, 4, 3, 2, 1].map((n) => ({
        n,
        label: NIVEIS.find((x) => x.n === n).label,
        count: comMedia.filter((a) => { const nv = getNivel(a.media); return nv && nv.n === n; }).length,
    }));
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
            </div>

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
                                {!escala20 && <th className="px-4 py-2.5 font-semibold">Nível</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {medias.length === 0 && (
                                <tr><td colSpan={dominios.length + (escala20 ? 2 : 3)} className="px-5 py-10 text-center text-brand-sage">Sem alunos ainda.</td></tr>
                            )}
                            {medias.map((a, i) => (
                                <tr key={a.id} className={`border-b border-crisp last:border-0 row-hover ${i % 2 === 1 ? "bg-page/60" : ""}`}>
                                    <td className="px-5 py-3 font-medium text-brand-charcoal">{a.nome}</td>
                                    {dominios.map((d) => (
                                        <td key={d.code} className="px-4 py-3 tabular-nums text-brand-charcoal/80 font-mono text-[13px]">
                                            {formatAvaliacao(a.doms[d.code], turma)}
                                        </td>
                                    ))}
                                    <td className="px-4 py-3 tabular-nums font-serif text-brand-forest text-base">
                                        {formatAvaliacao(a.media, turma)}
                                    </td>
                                    {!escala20 && <td className="px-4 py-3"><Badge v={a.media} /></td>}
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
                                <Badge level={d.n} />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
