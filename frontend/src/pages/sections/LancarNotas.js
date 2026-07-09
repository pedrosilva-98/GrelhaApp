import { useEffect, useRef, useState, useCallback } from "react";
import Badge from "@/components/Badge";
import { calcClassif, domColor, NOTA_MAX } from "@/lib/grelha";
import { Info, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from "lucide-react";

export default function LancarNotas({ alunos, insts, dominios, saveNotas, focusedInstId, onBack }) {
    const [instId, setInstId] = useState(focusedInstId || insts[0]?.id || null);

    useEffect(() => {
        if (focusedInstId) setInstId(focusedInstId);
    }, [focusedInstId]);

    useEffect(() => {
        if (!focusedInstId && !insts.find((i) => i.id === instId)) {
            setInstId(insts[0]?.id || null);
        }
    }, [insts, instId, focusedInstId]);

    const inst = insts.find((i) => i.id === instId);
    const [notas, setNotas] = useState(inst?.notas || {});
    const [status, setStatus] = useState("idle"); // idle | dirty | saving | saved | error
    const [errorMsg, setErrorMsg] = useState("");

    // Save queue — one in-flight max, latest pending payload wins.
    const timerRef = useRef(null);
    const pendingRef = useRef(null); // { instId, payload }
    const inFlightRef = useRef(false);

    useEffect(() => {
        setNotas(inst?.notas || {});
        setStatus("idle");
        setErrorMsg("");
    }, [inst?.id]);

    const flush = useCallback(async () => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        if (!pendingRef.current || inFlightRef.current) return;
        const { instId: iid, payload } = pendingRef.current;
        pendingRef.current = null;
        inFlightRef.current = true;
        setStatus("saving");
        try {
            await saveNotas(iid, payload);
            setStatus("saved");
            setErrorMsg("");
            setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1500);
        } catch (e) {
            const detail = e?.response?.data?.detail || e?.message || "Falha ao guardar";
            setErrorMsg(String(detail));
            setStatus("error");
            // Re-queue payload so a next edit / retry can retry
            pendingRef.current = { instId: iid, payload };
        } finally {
            inFlightRef.current = false;
            // If another change happened while flying, kick another save
            if (pendingRef.current && status !== "error") {
                timerRef.current = setTimeout(flush, 200);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saveNotas]);

    // Warn user if leaving with unsaved changes
    useEffect(() => {
        function beforeUnload(e) {
            if (pendingRef.current || inFlightRef.current || status === "error") {
                e.preventDefault();
                e.returnValue = "";
            }
        }
        window.addEventListener("beforeunload", beforeUnload);
        return () => window.removeEventListener("beforeunload", beforeUnload);
    }, [status]);

    // On unmount or inst change: force flush pending
    useEffect(() => {
        return () => { flush(); };
    }, [flush]);

    function queueSave(iid, payload, immediate = false) {
        pendingRef.current = { instId: iid, payload };
        setStatus("dirty");
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flush, immediate ? 0 : 600);
    }

    function retry() {
        setStatus("dirty");
        flush();
    }

    const domColors = Object.fromEntries(dominios.map((d, i) => [d.code, domColor(i)]));

    function updateNota(alunoId, qId, value) {
        let v = value === "" ? "" : parseFloat(value);
        if (typeof v === "number" && !Number.isNaN(v)) {
            if (v < 0) v = 0;
            if (v > NOTA_MAX) v = NOTA_MAX;
        }
        const next = {
            ...notas,
            [alunoId]: { ...(notas[alunoId] || {}), [qId]: v === "" ? undefined : v },
        };
        if (next[alunoId][qId] === undefined) delete next[alunoId][qId];
        setNotas(next);
        const clean = {};
        for (const [aid, nMap] of Object.entries(next)) {
            const inner = {};
            for (const [qk, val] of Object.entries(nMap)) {
                if (val != null && val !== "") inner[qk] = Number(val);
            }
            if (Object.keys(inner).length) clean[aid] = inner;
        }
        queueSave(inst.id, clean);
    }

    function focusCell(rowIdx, colIdx) {
        const row = alunos[rowIdx];
        const q = inst?.questoes[colIdx];
        if (!row || !q) return;
        const el = document.querySelector(`[data-testid="nota-${row.id}-${q.id}"]`);
        if (el) { el.focus(); if (el.select) el.select(); }
    }

    function onKeyDown(e, rowIdx, colIdx) {
        const key = e.key;
        const rowsN = alunos.length;
        const colsN = inst?.questoes.length || 0;
        if (key === "Enter") {
            e.preventDefault();
            // Force immediate save on Enter for peace of mind
            flush();
            const next = e.shiftKey ? rowIdx - 1 : rowIdx + 1;
            if (next >= 0 && next < rowsN) focusCell(next, colIdx);
        } else if (key === "ArrowDown") {
            e.preventDefault();
            if (rowIdx + 1 < rowsN) focusCell(rowIdx + 1, colIdx);
        } else if (key === "ArrowUp") {
            e.preventDefault();
            if (rowIdx - 1 >= 0) focusCell(rowIdx - 1, colIdx);
        } else if (key === "ArrowRight" && e.target.selectionStart === e.target.value.length) {
            if (colIdx + 1 < colsN) { e.preventDefault(); focusCell(rowIdx, colIdx + 1); }
        } else if (key === "ArrowLeft" && e.target.selectionStart === 0) {
            if (colIdx - 1 >= 0) { e.preventDefault(); focusCell(rowIdx, colIdx - 1); }
        }
    }

    // Force flush when switching instrument via the select
    function onInstChange(newId) {
        flush();
        setInstId(newId);
    }

    if (!insts.length) {
        return (
            <div className="card-surface p-12 text-center anim-in">
                <div className="text-[10px] uppercase tracking-[0.25em] text-brand-sage mb-2">Sem instrumentos</div>
                <h2 className="font-serif text-2xl text-brand-forest mb-3">Nada para lançar ainda</h2>
                <p className="text-brand-charcoal/70 text-sm max-w-sm mx-auto">
                    Crie primeiro um instrumento de avaliação em <em>Instrumentos</em>.
                </p>
            </div>
        );
    }

    const instWithNotas = inst ? { ...inst, notas } : null;

    const statusBadge = (() => {
        if (status === "error") return (
            <button
                onClick={retry}
                className="flex items-center gap-1.5 text-[#9E3921] hover:underline"
                title={errorMsg}
                data-testid="notas-save-status"
            >
                <AlertCircle size={14} /> Erro ao guardar — repetir
            </button>
        );
        if (status === "saving") return (
            <span className="flex items-center gap-1.5 text-brand-sage" data-testid="notas-save-status">
                <Loader2 size={14} className="animate-spin" /> A guardar...
            </span>
        );
        if (status === "saved") return (
            <span className="flex items-center gap-1.5 text-[#2E6B2E]" data-testid="notas-save-status">
                <CheckCircle2 size={14} /> Guardado
            </span>
        );
        if (status === "dirty") return (
            <span className="flex items-center gap-1.5 text-brand-charcoal/60" data-testid="notas-save-status">
                <Loader2 size={14} className="animate-spin" /> Alterações por guardar…
            </span>
        );
        return (
            <span className="flex items-center gap-1.5 text-brand-sage/70" data-testid="notas-save-status">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-sage/40" /> Auto-guardar ativo
            </span>
        );
    })();

    return (
        <div className="space-y-5 anim-in" data-testid="notas-view">
            <div className="flex items-start gap-3 rounded-lg border border-[#B8D4EA] bg-[#EBF4FA] px-4 py-3 text-sm text-[#2B5A84]" data-testid="notas-help">
                <Info size={16} className="flex-shrink-0 mt-0.5" />
                <div>
                    <strong>Introduza as notas de 0 a 10</strong> em cada questão, independentemente da cotação (pontos). A classificação em percentagem e por domínio é calculada automaticamente, ponderando as respostas pela cotação de cada questão.
                    <div className="mt-1 text-[12px] text-[#2B5A84]/80">
                        Atalhos: <kbd className="font-mono bg-white/70 border border-[#B8D4EA] rounded px-1">Enter</kbd> desce e grava, <kbd className="font-mono bg-white/70 border border-[#B8D4EA] rounded px-1">Shift</kbd>+<kbd className="font-mono bg-white/70 border border-[#B8D4EA] rounded px-1">Enter</kbd> sobe, <kbd className="font-mono bg-white/70 border border-[#B8D4EA] rounded px-1">Tab</kbd> avança questão, <kbd className="font-mono bg-white/70 border border-[#B8D4EA] rounded px-1">↑ ↓ ← →</kbd> navegam.
                    </div>
                </div>
            </div>

            {status === "error" && (
                <div className="rounded-lg border border-[#F5C2B8] bg-[#FDF0ED] px-4 py-3 text-sm text-[#9E3921] flex items-start gap-3" data-testid="notas-save-error">
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <strong>Não foi possível guardar a última alteração.</strong>
                        <div className="text-[13px] mt-1">{errorMsg || "Verifique a ligação à internet."}</div>
                    </div>
                    <button onClick={retry} className="btn-ghost text-xs whitespace-nowrap" data-testid="notas-retry-btn">Tentar de novo</button>
                </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
                {onBack && (
                    <button data-testid="notas-back-btn" onClick={onBack} className="btn-ghost text-sm">
                        <ArrowLeft size={14} /> Voltar aos instrumentos
                    </button>
                )}
                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage">Instrumento</label>
                <select
                    data-testid="notas-inst-select"
                    className="input-forest max-w-md"
                    style={{ width: "auto" }}
                    value={instId || ""}
                    onChange={(e) => onInstChange(e.target.value)}
                >
                    {insts.map((i) => <option key={i.id} value={i.id}>{i.nome} · {i.tipo}</option>)}
                </select>
                <div className="ml-auto text-xs">{statusBadge}</div>
            </div>

            {inst && (
                <div className="card-surface overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-page border-b border-crisp sticky top-0">
                                <tr>
                                    <th className="text-left px-5 py-3 text-[11px] uppercase tracking-[0.15em] text-brand-sage font-semibold min-w-[180px]">Aluno</th>
                                    {inst.questoes.map((q) => (
                                        <th key={q.id} className="px-2 py-2 text-center">
                                            <div className="text-[13px] font-medium text-brand-charcoal font-mono">{q.id}</div>
                                            <div className="text-[10px] tabular-nums font-mono" style={{ color: domColors[q.dom] || "#5C7368" }}>
                                                {q.dom} · {Number(q.cotacao).toFixed(1)}
                                            </div>
                                        </th>
                                    ))}
                                    <th className="px-4 py-3 text-[11px] uppercase tracking-[0.15em] text-brand-sage font-semibold">Avaliação Quantitativa</th>
                                    <th className="px-4 py-3 text-[11px] uppercase tracking-[0.15em] text-brand-sage font-semibold">Avaliação Qualitativa</th>
                                </tr>
                            </thead>
                            <tbody>
                                {alunos.length === 0 ? (
                                    <tr><td colSpan={inst.questoes.length + 3} className="px-5 py-10 text-center text-brand-sage">Adicione alunos primeiro.</td></tr>
                                ) : alunos.map((a, rowIdx) => {
                                    const classif = calcClassif(instWithNotas, a.id);
                                    return (
                                        <tr key={a.id} className={`border-b border-crisp last:border-0 row-hover ${rowIdx % 2 === 1 ? "bg-page/60" : ""}`}>
                                            <td className="px-5 py-2.5 font-medium text-brand-charcoal whitespace-nowrap">{a.nome}</td>
                                            {inst.questoes.map((q, colIdx) => {
                                                const cur = notas[a.id]?.[q.id];
                                                return (
                                                    <td key={q.id} className="px-1.5 py-1.5 text-center">
                                                        <input
                                                            data-testid={`nota-${a.id}-${q.id}`}
                                                            type="number"
                                                            step="0.1"
                                                            min={0}
                                                            max={NOTA_MAX}
                                                            value={cur ?? ""}
                                                            onChange={(e) => updateNota(a.id, q.id, e.target.value)}
                                                            onBlur={() => flush()}
                                                            onKeyDown={(e) => onKeyDown(e, rowIdx, colIdx)}
                                                            className="grid-cell-input"
                                                            placeholder="0-10"
                                                        />
                                                    </td>
                                                );
                                            })}
                                            <td className="px-4 py-2.5 tabular-nums font-serif text-base text-brand-forest">
                                                {classif != null ? classif.toFixed(1) + "%" : "—"}
                                            </td>
                                            <td className="px-4 py-2.5"><Badge v={classif} mode="number" /></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
