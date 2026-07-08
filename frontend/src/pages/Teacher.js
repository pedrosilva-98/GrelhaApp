import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Dashboard from "@/pages/sections/Dashboard";
import Turma from "@/pages/sections/Turma";
import Instrumentos from "@/pages/sections/Instrumentos";
import LancarNotas from "@/pages/sections/LancarNotas";
import Config from "@/pages/sections/Config";
import { exportGrelhaPDF } from "@/lib/pdf";
import { LogOut, LayoutDashboard, Users, ClipboardList, Pencil, Settings, Download } from "lucide-react";

const TABS = [
    { id: "dashboard", label: "Resumo", icon: LayoutDashboard },
    { id: "alunos", label: "Turma", icon: Users },
    { id: "instrumentos", label: "Instrumentos", icon: ClipboardList },
    { id: "notas", label: "Lançar notas", icon: Pencil },
    { id: "config", label: "Configurar", icon: Settings },
];

export default function Teacher() {
    const { user, logout } = useAuth();
    const [tab, setTab] = useState("dashboard");
    const [alunos, setAlunos] = useState([]);
    const [insts, setInsts] = useState([]);
    const [ponderacoes, setPonderacoes] = useState({ CP: 50, RRP: 25, CM: 10, ER: 15 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    async function loadAll() {
        setLoading(true);
        try {
            const [a, i, p] = await Promise.all([
                api.get("/alunos"),
                api.get("/instrumentos"),
                api.get("/ponderacoes"),
            ]);
            setAlunos(a.data);
            setInsts(i.data);
            setPonderacoes(p.data);
        } catch (e) {
            setError(formatApiError(e));
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => { loadAll(); }, []);

    async function addAluno(nome) {
        const { data } = await api.post("/alunos", { nome });
        setAlunos((s) => [...s, data]);
    }
    async function delAluno(id) {
        if (!window.confirm("Eliminar aluno?")) return;
        await api.delete(`/alunos/${id}`);
        setAlunos((s) => s.filter((a) => a.id !== id));
        // Refresh instrumentos (notas may have been trimmed server-side)
        const r = await api.get("/instrumentos");
        setInsts(r.data);
    }
    async function addInstrumento(payload) {
        const { data } = await api.post("/instrumentos", payload);
        setInsts((s) => [...s, data]);
    }
    async function delInstrumento(id) {
        if (!window.confirm("Eliminar instrumento e todas as notas?")) return;
        await api.delete(`/instrumentos/${id}`);
        setInsts((s) => s.filter((i) => i.id !== id));
    }
    async function saveNotas(instId, notasMap) {
        await api.put(`/instrumentos/${instId}/notas`, { notas: notasMap });
        setInsts((s) => s.map((i) => (i.id === instId ? { ...i, notas: notasMap } : i)));
    }
    async function savePonderacoes(vals) {
        const { data } = await api.put("/ponderacoes", vals);
        setPonderacoes(data);
    }

    function onExport() {
        exportGrelhaPDF({ user, alunos, insts, ponderacoes });
    }

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="bg-surface border-b border-crisp">
                <div className="max-w-6xl mx-auto px-6 sm:px-10 pt-5 pb-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-md bg-brand-forest flex items-center justify-center">
                                <span className="text-page font-serif text-xl leading-none">G</span>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.25em] text-brand-sage">Agrupamento · 2025/2026</div>
                                <div className="font-serif text-2xl text-brand-forest leading-tight">
                                    {user?.disciplina} · {user?.ano} {user?.turma}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button data-testid="export-pdf-btn" onClick={onExport} className="btn-ghost">
                                <Download size={15} /> Exportar PDF
                            </button>
                            <div className="text-right hidden sm:block">
                                <div className="text-sm font-medium text-brand-charcoal">{user?.nome}</div>
                                <div className="text-[11px] text-brand-sage">{user?.email}</div>
                            </div>
                            <button data-testid="logout-btn" onClick={logout} className="btn-ghost" title="Sair">
                                <LogOut size={15} /> Sair
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <nav className="flex gap-1 mt-6 -mb-4 overflow-x-auto" role="tablist">
                        {TABS.map((t) => {
                            const Icon = t.icon;
                            const active = tab === t.id;
                            return (
                                <button
                                    key={t.id}
                                    data-testid={`tab-${t.id}`}
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => setTab(t.id)}
                                    className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors duration-200 whitespace-nowrap ${
                                        active
                                            ? "border-brand-forest text-brand-forest font-medium"
                                            : "border-transparent text-brand-charcoal/50 hover:text-brand-charcoal"
                                    }`}
                                >
                                    <Icon size={15} />
                                    {t.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 sm:px-10 py-8">
                {error && (
                    <div className="mb-4 text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">{error}</div>
                )}
                {loading ? (
                    <div className="text-center text-brand-sage py-24">A carregar...</div>
                ) : (
                    <>
                        {tab === "dashboard" && <Dashboard alunos={alunos} insts={insts} ponderacoes={ponderacoes} />}
                        {tab === "alunos" && <Turma alunos={alunos} addAluno={addAluno} delAluno={delAluno} />}
                        {tab === "instrumentos" && <Instrumentos insts={insts} addInstrumento={addInstrumento} delInstrumento={delInstrumento} />}
                        {tab === "notas" && <LancarNotas alunos={alunos} insts={insts} saveNotas={saveNotas} />}
                        {tab === "config" && <Config ponderacoes={ponderacoes} savePonderacoes={savePonderacoes} />}
                    </>
                )}
            </main>
        </div>
    );
}
