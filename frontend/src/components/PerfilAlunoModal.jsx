import { useEffect, useMemo, useState } from "react";
import { X, Plus, Save, Trash2, Eye, GraduationCap, Radar as RadarIcon } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { calcMediaFinal, calcMediasDominioAluno, getNivel, domColor, instsParaFinal, isEscala20, formatAvaliacao } from "@/lib/grelha";
import Badge from "@/components/Badge";

const TABS = [
    { id: "dados", label: "Dados", icon: Eye },
    { id: "avaliacao", label: "Avaliação", icon: RadarIcon },
    { id: "especial", label: "Educação Especial", icon: GraduationCap },
];

export default function PerfilAlunoModal({ aluno, turma, insts, onClose, onSave }) {
    const dominios = turma?.dominios || [];
    const escala20 = isEscala20(turma);
    const [tab, setTab] = useState("dados");
    const [nome, setNome] = useState(aluno.nome || "");
    const [dn, setDn] = useState(aluno.data_nascimento || "");
    const [nProc, setNProc] = useState(aluno.n_processo || "");
    const [email, setEmail] = useState(aluno.email || "");
    const initialMedidas = aluno.medidas || { universais: [], adicionais: [], seletivas: [] };
    const [medidas, setMedidas] = useState({
        universais: initialMedidas.universais || [],
        adicionais: initialMedidas.adicionais || [],
        seletivas: initialMedidas.seletivas || [],
    });
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        setNome(aluno.nome || "");
        setDn(aluno.data_nascimento || "");
        setNProc(aluno.n_processo || "");
        setEmail(aluno.email || "");
        const m = aluno.medidas || { universais: [], adicionais: [], seletivas: [] };
        setMedidas({
            universais: m.universais || [],
            adicionais: m.adicionais || [],
            seletivas: m.seletivas || [],
        });
    }, [aluno]);

    const finalInsts = useMemo(() => instsParaFinal(insts), [insts]);
    const domsPct = useMemo(() => calcMediasDominioAluno(finalInsts, aluno.id, dominios, turma), [finalInsts, aluno.id, dominios, turma]);
    const mediaFinal = useMemo(() => calcMediaFinal(finalInsts, dominios, aluno.id, turma), [finalInsts, dominios, aluno.id, turma]);
    const nivel = getNivel(mediaFinal);
    const radarData = dominios.map((d) => ({ dominio: d.code, valor: domsPct[d.code] != null ? Number(domsPct[d.code].toFixed(1)) : 0, label: d.nome }));

    function updateMedida(key, i, val) {
        setMedidas((s) => ({ ...s, [key]: s[key].map((m, idx) => (idx === i ? val : m)) }));
    }
    function addMedida(key) {
        setMedidas((s) => ({ ...s, [key]: [...s[key], ""] }));
    }
    function removeMedida(key, i) {
        setMedidas((s) => ({ ...s, [key]: s[key].filter((_, idx) => idx !== i) }));
    }

    async function handleSave() {
        setError(""); setBusy(true);
        try {
            const clean = {
                universais: medidas.universais.map((m) => m.trim()).filter(Boolean),
                adicionais: medidas.adicionais.map((m) => m.trim()).filter(Boolean),
                seletivas: medidas.seletivas.map((m) => m.trim()).filter(Boolean),
            };
            await onSave(aluno.id, {
                nome: nome.trim(),
                data_nascimento: dn || "",
                n_processo: nProc.trim(),
                email: email.trim(),
                medidas: clean,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 1400);
        } catch (e) {
            setError(e?.response?.data?.detail || e?.message || "Erro ao guardar.");
        } finally { setBusy(false); }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="card-surface w-full max-w-4xl max-h-[90vh] overflow-hidden anim-in flex flex-col" onClick={(e) => e.stopPropagation()} data-testid="perfil-aluno-modal">
                <div className="flex items-start justify-between p-6 border-b border-crisp">
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.25em] text-brand-sage mb-1 flex items-center gap-2">
                            <Eye size={12} /> Perfil do aluno
                        </div>
                        <h2 className="font-serif text-2xl text-brand-forest">{aluno.nome}</h2>
                    </div>
                    <button data-testid="perfil-close" onClick={onClose} className="text-brand-sage hover:text-brand-charcoal">
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex gap-1 px-6 pt-3 border-b border-crisp overflow-x-auto" role="tablist">
                    {TABS.map((t) => {
                        const Icon = t.icon;
                        const active = tab === t.id;
                        return (
                            <button
                                key={t.id}
                                data-testid={`perfil-tab-${t.id}`}
                                onClick={() => setTab(t.id)}
                                className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors duration-200 whitespace-nowrap ${
                                    active ? "border-brand-forest text-brand-forest font-medium" : "border-transparent text-brand-charcoal/50 hover:text-brand-charcoal"
                                }`}
                            >
                                <Icon size={15} /> {t.label}
                            </button>
                        );
                    })}
                </nav>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {tab === "dados" && (
                        <div className="space-y-4" data-testid="perfil-dados">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="sm:col-span-3">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Nome completo</label>
                                    <input data-testid="perfil-nome" className="input-forest" value={nome} onChange={(e) => setNome(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Data de nascimento</label>
                                    <input data-testid="perfil-dn" type="date" className="input-forest" value={dn && /^\d{4}-\d{2}-\d{2}$/.test(dn) ? dn : ""} onChange={(e) => setDn(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Nº de processo</label>
                                    <input data-testid="perfil-nproc" className="input-forest font-mono text-sm" value={nProc} onChange={(e) => setNProc(e.target.value)} />
                                </div>
                                <div className="sm:col-span-3">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Email do aluno</label>
                                    <input data-testid="perfil-email" type="email" className="input-forest" placeholder="aluno@escola.pt" value={email} onChange={(e) => setEmail(e.target.value)} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-crisp">
                                <MiniStat label="Média final" value={formatAvaliacao(mediaFinal, turma)} />
                                {!escala20 && <MiniStat label="Nível" value={nivel ? nivel.label : "—"} />}
                                <MiniStat label="Instrumentos c/ notas" value={insts.filter((i) => (i.notas || {})[aluno.id]).length} />
                                <MiniStat label="Domínios avaliados" value={Object.values(domsPct).filter((v) => v != null).length + " / " + dominios.length} />
                            </div>
                        </div>
                    )}

                    {tab === "avaliacao" && (
                        <div className="space-y-6" data-testid="perfil-avaliacao">
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-sage mb-2">Avaliação por domínio</div>
                                <div className="overflow-hidden rounded-md border border-crisp">
                                    <table className="w-full text-sm">
                                        <thead className="bg-page border-b border-crisp">
                                            <tr className="text-left text-[11px] uppercase tracking-[0.15em] text-brand-sage">
                                                <th className="px-4 py-2 font-semibold">Domínio</th>
                                                <th className="px-4 py-2 font-semibold">Nome</th>
                                                <th className="px-4 py-2 font-semibold text-right">%</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dominios.map((d, i) => (
                                                <tr key={d.code} className="border-b border-crisp last:border-0">
                                                    <td className="px-4 py-2 font-mono text-xs" style={{ color: domColor(i) }}>{d.code}</td>
                                                    <td className="px-4 py-2 text-brand-charcoal/80">{d.nome}</td>
                                                    <td className="px-4 py-2 text-right tabular-nums font-mono text-sm">{formatAvaliacao(domsPct[d.code], turma)}</td>
                                                </tr>
                                            ))}
                                            <tr className="bg-page">
                                                <td className="px-4 py-2 text-brand-forest font-serif" colSpan={2}>Média final</td>
                                                <td className="px-4 py-2 text-right tabular-nums font-serif text-brand-forest">{formatAvaliacao(mediaFinal, turma)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-sage mb-2">Radar dos domínios</div>
                                <div className="w-full h-72 bg-page rounded-md border border-crisp p-2" data-testid="perfil-radar" style={{ minHeight: 260 }}>
                                    <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={260}>
                                        <RadarChart data={radarData} outerRadius="70%">
                                            <PolarGrid stroke="#E5E3DB" />
                                            <PolarAngleAxis dataKey="dominio" tick={{ fill: "#5A5F55", fontSize: 12 }} />
                                            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#9CA69A", fontSize: 10 }} />
                                            <Radar name="Aluno" dataKey="valor" stroke="#2C4A3B" fill="#2C4A3B" fillOpacity={0.35} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {!escala20 && (
                                <div className="flex items-center gap-3">
                                    <span className="text-[11px] uppercase tracking-[0.2em] text-brand-sage">Nível qualitativo</span>
                                    <Badge v={mediaFinal} />
                                </div>
                            )}
                        </div>
                    )}

                    {tab === "especial" && (
                        <div className="space-y-5" data-testid="perfil-especial">
                            <p className="text-sm text-brand-charcoal/70 leading-relaxed">
                                Registe as medidas de suporte à aprendizagem e inclusão para este aluno (DL 54/2018).
                                Adicione uma linha por medida em cada categoria.
                            </p>
                            {[
                                { key: "universais", label: "Medidas Universais", hint: "Aplicáveis a todos os alunos" },
                                { key: "adicionais", label: "Medidas Adicionais", hint: "Apenas em situações específicas" },
                                { key: "seletivas", label: "Medidas Seletivas", hint: "Necessidades individuais de suporte" },
                            ].map(({ key, label, hint }) => (
                                <div key={key} data-testid={`medida-${key}`}>
                                    <div className="flex items-baseline justify-between mb-2">
                                        <div>
                                            <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-brand-forest">{label}</div>
                                            <div className="text-[11px] text-brand-charcoal/50">{hint}</div>
                                        </div>
                                        <button type="button" onClick={() => addMedida(key)} data-testid={`add-${key}`} className="text-xs text-brand-forest hover:text-brand-forest-hover flex items-center gap-1">
                                            <Plus size={12} /> Adicionar
                                        </button>
                                    </div>
                                    {medidas[key].length === 0 ? (
                                        <div className="border-2 border-dashed border-crisp rounded-md py-3 text-center text-brand-sage text-xs">
                                            Sem medidas registadas.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {medidas[key].map((m, i) => (
                                                <div key={i} className="flex items-center gap-2">
                                                    <span className="text-[10px] font-mono text-brand-sage w-6 shrink-0 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                                                    <input
                                                        data-testid={`medida-${key}-${i}`}
                                                        className="input-forest flex-1 text-sm"
                                                        placeholder="Descreva a medida..."
                                                        value={m}
                                                        onChange={(e) => updateMedida(key, i, e.target.value)}
                                                    />
                                                    <button type="button" onClick={() => removeMedida(key, i)} className="btn-danger-ghost" title="Remover">
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-crisp flex items-center gap-3 justify-end bg-surface">
                    {error && <span className="text-sm text-[#9E3921] mr-auto">{error}</span>}
                    <button onClick={onClose} className="btn-ghost">Fechar</button>
                    <button data-testid="perfil-save" onClick={handleSave} disabled={busy} className="btn-primary">
                        <Save size={15} />
                        {saved ? "Guardado ✓" : busy ? "A guardar..." : "Guardar alterações"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function MiniStat({ label, value }) {
    return (
        <div className="bg-page rounded-md border border-crisp px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.15em] text-brand-sage">{label}</div>
            <div className="font-serif text-lg text-brand-forest tabular-nums">{value}</div>
        </div>
    );
}
