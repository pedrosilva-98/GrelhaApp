import { useRef, useState } from "react";
import { Trash2, UserPlus, Upload, X, Check } from "lucide-react";

export default function Turma({ alunos, addAluno, delAluno, addAlunosBulk }) {
    const [nome, setNome] = useState("");
    const [dn, setDn] = useState("");
    const [nProc, setNProc] = useState("");
    const [showImport, setShowImport] = useState(false);

    async function submit(e) {
        e.preventDefault();
        if (!nome.trim() || !dn || !nProc.trim()) return;
        await addAluno({ nome: nome.trim(), data_nascimento: dn, n_processo: nProc.trim() });
        setNome(""); setDn(""); setNProc("");
    }

    return (
        <div className="space-y-6 anim-in" data-testid="turma-view">
            <div className="card-surface p-6">
                <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-sage mb-1">Turma</div>
                        <h2 className="font-serif text-xl text-brand-forest">Adicionar aluno</h2>
                    </div>
                    <button
                        data-testid="import-csv-btn"
                        onClick={() => setShowImport(true)}
                        className="btn-ghost text-sm"
                    >
                        <Upload size={14} /> Importar CSV
                    </button>
                </div>
                <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-[1fr_160px_160px_auto] gap-3 items-end">
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Nome completo</label>
                        <input
                            data-testid="aluno-nome-input"
                            className="input-forest"
                            placeholder="Ex: Ana Silva"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Data de nascimento</label>
                        <input
                            data-testid="aluno-dn-input"
                            type="date"
                            className="input-forest"
                            value={dn}
                            onChange={(e) => setDn(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Nº de processo</label>
                        <input
                            data-testid="aluno-nproc-input"
                            className="input-forest font-mono text-sm"
                            placeholder="Ex: 12345"
                            value={nProc}
                            onChange={(e) => setNProc(e.target.value)}
                            required
                        />
                    </div>
                    <button data-testid="add-aluno-btn" type="submit" className="btn-primary whitespace-nowrap h-[42px]">
                        <UserPlus size={16} /> Adicionar
                    </button>
                </form>
            </div>

            <div className="card-surface overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-page border-b border-crisp">
                        <tr className="text-left text-[11px] uppercase tracking-[0.15em] text-brand-sage">
                            <th className="px-5 py-2.5 font-semibold w-16">Nº</th>
                            <th className="px-5 py-2.5 font-semibold">Nome</th>
                            <th className="px-5 py-2.5 font-semibold w-36">Data de nascimento</th>
                            <th className="px-5 py-2.5 font-semibold w-32">Nº processo</th>
                            <th className="px-5 py-2.5 font-semibold w-16"></th>
                        </tr>
                    </thead>
                    <tbody data-testid="alunos-list">
                        {alunos.length === 0 ? (
                            <tr><td colSpan={5} className="px-5 py-12 text-center text-brand-sage">Nenhum aluno na turma. Adicione o primeiro acima ou importe um CSV.</td></tr>
                        ) : alunos.map((a, i) => (
                            <tr key={a.id} className={`border-b border-crisp last:border-0 row-hover ${i % 2 === 1 ? "bg-page/60" : ""}`}>
                                <td className="px-5 py-3 font-mono text-xs text-brand-sage tabular-nums">{String(i + 1).padStart(2, "0")}</td>
                                <td className="px-5 py-3 font-medium text-brand-charcoal">{a.nome}</td>
                                <td className="px-5 py-3 text-brand-charcoal/70 text-xs font-mono">{a.data_nascimento ? new Date(a.data_nascimento).toLocaleDateString("pt-PT") : "—"}</td>
                                <td className="px-5 py-3 text-brand-charcoal/70 text-xs font-mono">{a.n_processo || "—"}</td>
                                <td className="px-5 py-3 text-right">
                                    <button data-testid={`del-aluno-${a.id}`} onClick={() => delAluno(a.id)} className="btn-danger-ghost" title="Eliminar">
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showImport && <ImportCSVModal onClose={() => setShowImport(false)} onImport={addAlunosBulk} />}
        </div>
    );
}

function parseCSV(text) {
    // Accept CSV or single-column text. If a "nome" column header exists, use it. Otherwise take first non-empty column.
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    // Detect delimiter
    const delim = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
    let rows = lines.map((l) => l.split(delim).map((c) => c.trim().replace(/^"|"$/g, "")));
    // Detect header
    const header = rows[0].map((h) => h.toLowerCase());
    let nameIdx = 0;
    const nomeIdx = header.findIndex((h) => ["nome", "aluno", "aluno(a)", "name", "nomes"].includes(h));
    if (nomeIdx >= 0) {
        nameIdx = nomeIdx;
        rows = rows.slice(1);
    }
    return rows.map((r) => r[nameIdx] || "").filter(Boolean);
}

function ImportCSVModal({ onClose, onImport }) {
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(null);
    const fileRef = useRef(null);

    const previewNomes = parseCSV(text);

    async function handleFile(f) {
        if (!f) return;
        const t = await f.text();
        setText(t);
    }

    async function submit() {
        setError("");
        const nomes = parseCSV(text);
        if (!nomes.length) { setError("Nenhum nome detetado."); return; }
        setBusy(true);
        try {
            const res = await onImport(nomes);
            setDone(res.inserted || nomes.length);
            setTimeout(onClose, 1200);
        } catch (e) {
            setError(e?.response?.data?.detail || e.message || "Erro ao importar.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="card-surface w-full max-w-2xl p-8 anim-in" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.25em] text-brand-sage mb-1 flex items-center gap-2">
                            <Upload size={12} /> Importar
                        </div>
                        <h2 className="font-serif text-2xl text-brand-forest">Alunos a partir de CSV</h2>
                    </div>
                    <button onClick={onClose} className="text-brand-sage hover:text-brand-charcoal">
                        <X size={20} />
                    </button>
                </div>

                <p className="text-sm text-brand-charcoal/70 mb-4 leading-relaxed">
                    Cole os nomes (um por linha) ou selecione um ficheiro <span className="font-mono text-xs">.csv</span> / <span className="font-mono text-xs">.txt</span>.
                    Se o CSV tiver várias colunas, deteta-se automaticamente uma coluna chamada <strong>nome</strong>; caso contrário utiliza a primeira coluna.
                </p>

                <div className="flex gap-2 mb-3 flex-wrap">
                    <button
                        data-testid="csv-file-btn"
                        onClick={() => fileRef.current?.click()}
                        className="btn-ghost text-sm"
                    >
                        <Upload size={14} /> Selecionar ficheiro
                    </button>
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".csv,.txt,text/csv,text/plain"
                        onChange={(e) => handleFile(e.target.files?.[0])}
                        className="hidden"
                        data-testid="csv-file-input"
                    />
                    <div className="text-xs text-brand-sage self-center">
                        {previewNomes.length > 0 && <span data-testid="csv-preview-count">{previewNomes.length} nome(s) detetado(s)</span>}
                    </div>
                </div>

                <textarea
                    data-testid="csv-textarea"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={10}
                    className="input-forest font-mono text-xs"
                    placeholder={"Ana Silva\nBruno Costa\nCarla Duarte\n..."}
                />

                {previewNomes.length > 0 && (
                    <div className="mt-3 text-xs text-brand-charcoal/60">
                        Pré-visualização: {previewNomes.slice(0, 5).join(", ")}{previewNomes.length > 5 ? "…" : ""}
                    </div>
                )}

                {error && <div className="mt-3 text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">{error}</div>}
                {done != null && (
                    <div className="mt-3 text-sm text-[#2E6B2E] bg-[#E6F3E6] border border-[#B3D9B3] rounded-md px-3 py-2 flex items-center gap-2">
                        <Check size={14} /> Importados {done} aluno(s).
                    </div>
                )}

                <div className="flex gap-3 pt-5">
                    <button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
                    <button
                        data-testid="csv-import-submit"
                        onClick={submit}
                        disabled={busy || !previewNomes.length}
                        className="btn-primary flex-1 justify-center"
                    >
                        {busy ? "A importar..." : `Importar ${previewNomes.length || ""} aluno(s)`}
                    </button>
                </div>
            </div>
        </div>
    );
}
