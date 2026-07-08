import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { LogOut, Plus, Trash2, GraduationCap, Copy } from "lucide-react";

export default function Admin() {
    const { user, logout } = useAuth();
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState({ nome: "", email: "", password: "" });
    const [creating, setCreating] = useState(false);
    const [justCreated, setJustCreated] = useState(null);

    async function load() {
        try {
            const r = await api.get("/admin/teachers");
            setTeachers(r.data);
        } catch (e) {
            setError(formatApiError(e));
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => { load(); }, []);

    async function submit(e) {
        e.preventDefault();
        setCreating(true);
        setError("");
        try {
            await api.post("/admin/teachers", form);
            setJustCreated({ email: form.email, password: form.password });
            setForm({ nome: "", email: "", password: "" });
            setShowModal(false);
            await load();
        } catch (e) {
            setError(formatApiError(e));
        } finally {
            setCreating(false);
        }
    }

    async function del(id) {
        if (!window.confirm("Eliminar este professor e todos os seus dados?")) return;
        try {
            await api.delete(`/admin/teachers/${id}`);
            await load();
        } catch (e) { setError(formatApiError(e)); }
    }

    function copy(text) { navigator.clipboard.writeText(text); }

    return (
        <div className="min-h-screen">
            <header className="border-b border-crisp bg-surface">
                <div className="max-w-6xl mx-auto px-6 sm:px-10 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md bg-brand-forest flex items-center justify-center">
                            <span className="text-page font-serif text-lg">G</span>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase tracking-[0.25em] text-brand-sage">Painel</div>
                            <div className="font-serif text-xl text-brand-forest">Administração</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <div className="text-sm font-medium text-brand-charcoal">{user?.nome}</div>
                            <div className="text-[11px] text-brand-sage">{user?.email}</div>
                        </div>
                        <button data-testid="logout-btn" onClick={logout} className="btn-ghost text-sm">
                            <LogOut size={15} /> Sair
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 sm:px-10 py-10">
                <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
                    <div>
                        <div className="text-xs uppercase tracking-[0.25em] text-brand-sage mb-2">Contas de acesso</div>
                        <h1 className="font-serif text-4xl text-brand-forest">Professores</h1>
                        <p className="text-brand-charcoal/70 mt-2 text-sm max-w-xl">
                            Crie e faça a gestão das contas de professores. Cada docente irá criar e gerir as suas próprias turmas, disciplinas e anos após o primeiro acesso.
                        </p>
                    </div>
                    <button
                        data-testid="admin-add-teacher-btn"
                        onClick={() => setShowModal(true)}
                        className="btn-primary"
                    >
                        <Plus size={16} /> Novo professor
                    </button>
                </div>

                {justCreated && (
                    <div className="mb-6 border border-[#B3D9B3] bg-[#E6F3E6] rounded-lg p-4 text-sm text-[#2E6B2E]">
                        <div className="font-medium mb-1">Conta criada com sucesso</div>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 items-center">
                            <span>Email: <strong className="font-mono">{justCreated.email}</strong></span>
                            <span>Palavra-passe: <strong className="font-mono">{justCreated.password}</strong></span>
                            <button onClick={() => copy(`${justCreated.email} / ${justCreated.password}`)} className="btn-ghost text-xs py-1 px-2">
                                <Copy size={12} /> Copiar
                            </button>
                            <button onClick={() => setJustCreated(null)} className="ml-auto text-[#2E6B2E]/60 hover:text-[#2E6B2E] text-xs">Fechar</button>
                        </div>
                        <div className="mt-2 text-xs text-[#2E6B2E]/80">Partilhe estas credenciais com o(a) docente.</div>
                    </div>
                )}

                {error && (
                    <div className="mb-4 text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">{error}</div>
                )}

                <div className="card-surface overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-page border-b border-crisp">
                            <tr className="text-left text-[11px] uppercase tracking-[0.15em] text-brand-sage">
                                <th className="px-5 py-3 font-semibold">Nome</th>
                                <th className="px-5 py-3 font-semibold">Email</th>
                                <th className="px-5 py-3 font-semibold">Criado a</th>
                                <th className="px-5 py-3 font-semibold w-16"></th>
                            </tr>
                        </thead>
                        <tbody data-testid="teachers-list">
                            {loading ? (
                                <tr><td colSpan={4} className="px-5 py-10 text-center text-brand-sage">A carregar...</td></tr>
                            ) : teachers.length === 0 ? (
                                <tr><td colSpan={4} className="px-5 py-16 text-center text-brand-sage">
                                    <GraduationCap className="mx-auto mb-3 opacity-40" size={32} />
                                    Ainda não criou nenhuma conta de professor.
                                </td></tr>
                            ) : teachers.map((t) => (
                                <tr key={t.id} className="border-b border-crisp last:border-0 row-hover">
                                    <td className="px-5 py-3 font-medium text-brand-charcoal">{t.nome}</td>
                                    <td className="px-5 py-3 font-mono text-xs text-brand-charcoal/80">{t.email}</td>
                                    <td className="px-5 py-3 text-brand-charcoal/60 text-xs">
                                        {t.created_at ? new Date(t.created_at).toLocaleDateString("pt-PT") : "—"}
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <button
                                            data-testid={`delete-teacher-${t.id}`}
                                            onClick={() => del(t.id)}
                                            className="btn-danger-ghost"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>

            {showModal && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div className="card-surface w-full max-w-md p-8 anim-in" onClick={(e) => e.stopPropagation()}>
                        <div className="text-[11px] uppercase tracking-[0.25em] text-brand-sage mb-2">Nova conta</div>
                        <h2 className="font-serif text-2xl text-brand-forest mb-6">Criar professor</h2>
                        <p className="text-xs text-brand-charcoal/60 mb-6 -mt-3">
                            O(A) docente irá depois criar as suas próprias turmas dentro da app.
                        </p>
                        <form onSubmit={submit} className="space-y-4" data-testid="new-teacher-form">
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage block mb-1.5">Nome</label>
                                <input required data-testid="teacher-nome" className="input-forest" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex: Joana Silva" />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage block mb-1.5">Email</label>
                                <input required type="email" data-testid="teacher-email" className="input-forest" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="joana@escola.pt" />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage block mb-1.5">Palavra-passe</label>
                                <input required minLength={4} data-testid="teacher-password" className="input-forest" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Mínimo 4 caracteres" />
                            </div>
                            <div className="flex gap-3 pt-3">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1 justify-center">Cancelar</button>
                                <button type="submit" data-testid="teacher-submit" disabled={creating} className="btn-primary flex-1 justify-center">
                                    {creating ? "A criar..." : "Criar conta"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
