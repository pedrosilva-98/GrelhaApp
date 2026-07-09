import Badge from "@/components/Badge";
import { NIVEIS, calcMediaFinal, calcMediasDominioAluno, getNivel, domColor } from "@/lib/grelha";

export default function Dashboard({ alunos, insts, dominios }) {
    const medias = alunos.map((a) => ({
        ...a,
        media: calcMediaFinal(insts, dominios, a.id),
        doms: calcMediasDominioAluno(insts, a.id, dominios),
    }));
    const comMedia = medias.filter((a) => a.media != null);
    const mediaGeral = comMedia.length ? comMedia.reduce((s, a) => s + a.media, 0) / comMedia.length : null;
    const taxaSucesso = comMedia.length ? comMedia.filter((a) => a.media >= 50).length / comMedia.length : null;

    const dist = [5, 4, 3, 2, 1].map((n) => ({
        n,
        label: NIVEIS.find((x) => x.n === n).label,
        count: comMedia.filter((a) => { const nv = getNivel(a.media); return nv && nv.n === n; }).length,
    }));
    const maxCount = Math.max(1, ...dist.map((d) => d.count));

    const kpis = [
        { label: "Alunos", value: alunos.length, hint: "na turma" },
        { label: "Instrumentos", value: insts.length, hint: "criados" },
        { label: "Média da turma", value: mediaGeral != null ? mediaGeral.toFixed(1) + "%" : "—", hint: "ponderada" },
        { label: "Taxa de sucesso", value: taxaSucesso != null ? Math.round(taxaSucesso * 100) + "%" : "—", hint: "≥ 50%" },
    ];

    return (
        <div className="space-y-8 anim-in" data-testid="dashboard-view">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((k) => (
                    <div key={k.label} className="card-surface p-5 transition-transform duration-200 hover:-translate-y-[1px]">
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-sage mb-3">{k.label}</div>
                        <div className="font-serif text-3xl text-brand-forest tabular-nums">{k.value}</div>
                        <div className="text-[11px] text-brand-charcoal/50 mt-1">{k.hint}</div>
                    </div>
                ))}
            </div>

            <div className="card-surface overflow-hidden">
                <div className="px-5 pt-5 pb-3 flex items-baseline justify-between flex-wrap gap-3">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-sage">Panorâmica</div>
                        <h2 className="font-serif text-xl text-brand-forest">Alunos por domínio</h2>
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
                                    <td className="px-5 py-3 font-medium text-brand-charcoal">{a.nome}</td>
                                    {dominios.map((d) => (
                                        <td key={d.code} className="px-4 py-3 tabular-nums text-brand-charcoal/80 font-mono text-[13px]">
                                            {a.doms[d.code] != null ? a.doms[d.code].toFixed(1) + "%" : "—"}
                                        </td>
                                    ))}
                                    <td className="px-4 py-3 tabular-nums font-serif text-brand-forest text-base">
                                        {a.media != null ? a.media.toFixed(1) + "%" : "—"}
                                    </td>
                                    <td className="px-4 py-3"><Badge v={a.media} mode="number" /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

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
        </div>
    );
}
