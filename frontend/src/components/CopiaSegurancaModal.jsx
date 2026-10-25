import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Download, FileText, Upload, ShieldCheck, Loader2, Check, AlertTriangle } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { exportRegistoCompletoPDF } from "@/lib/registoPdf";

// Cópia de segurança de todas as turmas do professor: ficheiro para guardar no computador,
// registo completo em PDF e reposição de turmas a partir de um ficheiro guardado.
export default function CopiaSegurancaModal({ onClose, onRestaurado }) {
    const [busy, setBusy] = useState(null); // "json" | "pdf" | "restaurar"
    const [error, setError] = useState("");
    const [ok, setOk] = useState("");
    const [ficheiro, setFicheiro] = useState(null); // conteúdo lido do ficheiro de cópia
    const [escolhidas, setEscolhidas] = useState(new Set());
    const [resultado, setResultado] = useState(null);
    const fileRef = useRef(null);

    async function obter() {
        const { data } = await api.get("/backup");
        return data;
    }

    async function descarregarJSON() {
        setBusy("json"); setError(""); setOk("");
        try {
            const data = await obter();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `copia_seguranca_caderno_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            setOk(`Cópia descarregada: ${data.turmas.length} turma(s). Guarde o ficheiro num local seguro do computador.`);
        } catch (e) {
            setError(formatApiError(e));
        } finally { setBusy(null); }
    }

    async function descarregarPDF() {
        setBusy("pdf"); setError(""); setOk("");
        try {
            const data = await obter();
            exportRegistoCompletoPDF(data);
            setOk("Registo completo em PDF descarregado.");
        } catch (e) {
            setError(formatApiError(e));
        } finally { setBusy(null); }
    }

    async function lerFicheiro(f) {
        if (!f) return;
        setError(""); setOk(""); setResultado(null);
        try {
            const data = JSON.parse(await f.text());
            if (!Array.isArray(data?.turmas) || !data.turmas.every((x) => x?.turma?.id)) throw new Error("formato");
            setFicheiro(data);
            setEscolhidas(new Set());
        } catch {
            setFicheiro(null);
            setError("Este ficheiro não é uma cópia de segurança do Caderno.");
        }
    }

    function toggle(id) {
        setEscolhidas((s) => {
            const n = new Set(s);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    }

    async function restaurar() {
        const turmas = ficheiro.turmas.filter((x) => escolhidas.has(x.turma.id));
        const nomes = turmas.map((x) => `${x.turma.disciplina} ${x.turma.ano} ${x.turma.turma}`).join(", ");
        const quando = ficheiro.gerado_em ? new Date(ficheiro.gerado_em).toLocaleString("pt-PT") : "data desconhecida";
        if (!window.confirm(
            `Restaurar ${nomes} a partir da cópia de ${quando}?\n\n` +
            "Os alunos, instrumentos, notas e configurações atuais destas turmas serão SUBSTITUÍDOS pelos da cópia."
        )) return;
        setBusy("restaurar"); setError(""); setOk("");
        const res = [];
        for (const x of turmas) {
            const nome = `${x.turma.disciplina} ${x.turma.ano} ${x.turma.turma}`;
            try {
                const { data } = await api.post("/backup/restaurar", x);
                res.push({ nome, ok: true, texto: `${data.acao === "criada" ? "criada de novo" : "reposta"}: ${data.alunos} aluno(s), ${data.instrumentos} instrumento(s)` });
            } catch (e) {
                res.push({ nome, ok: false, texto: formatApiError(e) });
            }
        }
        setResultado(res);
        setBusy(null);
        if (res.some((r) => r.ok) && onRestaurado) onRestaurado();
    }

    return createPortal(
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="card-surface w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden anim-in" onClick={(e) => e.stopPropagation()} data-testid="backup-modal">
                <div className="p-6 border-b border-crisp flex items-start justify-between">
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.25em] text-brand-sage mb-1 flex items-center gap-2">
                            <ShieldCheck size={12} /> Todas as turmas
                        </div>
                        <h2 className="font-serif text-xl text-brand-forest">Cópia de segurança</h2>
                    </div>
                    <button onClick={onClose} className="text-brand-sage hover:text-brand-charcoal"><X size={20} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    <div className="space-y-2">
                        <button data-testid="backup-json" onClick={descarregarJSON} disabled={!!busy} className="btn-primary w-full justify-center">
                            {busy === "json" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Descarregar cópia de segurança
                        </button>
                        <p className="text-xs text-brand-charcoal/60 leading-relaxed">
                            Um ficheiro com tudo o que registou (alunos, perfis, instrumentos, notas e observação direta). Guarde-o no computador; serve para repor os dados se for preciso.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <button data-testid="backup-pdf" onClick={descarregarPDF} disabled={!!busy} className="btn-ghost w-full justify-center">
                            {busy === "pdf" ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Descarregar registo completo (PDF)
                        </button>
                        <p className="text-xs text-brand-charcoal/60 leading-relaxed">
                            Para consultar ou imprimir: alunos e Educação Especial, classificações de cada instrumento, observação direta e avaliação por domínio.
                        </p>
                    </div>

                    <div className="border-t border-crisp pt-5 space-y-3">
                        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage">Restaurar a partir de uma cópia</div>
                        <button data-testid="backup-escolher" onClick={() => fileRef.current?.click()} disabled={!!busy} className="btn-ghost text-sm">
                            <Upload size={14} /> Escolher ficheiro de cópia…
                        </button>
                        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" data-testid="backup-file" onChange={(e) => { lerFicheiro(e.target.files?.[0]); e.target.value = ""; }} />
                        {ficheiro && (
                            <div className="space-y-3">
                                <p className="text-xs text-brand-charcoal/70">
                                    Cópia de {ficheiro.gerado_em ? new Date(ficheiro.gerado_em).toLocaleString("pt-PT") : "data desconhecida"}. Escolha as turmas a restaurar:
                                </p>
                                <ul className="space-y-1" data-testid="backup-turmas">
                                    {ficheiro.turmas.map((x) => (
                                        <li key={x.turma.id}>
                                            <label className="flex items-center gap-3 px-3 py-2 rounded-md border border-crisp hover:bg-page cursor-pointer text-sm">
                                                <input type="checkbox" checked={escolhidas.has(x.turma.id)} onChange={() => toggle(x.turma.id)} className="accent-brand-forest" />
                                                <span className="flex-1">{x.turma.disciplina} · {x.turma.ano} {x.turma.turma}</span>
                                                <span className="text-[11px] text-brand-sage">{x.alunos.length} alunos · {x.instrumentos.length} instr.</span>
                                            </label>
                                        </li>
                                    ))}
                                </ul>
                                <div className="flex items-start gap-2 text-xs text-[#8A5A19] bg-[#FEF5E6] border border-[#F7DBAA] rounded-md px-3 py-2">
                                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                    Os dados atuais das turmas escolhidas são substituídos pelos da cópia.
                                </div>
                                <button data-testid="backup-restaurar" onClick={restaurar} disabled={!escolhidas.size || !!busy} className="btn-primary w-full justify-center">
                                    {busy === "restaurar" ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Restaurar {escolhidas.size || ""} turma(s)
                                </button>
                            </div>
                        )}
                        {resultado && (
                            <ul className="space-y-1 text-sm" data-testid="backup-resultado">
                                {resultado.map((r) => (
                                    <li key={r.nome} className={`flex items-start gap-2 ${r.ok ? "text-[#2E6B2E]" : "text-[#9E3921]"}`}>
                                        {r.ok ? <Check size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
                                        <span><strong>{r.nome}</strong> — {r.texto}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {ok && <div className="text-sm text-[#2E6B2E] bg-[#E6F3E6] border border-[#B3D9B3] rounded-md px-3 py-2">{ok}</div>}
                    {error && <div className="text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">{error}</div>}
                </div>
            </div>
        </div>,
        document.body
    );
}
