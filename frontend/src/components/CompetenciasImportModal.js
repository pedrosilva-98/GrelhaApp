import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { X, Upload, Plus, Save, Check } from "lucide-react";

// Parse CSV/TSV or plain text: one competência per row.
// Detects "code" and "nome" columns by header names.
function parseTable(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    const delim = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
    let rows = lines.map((l) => l.split(delim).map((c) => c.trim().replace(/^"|"$/g, "")));
    let codeIdx = -1, nomeIdx = -1;
    const header = rows[0].map((h) => h.toLowerCase());
    codeIdx = header.findIndex((h) => ["codigo", "código", "code", "cod"].includes(h));
    nomeIdx = header.findIndex((h) => ["nome", "descricao", "descrição", "descritor", "competencia", "competência", "name"].includes(h));
    if (codeIdx >= 0 || nomeIdx >= 0) rows = rows.slice(1);
    // Fallback: 1 col → nome only; 2 cols → code, nome; more → try to detect
    return rows
        .map((r) => {
            if (r.length === 1) return { code: "", nome: r[0] };
            const code = codeIdx >= 0 ? r[codeIdx] : r[0];
            const nome = nomeIdx >= 0 ? r[nomeIdx] : (r.length > 1 ? r.slice(1).join(" ") : r[0]);
            return { code: (code || "").trim(), nome: (nome || "").trim() };
        })
        .filter((c) => c.nome);
}

// Read xlsx file and return array of {code, nome}
async function parseXlsx(file) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    // Rebuild as CSV-ish text so we reuse parseTable header detection
    const asCsv = rows
        .map((r) => r.map((c) => String(c ?? "").replace(/"/g, '""')).map((c) => `"${c}"`).join(","))
        .join("\n");
    return parseTable(asCsv);
}

export default function CompetenciasImportModal({ onClose, onImport, existing }) {
    const [text, setText] = useState("");
    const [items, setItems] = useState([]);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(null);
    const fileRef = useRef(null);

    function refreshPreview(txt) {
        try {
            setItems(parseTable(txt));
            setError("");
        } catch (e) {
            setError("Não foi possível interpretar o texto.");
            setItems([]);
        }
    }

    async function handleFile(f) {
        if (!f) return;
        setError("");
        try {
            const isXlsx = /\.xlsx?$/i.test(f.name);
            if (isXlsx) {
                const parsed = await parseXlsx(f);
                setItems(parsed);
                setText(parsed.map((c) => (c.code ? `${c.code},${c.nome}` : c.nome)).join("\n"));
            } else {
                const t = await f.text();
                setText(t);
                refreshPreview(t);
            }
        } catch (e) {
            setError("Erro a ler o ficheiro: " + (e.message || e));
        }
    }

    async function submit() {
        if (!items.length) { setError("Nenhuma competência detetada."); return; }
        // Assign automatic codes if missing
        const existingCodes = new Set((existing || []).map((c) => c.code));
        let n = 1;
        const withCodes = items.map((c) => {
            let code = (c.code || "").trim().toUpperCase();
            if (!code) {
                do {
                    code = "AE" + n++;
                } while (existingCodes.has(code));
            }
            existingCodes.add(code);
            return { code, nome: c.nome.trim() };
        });
        setBusy(true);
        try {
            await onImport(withCodes);
            setDone(withCodes.length);
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
                        <h2 className="font-serif text-2xl text-brand-forest">Competências essenciais</h2>
                    </div>
                    <button onClick={onClose} className="text-brand-sage hover:text-brand-charcoal">
                        <X size={20} />
                    </button>
                </div>

                <p className="text-sm text-brand-charcoal/70 mb-4 leading-relaxed">
                    Cole a lista (uma competência por linha) ou selecione um ficheiro <span className="font-mono text-xs">.xlsx</span> / <span className="font-mono text-xs">.csv</span> / <span className="font-mono text-xs">.txt</span>.
                    Se tiver duas colunas, deteta-se automaticamente <strong>Código</strong> e <strong>Nome</strong> (ou use apenas o descritor por linha e o código será gerado).
                </p>

                <div className="flex gap-2 mb-3 flex-wrap">
                    <button data-testid="comp-file-btn" onClick={() => fileRef.current?.click()} className="btn-ghost text-sm">
                        <Upload size={14} /> Selecionar ficheiro
                    </button>
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".xlsx,.xls,.csv,.txt,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        onChange={(e) => handleFile(e.target.files?.[0])}
                        className="hidden"
                        data-testid="comp-file-input"
                    />
                    <div className="text-xs text-brand-sage self-center" data-testid="comp-preview-count">
                        {items.length > 0 && `${items.length} competência(s) detetada(s)`}
                    </div>
                </div>

                <textarea
                    data-testid="comp-textarea"
                    value={text}
                    onChange={(e) => { setText(e.target.value); refreshPreview(e.target.value); }}
                    rows={8}
                    className="input-forest font-mono text-xs"
                    placeholder={"AE1, Resolver problemas envolvendo números racionais\nAE2, Interpretar tabelas e gráficos\n..."}
                />

                {items.length > 0 && (
                    <div className="mt-3 max-h-40 overflow-y-auto border border-crisp rounded-md p-3 bg-page/40">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-brand-sage mb-1">Pré-visualização</div>
                        <ol className="text-xs space-y-1">
                            {items.slice(0, 20).map((c, i) => (
                                <li key={i} className="text-brand-charcoal/80">
                                    <span className="font-mono text-brand-forest mr-2">{c.code || "(auto)"}</span>
                                    <span>{c.nome}</span>
                                </li>
                            ))}
                            {items.length > 20 && <li className="text-brand-sage">... e mais {items.length - 20}</li>}
                        </ol>
                    </div>
                )}

                {error && <div className="mt-3 text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">{error}</div>}
                {done != null && (
                    <div className="mt-3 text-sm text-[#2E6B2E] bg-[#E6F3E6] border border-[#B3D9B3] rounded-md px-3 py-2 flex items-center gap-2">
                        <Check size={14} /> Importadas {done} competência(s).
                    </div>
                )}

                <div className="flex gap-3 pt-5">
                    <button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
                    <button
                        data-testid="comp-import-submit"
                        onClick={submit}
                        disabled={busy || !items.length}
                        className="btn-primary flex-1 justify-center"
                    >
                        <Save size={14} />
                        {busy ? "A importar..." : `Importar ${items.length || ""} competência(s)`}
                    </button>
                </div>
            </div>
        </div>
    );
}
