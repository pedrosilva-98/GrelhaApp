import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { X, Mail, Trash2 } from "lucide-react";

export default function EmailConfigModal({ onClose }) {
    const { user } = useAuth();
    const [appPassword, setAppPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);
    const [loading, setLoading] = useState(true);
    const [configured, setConfigured] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const r = await api.get("/auth/email-config");
                setConfigured(!!r.data?.configured);
            } catch (e) {
                // ignore — form still usable
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    async function submit(e) {
        e.preventDefault();
        setError("");
        if (!appPassword.trim()) { setError("Indique a palavra-passe de aplicação."); return; }
        setBusy(true);
        try {
            await api.put("/auth/email-config", { app_password: appPassword });
            setDone(true);
            setConfigured(true);
            setAppPassword("");
            setTimeout(onClose, 1500);
        } catch (e) {
            setError(formatApiError(e));
        } finally {
            setBusy(false);
        }
    }

    async function remove() {
        if (!window.confirm("Remover a configuração de envio de email? Deixarás de poder enviar relatórios por email até reconfigurares.")) return;
        setBusy(true);
        setError("");
        try {
            await api.delete("/auth/email-config");
            setConfigured(false);
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
                            <Mail size={12} /> Relatórios
                        </div>
                        <h2 className="font-serif text-2xl text-brand-forest">Configurar envio de email</h2>
                    </div>
                    <button onClick={onClose} className="text-brand-sage hover:text-brand-charcoal">
                        <X size={20} />
                    </button>
                </div>

                <p className="text-sm text-brand-charcoal/70 mb-5 leading-relaxed">
                    Os relatórios são enviados a partir do teu próprio email (<strong className="text-brand-charcoal">{user?.email}</strong>). Para isso, gera uma <strong>palavra-passe de aplicação</strong> na tua conta Google (Segurança → Verificação em 2 passos → Palavras-passe de aplicação) e cola-a aqui.
                </p>

                {!loading && (
                    <div className={`text-xs px-3 py-1.5 rounded-full inline-block mb-4 ${configured ? "bg-[#E6F3E6] text-[#2E6B2E] border border-[#B3D9B3]" : "bg-page border border-crisp text-brand-charcoal/70"}`}>
                        {configured ? "Envio configurado ✓" : "Ainda não configurado"}
                    </div>
                )}

                {done ? (
                    <div className="text-center py-6">
                        <div className="text-[#2E6B2E] font-medium mb-2">Configuração guardada ✓</div>
                        <div className="text-sm text-brand-charcoal/60">A janela irá fechar em breve.</div>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-4" data-testid="email-config-form">
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage block mb-1.5">Palavra-passe de aplicação</label>
                            <input
                                type="password"
                                data-testid="email-config-password"
                                className="input-forest font-mono"
                                value={appPassword}
                                onChange={(e) => setAppPassword(e.target.value)}
                                placeholder="xxxx xxxx xxxx xxxx"
                                autoComplete="off"
                            />
                        </div>
                        {error && <div className="text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">{error}</div>}
                        <div className="flex gap-3 pt-1">
                            {configured && (
                                <button type="button" onClick={remove} disabled={busy} className="btn-danger-ghost !px-3" title="Remover configuração">
                                    <Trash2 size={14} />
                                </button>
                            )}
                            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
                            <button type="submit" data-testid="email-config-submit" disabled={busy} className="btn-primary flex-1 justify-center">
                                {busy ? "A guardar..." : "Guardar"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
