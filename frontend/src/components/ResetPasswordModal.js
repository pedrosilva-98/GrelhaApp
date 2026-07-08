import { useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { X, KeyRound, Copy } from "lucide-react";

export default function ResetPasswordModal({ teacher, onClose, onDone }) {
    const [pw, setPw] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);
    const [saved, setSaved] = useState("");

    async function submit(e) {
        e.preventDefault();
        setError("");
        if (pw.length < 4) { setError("Mínimo 4 caracteres."); return; }
        setBusy(true);
        try {
            await api.post(`/admin/teachers/${teacher.id}/reset-password`, { new_password: pw });
            setSaved(pw);
            setDone(true);
            onDone && onDone(pw);
        } catch (e) {
            setError(formatApiError(e));
        } finally {
            setBusy(false);
        }
    }

    function copy() { navigator.clipboard.writeText(`${teacher.email} / ${saved}`); }

    return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="card-surface w-full max-w-md p-8 anim-in" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.25em] text-brand-sage mb-1 flex items-center gap-2">
                            <KeyRound size={12} /> Redefinição
                        </div>
                        <h2 className="font-serif text-2xl text-brand-forest">Nova palavra-passe</h2>
                        <div className="text-xs text-brand-charcoal/60 mt-1">para {teacher.email}</div>
                    </div>
                    <button onClick={onClose} className="text-brand-sage hover:text-brand-charcoal">
                        <X size={20} />
                    </button>
                </div>

                {done ? (
                    <div className="border border-[#B3D9B3] bg-[#E6F3E6] rounded-lg p-4 text-sm text-[#2E6B2E]">
                        <div className="font-medium mb-2">Palavra-passe redefinida ✓</div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 items-center mb-3">
                            <span>Email: <strong className="font-mono">{teacher.email}</strong></span>
                            <span>Nova PW: <strong className="font-mono">{saved}</strong></span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={copy} className="btn-ghost text-xs">
                                <Copy size={12} /> Copiar
                            </button>
                            <button onClick={onClose} className="btn-primary text-xs">Fechar</button>
                        </div>
                        <div className="mt-2 text-xs text-[#2E6B2E]/80">Partilhe esta credencial com o(a) docente.</div>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-4" data-testid="reset-pw-form">
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage block mb-1.5">Nova palavra-passe</label>
                            <input required type="text" data-testid="reset-pw-input" className="input-forest font-mono" value={pw} onChange={(e) => setPw(e.target.value)} minLength={4} autoFocus placeholder="Mínimo 4 caracteres" />
                        </div>
                        {error && <div className="text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">{error}</div>}
                        <div className="flex gap-3 pt-3">
                            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
                            <button type="submit" data-testid="reset-pw-submit" disabled={busy} className="btn-primary flex-1 justify-center">
                                {busy ? "A redefinir..." : "Redefinir"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
