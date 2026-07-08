import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";

export default function Login() {
    const { user, login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const nav = useNavigate();

    if (user && user !== false) {
        return <Navigate to={user.role === "admin" ? "/admin" : "/app"} replace />;
    }

    async function submit(e) {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
            const u = await login(email.trim().toLowerCase(), password);
            nav(u.role === "admin" ? "/admin" : "/app");
        } catch (err) {
            setError(formatApiError(err));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="min-h-screen grid lg:grid-cols-[1fr_1.1fr] bg-page">
            {/* Left panel — form */}
            <div className="flex flex-col justify-between px-8 sm:px-12 lg:px-16 py-10">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-brand-forest flex items-center justify-center">
                        <span className="text-page font-serif text-lg leading-none">G</span>
                    </div>
                    <div className="flex flex-col leading-tight">
                        <span className="font-serif text-lg text-brand-charcoal">Grelha</span>
                        <span className="text-[10px] uppercase tracking-[0.25em] text-brand-sage">Avaliação Docente</span>
                    </div>
                </div>

                <div className="max-w-md w-full mx-auto lg:mx-0 anim-in">
                    <div className="text-xs uppercase tracking-[0.25em] text-brand-sage mb-4">Bem-vindo(a)</div>
                    <h1 className="font-serif text-4xl sm:text-5xl leading-[1.05] text-brand-forest mb-4">
                        Entre no seu <em className="not-italic text-brand-terracotta">caderno</em> de avaliações.
                    </h1>
                    <p className="text-brand-charcoal/70 mb-8 leading-relaxed">
                        Ferramenta profissional para gerir grelhas, instrumentos e domínios de avaliação, com privacidade por professor.
                    </p>

                    <form onSubmit={submit} className="space-y-4" data-testid="login-form">
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage block mb-1.5">Email</label>
                            <input
                                data-testid="login-email"
                                type="email"
                                required
                                autoFocus
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input-forest"
                                placeholder="admin@escola.pt"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage block mb-1.5">Palavra-passe</label>
                            <input
                                data-testid="login-password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input-forest"
                                placeholder="••••••••"
                            />
                        </div>

                        {error && (
                            <div data-testid="login-error" className="text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">
                                {error}
                            </div>
                        )}

                        <button
                            data-testid="login-submit"
                            type="submit"
                            disabled={busy}
                            className="btn-primary w-full justify-center"
                        >
                            {busy ? "A entrar..." : "Entrar"}
                        </button>

                        <div className="text-xs text-brand-charcoal/50 pt-2 leading-relaxed">
                            Não tem conta? Contacte o <strong className="text-brand-charcoal">administrador</strong> do agrupamento para lhe criar acesso.
                        </div>
                    </form>
                </div>

                <div className="text-[11px] text-brand-sage tracking-wider">
                    © {new Date().getFullYear()} · Grelha de Avaliação
                </div>
            </div>

            {/* Right panel — hero */}
            <div className="relative hidden lg:block overflow-hidden">
                <img
                    alt="Costa Nova, Portugal"
                    src="https://images.unsplash.com/photo-1563416854-0e5e3a0cfdb5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njl8MHwxfHNlYXJjaHw0fHxwb3J0dWdhbCUyMGFyY2hpdGVjdHVyZSUyMGFic3RyYWN0fGVufDB8fHx8MTc4MzUyMDIxOHww&ixlib=rb-4.1.0&q=85"
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-brand-forest/70 via-brand-forest/30 to-transparent" />
                <div className="grain absolute inset-0" />
                <div className="absolute bottom-10 left-10 right-10 text-page">
                    <div className="font-serif text-3xl leading-tight max-w-md">
                        <em className="not-italic text-brand-ochre">&ldquo;Avaliar</em> é uma forma de ensinar.&rdquo;
                    </div>
                    <div className="mt-3 text-sm opacity-80">— pedagogia diferenciada</div>
                </div>
            </div>
        </div>
    );
}
