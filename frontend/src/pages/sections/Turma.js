import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Trash2, UserPlus, Upload, X, Check, Eye } from "lucide-react";
import PerfilAlunoModal from "@/components/PerfilAlunoModal";

export default function Turma({ turma, insts = [], alunos, addAluno, delAluno, addAlunosBulk, updateAluno }) {
    const [nome, setNome] = useState("");
    const [dn, setDn] = useState("");
    const [nProc, setNProc] = useState("");
    const [email, setEmail] = useState("");
    const [showImport, setShowImport] = useState(false);
    const [perfilAluno, setPerfilAluno] = useState(null);

    async function submit(e) {
        e.preventDefault();
        if (!nome.trim() || !dn || !nProc.trim()) return;
        await addAluno({ nome: nome.trim(), data_nascimento: dn, n_processo: nProc.trim(), email: email.trim() });
        setNome(""); setDn(""); setNProc(""); setEmail("");
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
                        <Upload size={14} /> Importar Excel/CSV
                    </button>
                </div>
                <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_140px_120px_1fr_auto] gap-3 items-end">
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
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-sage block mb-1">Email do aluno</label>
                        <input
                            data-testid="aluno-email-input"
                            type="email"
                            className="input-forest"
                            placeholder="aluno@escola.pt"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
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
                            <th className="px-5 py-2.5 font-semibold">Email</th>
                            <th className="px-5 py-2.5 font-semibold w-16"></th>
                        </tr>
                    </thead>
                    <tbody data-testid="alunos-list">
                        {alunos.length === 0 ? (
                            <tr><td colSpan={6} className="px-5 py-12 text-center text-brand-sage">Nenhum aluno na turma. Adicione o primeiro acima ou importe um CSV.</td></tr>
                        ) : alunos.map((a, i) => (
                            <tr key={a.id} className={`border-b border-crisp last:border-0 row-hover ${i % 2 === 1 ? "bg-page/60" : ""}`}>
                                <td className="px-5 py-3 font-mono text-xs text-brand-sage tabular-nums">{String(i + 1).padStart(2, "0")}</td>
                                <td className="px-5 py-3 font-medium text-brand-charcoal">{a.nome}</td>
                                <td className="px-5 py-3 text-brand-charcoal/70 text-xs font-mono">{a.data_nascimento ? new Date(a.data_nascimento).toLocaleDateString("pt-PT") : "—"}</td>
                                <td className="px-5 py-3 text-brand-charcoal/70 text-xs font-mono">{a.n_processo || "—"}</td>
                                <td className="px-5 py-3 text-brand-charcoal/70 text-xs">{a.email || "—"}</td>
                                <td className="px-5 py-3 text-right">
                                    <div className="flex justify-end gap-1">
                                        <button data-testid={`view-aluno-${a.id}`} onClick={() => setPerfilAluno(a)} className="btn-ghost !px-2 !py-1.5" title="Ver perfil">
                                            <Eye size={14} />
                                        </button>
                                        <button data-testid={`del-aluno-${a.id}`} onClick={() => delAluno(a.id)} className="btn-danger-ghost" title="Eliminar">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showImport && <ImportCSVModal onClose={() => setShowImport(false)} onImport={addAlunosBulk} />}
            {perfilAluno && (
                <PerfilAlunoModal
                    aluno={perfilAluno}
                    turma={turma}
                    insts={insts}
                    onClose={() => setPerfilAluno(null)}
                    onSave={async (id, payload) => {
                        await updateAluno(id, payload);
                        // update local reference so modal shows saved values immediately
                        setPerfilAluno((cur) => (cur ? { ...cur, ...payload } : cur));
                    }}
                />
            )}
        </div>
    );
}

// Aluno column detection helpers
const NOME_KEYS = ["nome", "aluno", "aluno(a)", "name", "nomes"];
const DN_KEYS = ["data nascimento", "data de nascimento", "dn", "nascimento", "birthdate", "born", "data_nascimento"];
const NPROC_KEYS = ["n processo", "nº processo", "no processo", "numero processo", "número processo", "nº de processo", "n de processo", "processo", "process", "n_processo", "num processo"];
const EMAIL_KEYS = ["email", "e-mail", "correio eletronico", "correio eletrónico", "mail"];

function normHeader(h) { return String(h || "").trim().toLowerCase().replace(/º|°/g, "").replace(/\./g, "").replace(/\s+/g, " "); }
function isNomeKey(h) { return NOME_KEYS.includes(normHeader(h)); }
function isDnKey(h) { const n = normHeader(h); return DN_KEYS.includes(n); }
function isNprocKey(h) { const n = normHeader(h); return NPROC_KEYS.includes(n); }
function isEmailKey(h) { const n = normHeader(h); return EMAIL_KEYS.includes(n); }

// Convert an Excel date serial or string to ISO YYYY-MM-DD (or "" if unparseable).
function toIsoDate(v) {
    if (v == null || v === "") return "";
    // Excel serial number (days since 1899-12-30)
    if (typeof v === "number" && Number.isFinite(v)) {
        const d = new Date(Math.round((v - 25569) * 86400 * 1000));
        if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
    const s = String(v).trim();
    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // DD/MM/YYYY or DD-MM-YYYY
    const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec(s);
    if (m) {
        let [, d, mo, y] = m;
        if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
        return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    return "";
}

// Parse rows from a CSV/TSV text (fallback for text paste).
function parseTextRows(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    const delim = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
    return lines.map((l) => l.split(delim).map((c) => c.trim().replace(/^"|"$/g, "")));
}

// Given a list of row arrays, return list of {nome, data_nascimento, n_processo}
// Auto-detects header row with the keywords above; if no header, first column is nome.
function rowsToAlunos(rows) {
    if (!rows || !rows.length) return [];
    const firstRow = rows[0];
    const headerHits = firstRow.filter((h) => isNomeKey(h) || isDnKey(h) || isNprocKey(h) || isEmailKey(h)).length;
    let nomeIdx = 0, dnIdx = -1, npIdx = -1, emailIdx = -1;
    let dataRows = rows;
    if (headerHits > 0) {
        firstRow.forEach((h, i) => {
            if (isNomeKey(h)) nomeIdx = i;
            else if (isDnKey(h)) dnIdx = i;
            else if (isNprocKey(h)) npIdx = i;
            else if (isEmailKey(h)) emailIdx = i;
        });
        dataRows = rows.slice(1);
    }
    const out = [];
    for (const r of dataRows) {
        const nome = String(r[nomeIdx] ?? "").trim();
        if (!nome) continue;
        out.push({
            nome,
            data_nascimento: dnIdx >= 0 ? toIsoDate(r[dnIdx]) : "",
            n_processo: npIdx >= 0 ? String(r[npIdx] ?? "").trim() : "",
            email: emailIdx >= 0 ? String(r[emailIdx] ?? "").trim() : "",
        });
    }
    return out;
}

function parseCSV(text) {
    return rowsToAlunos(parseTextRows(text));
}

function ImportCSVModal({ onClose, onImport }) {
    const [text, setText] = useState("");
    const [xlsxRows, setXlsxRows] = useState(null);  // rows parsed from Excel (list of arrays)
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(null);
    const [warn, setWarn] = useState("");
    const fileRef = useRef(null);

    const preview = xlsxRows ? rowsToAlunos(xlsxRows) : parseCSV(text);

    async function handleFile(f) {
        if (!f) return;
        setError(""); setWarn("");
        const name = f.name.toLowerCase();
        if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
            try {
                const buf = await f.arrayBuffer();
                const wb = XLSX.read(buf, { type: "array", cellDates: true });
                const first = wb.SheetNames[0];
                const ws = wb.Sheets[first];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true, blankrows: false });
                setXlsxRows(rows);
                setText("");
                // Show a text preview of names in the textarea for feedback
                const parsed = rowsToAlunos(rows);
                if (!parsed.length) setWarn("Ficheiro lido, mas nenhum aluno foi detetado. Verifique os cabeçalhos das colunas.");
            } catch (e) {
                setError("Não foi possível ler o ficheiro Excel: " + (e?.message || ""));
            }
        } else {
            const t = await f.text();
            setText(t);
            setXlsxRows(null);
        }
    }

    async function submit() {
        setError("");
        if (!preview.length) { setError("Nenhum aluno detetado."); return; }
        setBusy(true);
        try {
            const res = await onImport(preview);
            setDone(res.inserted ?? preview.length);
            setTimeout(onClose, 1200);
        } catch (e) {
            setError(e?.response?.data?.detail || e.message || "Erro ao importar.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="card-surface w-full max-w-2xl p-8 anim-in max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.25em] text-brand-sage mb-1 flex items-center gap-2">
                            <Upload size={12} /> Importar
                        </div>
                        <h2 className="font-serif text-2xl text-brand-forest">Alunos a partir de Excel/CSV</h2>
                    </div>
                    <button onClick={onClose} className="text-brand-sage hover:text-brand-charcoal">
                        <X size={20} />
                    </button>
                </div>

                <p className="text-sm text-brand-charcoal/70 mb-4 leading-relaxed">
                    Selecione um ficheiro <span className="font-mono text-xs">.xlsx</span> / <span className="font-mono text-xs">.xls</span> / <span className="font-mono text-xs">.csv</span> ou cole os dados abaixo. Cabeçalhos reconhecidos:
                </p>
                <ul className="text-xs text-brand-charcoal/70 mb-4 space-y-0.5 leading-relaxed list-disc pl-5">
                    <li><strong>Nome</strong> — <span className="text-brand-sage">nome, aluno, name…</span></li>
                    <li><strong>Data de nascimento</strong> — <span className="text-brand-sage">data nascimento, data de nascimento, dn…</span> (aceita <span className="font-mono">DD/MM/AAAA</span>)</li>
                    <li><strong>Nº de processo</strong> — <span className="text-brand-sage">nº processo, processo, número processo…</span></li>
                    <li><strong>Email</strong> — <span className="text-brand-sage">email, e-mail…</span> (opcional)</li>
                </ul>

                <div className="flex gap-2 mb-3 flex-wrap items-center">
                    <button data-testid="csv-file-btn" onClick={() => fileRef.current?.click()} className="btn-ghost text-sm">
                        <Upload size={14} /> Selecionar ficheiro
                    </button>
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".csv,.txt,.xlsx,.xls,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        onChange={(e) => handleFile(e.target.files?.[0])}
                        className="hidden"
                        data-testid="csv-file-input"
                    />
                    <div className="text-xs text-brand-sage self-center">
                        {preview.length > 0 && <span data-testid="csv-preview-count">{preview.length} aluno(s) detetado(s)</span>}
                        {xlsxRows && <span className="ml-2 px-2 py-0.5 rounded-full bg-page border border-crisp">Excel</span>}
                    </div>
                </div>

                {!xlsxRows && (
                    <textarea
                        data-testid="csv-textarea"
                        value={text}
                        onChange={(e) => { setText(e.target.value); setXlsxRows(null); }}
                        rows={8}
                        className="input-forest font-mono text-xs"
                        placeholder={"Nome;Data Nascimento;Nº Processo\nAna Silva;2010-05-12;12345\nBruno Costa;2011-01-23;12346"}
                    />
                )}

                {preview.length > 0 && (
                    <div className="mt-3 border border-crisp rounded-md overflow-hidden max-h-48 overflow-y-auto" data-testid="import-preview">
                        <table className="w-full text-xs">
                            <thead className="bg-page">
                                <tr className="text-left text-[10px] uppercase tracking-[0.15em] text-brand-sage">
                                    <th className="px-3 py-1.5">#</th>
                                    <th className="px-3 py-1.5">Nome</th>
                                    <th className="px-3 py-1.5">DN</th>
                                    <th className="px-3 py-1.5">Nº Proc.</th>
                                    <th className="px-3 py-1.5">Email</th>
                                </tr>
                            </thead>
                            <tbody>
                                {preview.slice(0, 25).map((a, i) => (
                                    <tr key={i} className="border-t border-crisp">
                                        <td className="px-3 py-1 text-brand-sage tabular-nums">{i + 1}</td>
                                        <td className="px-3 py-1">{a.nome}</td>
                                        <td className="px-3 py-1 font-mono text-[11px] text-brand-charcoal/70">{a.data_nascimento || "—"}</td>
                                        <td className="px-3 py-1 font-mono text-[11px] text-brand-charcoal/70">{a.n_processo || "—"}</td>
                                        <td className="px-3 py-1 font-mono text-[11px] text-brand-charcoal/70">{a.email || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {preview.length > 25 && <div className="text-center text-[11px] text-brand-sage py-1">…e mais {preview.length - 25}</div>}
                    </div>
                )}

                {warn && <div className="mt-3 text-sm text-[#8A5A19] bg-[#FEF5E6] border border-[#F7DBAA] rounded-md px-3 py-2">{warn}</div>}
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
                        disabled={busy || !preview.length}
                        className="btn-primary flex-1 justify-center"
                    >
                        {busy ? "A importar..." : `Importar ${preview.length || ""} aluno(s)`}
                    </button>
                </div>
            </div>
        </div>
    );
}
