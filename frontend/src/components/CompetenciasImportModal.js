import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { X, Upload, Plus, Save, Check } from "lucide-react";

// Divide texto CSV/TSV em linhas e células, respeitando aspas
// (vírgulas e quebras de linha dentro de "..." fazem parte da célula).
function splitDelimited(text, delim) {
    const rows = [];
    let row = [], cell = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (ch === '"') inQuotes = false;
            else cell += ch;
        } else if (ch === '"' && cell.trim() === "") { cell = ""; inQuotes = true; }
        else if (ch === delim) { row.push(cell); cell = ""; }
        else if (ch === "\n" || ch === "\r") {
            if (ch === "\r" && text[i + 1] === "\n") i++;
            row.push(cell); rows.push(row); row = []; cell = "";
        } else cell += ch;
    }
    row.push(cell); rows.push(row);
    return rows;
}

// Código curto tipo "AE1", "AE 12", "3", "1.2", "D1a".
const looksLikeCode = (s) => /^[A-Za-zÀ-ÿ]{0,6}[\s._-]?\d+([.-]\d+)*[a-z]?$/.test(s);
// Tira marcadores de lista no início ("- ", "• ", "– ", "1) ").
const cleanNome = (s) => s.replace(/\s+/g, " ").replace(/^\s*([-–—•·*]+|\d+[.)])\s+/, "").trim();

// Recebe linhas de células (do Excel ou do texto) e devolve [{code, nome}].
// Deteta cabeçalhos ("Código", "Nome", "Aprendizagem essencial…", "Coluna1"...) e ignora linhas/colunas vazias.
// joinWith: como voltar a juntar uma descrição que foi partida pelo separador (no texto, o próprio separador,
// para não estragar "0,1; 0,01"); as células não são aparadas antes de juntar.
function parseRows(rawRows, joinWith = " ") {
    const has = (c) => c.trim() !== "";
    let rows = rawRows
        .map((r) => r.map((c) => String(c ?? "")))
        .filter((r) => r.some(has));
    if (!rows.length) return [];
    const nCols = Math.max(...rows.map((r) => r.length));
    const usedCols = [...Array(nCols).keys()].filter((j) => rows.some((r) => has(r[j] || "")));
    rows = rows.map((r) => usedCols.map((j) => r[j] || ""));

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const isCodeH = (h) => ["codigo", "código", "code", "cod", "cód", "ae"].includes(h);
    const isNomeH = (h) => h.length <= 60 && /^(nome|name|descri|compet|aprendiza)/.test(h);
    const isGenericH = (h) => /^(coluna|column)\s*\d+$/.test(h);
    const codeIdx = header.findIndex(isCodeH);
    const nomeIdx = header.findIndex(isNomeH);
    if (codeIdx >= 0 || nomeIdx >= 0 || header.some(isGenericH)) rows = rows.slice(1);

    return rows
        .map((r) => {
            const cells = r.filter(has);
            if (codeIdx >= 0 || nomeIdx >= 0) {
                const code = codeIdx >= 0 ? r[codeIdx].trim() : "";
                const nome = nomeIdx >= 0 ? r[nomeIdx] : r.filter((c, j) => j !== codeIdx && has(c)).join(joinWith);
                return { code, nome: cleanNome(nome) };
            }
            // Sem cabeçalho: a 1.ª célula só é código se parecer um código; o resto é a descrição.
            if (cells.length > 1 && looksLikeCode(cells[0].trim())) {
                return { code: cells[0].trim(), nome: cleanNome(cells.slice(1).join(joinWith)) };
            }
            return { code: "", nome: cleanNome(cells.join(joinWith)) };
        })
        .filter((c) => c.nome);
}

// Texto colado ou ficheiro .csv/.txt: uma aprendizagem por linha.
function parseTable(text) {
    const first = text.split(/\r?\n/).find((l) => l.trim()) || "";
    const delim = text.includes("\t") ? "\t" : first.includes(";") ? ";" : ",";
    return parseRows(splitDelimited(text, delim), delim === "\t" ? " " : delim);
}

// Read xlsx file and return array of {code, nome}
async function parseXlsx(file) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return [];
    return parseRows(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }));
}

export default function AprendizagemsImportModal({ onClose, onImport, existing }) {
    const [text, setText] = useState("");
    const [items, setItems] = useState([]);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(null);
    const [replace, setReplace] = useState(false);
    const fileRef = useRef(null);
    const nExisting = (existing || []).length;

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
                setText(parsed.map((c) => (c.code ? `${c.code}\t${c.nome}` : c.nome)).join("\n"));
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
        if (!items.length) { setError("Nenhuma aprendizagem detetada."); return; }
        // Assign automatic codes if missing
        const existingCodes = new Set(replace ? [] : (existing || []).map((c) => c.code));
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
            await onImport(withCodes, { replace });
            setDone(withCodes.length);
            setTimeout(onClose, 1200);
        } catch (e) {
            setError(e?.response?.data?.detail || e.message || "Erro ao importar.");
        } finally {
            setBusy(false);
        }
    }

    // Portal para o body: dentro de outro modal (ex.: admin → Turmas) o "fixed" ficava preso a esse modal.
    return createPortal(
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="card-surface w-full max-w-2xl anim-in max-h-[92vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between px-8 pt-8 pb-4 shrink-0">
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.25em] text-brand-sage mb-1 flex items-center gap-2">
                            <Upload size={12} /> Importar
                        </div>
                        <h2 className="font-serif text-2xl text-brand-forest">Aprendizagens essenciais</h2>
                    </div>
                    <button onClick={onClose} className="text-brand-sage hover:text-brand-charcoal">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-8">
                <p className="text-sm text-brand-charcoal/70 mb-4 leading-relaxed">
                    Cole a lista (uma aprendizagem por linha) ou selecione um ficheiro <span className="font-mono text-xs">.xlsx</span> / <span className="font-mono text-xs">.csv</span> / <span className="font-mono text-xs">.txt</span>.
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
                        {items.length > 0 && `${items.length} aprendizagem(s) detetada(s)`}
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

                {nExisting > 0 && (
                    <label className="mt-3 flex items-start gap-2 text-sm text-brand-charcoal cursor-pointer" data-testid="comp-replace">
                        <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="mt-1 accent-brand-forest" />
                        <span>
                            Substituir as {nExisting} aprendizagem(s) atuais
                            <span className="block text-xs text-brand-sage">Sem esta opção, as novas são acrescentadas às que já existem.</span>
                        </span>
                    </label>
                )}

                {error && <div className="mt-3 text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">{error}</div>}
                {done != null && (
                    <div className="mt-3 text-sm text-[#2E6B2E] bg-[#E6F3E6] border border-[#B3D9B3] rounded-md px-3 py-2 flex items-center gap-2">
                        <Check size={14} /> Importadas {done} aprendizagem(s).
                    </div>
                )}
                </div>

                <div className="flex gap-3 px-8 pt-4 pb-8 shrink-0 border-t border-crisp">
                    <button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
                    <button
                        data-testid="comp-import-submit"
                        onClick={submit}
                        disabled={busy || !items.length}
                        className="btn-primary flex-1 justify-center"
                    >
                        <Save size={14} />
                        {busy ? "A importar..." : `Importar ${items.length || ""} aprendizagem(s)`}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
