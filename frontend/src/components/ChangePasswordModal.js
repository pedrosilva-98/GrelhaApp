import { useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { X, KeyRound } from "lucide-react";

export default function ChangePasswordModal({ onClose }) {
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirmNext, setConfirmNext] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);

    async function submit(e) {
        e.preventDefault();
        setError("");
        if (next.length < 4) { setError("A nova palavra-passe deve ter pelo menos 4 caracteres."); return; }
        if (next !== confirmNext) { setError("As palavras-passe não coincidem."); return; }
        setBusy(true);
        try {
            await api.post("/auth/change-password", { current_password: current, new_password: next });
            setDone(true);
            setTimeout(onClose, 1500);
        } catch (e) {
            setError(formatApiError(e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="card-surface w-full max-w-md p-8 anim-in" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.25em] text-brand-sage mb-1 flex items-center gap-2">
                            <KeyRound size={12} /> Segurança
                        </div>
                        <h2 className="font-serif text-2xl text-brand-forest">Alterar palavra-passe</h2>
                    </div>
                    <button onClick={onClose} className="text-brand-sage hover:text-brand-charcoal">
                        <X size={20} />
                    </button>
                </div>

                {done ? (
                    <div className="text-center py-6">
                        <div className="text-[#2E6B2E] font-medium mb-2">Palavra-passe alterada ✓</div>
                        <div className="text-sm text-brand-charcoal/60">A janela irá fechar em breve.</div>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-4" data-testid="change-pw-form">
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage block mb-1.5">Palavra-passe atual</label>
                            <input required type="password" data-testid="pw-current" className="input-forest" value={current} onChange={(e) => setCurrent(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage block mb-1.5">Nova palavra-passe</label>
                            <input required type="password" data-testid="pw-new" className="input-forest" value={next} onChange={(e) => setNext(e.target.value)} minLength={4} />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage block mb-1.5">Confirmar nova</label>
                            <input required type="password" data-testid="pw-confirm" className="input-forest" value={confirmNext} onChange={(e) => setConfirmNext(e.target.value)} minLength={4} />
                        </div>
                        {error && <div className="text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">{error}</div>}
                        <div className="flex gap-3 pt-3">
                            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
                            <button type="submit" data-testid="pw-submit" disabled={busy} className="btn-primary flex-1 justify-center">
                                {busy ? "A guardar..." : "Guardar"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
