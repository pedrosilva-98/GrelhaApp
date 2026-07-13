import { useEffect, useMemo, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Dashboard from "@/pages/sections/Dashboard";
import Turma from "@/pages/sections/Turma";
import Instrumentos from "@/pages/sections/Instrumentos";
import LancarNotas from "@/pages/sections/LancarNotas";
import Config from "@/pages/sections/Config";
import TurmaFormModal from "@/components/TurmaFormModal";
import TurmasEmpty from "@/components/TurmasEmpty";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import { exportGrelhaPDF, exportInstrumentoRelatorioPDF } from "@/lib/pdf";
import { LogOut, LayoutDashboard, Users, ClipboardList, Pencil, Settings, Download, Plus, Trash2, ChevronDown, Copy, KeyRound } from "lucide-react";

const TABS = [
    { id: "dashboard", label: "Resumo", icon: LayoutDashboard },
    { id: "alunos", label: "Turma", icon: Users },
    { id: "instrumentos", label: "Instrumentos de avaliação", icon: ClipboardList },
    { id: "config", label: "Configurar", icon: Settings },
];

const LS_TURMA_KEY = "grelha_active_turma";

export default function Teacher() {
    const { user, logout } = useAuth();
    const [tab, setTab] = useState("dashboard");

    const [turmas, setTurmas] = useState([]);
    const [turmaId, setTurmaId] = useState(() => localStorage.getItem(LS_TURMA_KEY) || null);
    const [showTurmaModal, setShowTurmaModal] = useState(false);
    const [editTurmaModal, setEditTurmaModal] = useState(false);
    const [showTurmaPicker, setShowTurmaPicker] = useState(false);
    const [showChangePw, setShowChangePw] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);

    const [alunos, setAlunos] = useState([]);
    const [insts, setInsts] = useState([]);
    const [classifyingInstId, setClassifyingInstId] = useState(null);

    const [loadingTurmas, setLoadingTurmas] = useState(true);
    const [loadingData, setLoadingData] = useState(false);
    const [error, setError] = useState("");

    const turmaAtiva = useMemo(() => turmas.find((t) => t.id === turmaId), [turmas, turmaId]);
    const dominios = turmaAtiva?.dominios || [];
    const competencias = turmaAtiva?.competencias || [];
    const parametrosOD = turmaAtiva?.parametros_od || [];

    async function loadTurmas(selectId) {
        setLoadingTurmas(true);
        try {
            const r = await api.get("/turmas");
            setTurmas(r.data);
            const saved = selectId || localStorage.getItem(LS_TURMA_KEY);
            const validSaved = r.data.find((t) => t.id === saved);
            if (validSaved) setTurmaId(validSaved.id);
            else if (r.data.length > 0) {
                setTurmaId(r.data[0].id);
                localStorage.setItem(LS_TURMA_KEY, r.data[0].id);
            } else {
                setTurmaId(null);
                localStorage.removeItem(LS_TURMA_KEY);
            }
        } catch (e) {
            setError(formatApiError(e));
        } finally {
            setLoadingTurmas(false);
        }
    }
    useEffect(() => { loadTurmas(); }, []);

    async function loadTurmaData(id) {
        setLoadingData(true);
        setError("");
        try {
            const [a, i] = await Promise.all([
                api.get("/alunos", { params: { turma_id: id } }),
                api.get("/instrumentos", { params: { turma_id: id } }),
            ]);
            setAlunos(a.data);
            setInsts(i.data);
        } catch (e) {
            setError(formatApiError(e));
        } finally {
            setLoadingData(false);
        }
    }
    useEffect(() => {
        if (turmaId) {
            localStorage.setItem(LS_TURMA_KEY, turmaId);
            loadTurmaData(turmaId);
            setClassifyingInstId(null);
        } else {
            setAlunos([]); setInsts([]);
            setClassifyingInstId(null);
        }
    }, [turmaId]);

    async function createTurma(payload) {
        const { data } = await api.post("/turmas", payload);
        setTurmas((s) => [...s, data]);
        setTurmaId(data.id);
        setShowTurmaModal(false);
    }

    async function editTurma(payload) {
        if (!turmaId) return;
        const { data } = await api.put(`/turmas/${turmaId}`, payload);
        setTurmas((s) => s.map((t) => (t.id === turmaId ? { ...t, ...data } : t)));
        setEditTurmaModal(false);
    }

    async function duplicateTurma() {
        if (!turmaAtiva) return;
        const ok = window.confirm(
            `Duplicar a turma "${turmaAtiva.disciplina} ${turmaAtiva.ano}${turmaAtiva.turma}"?\n\n` +
            "Só as configurações são copiadas (disciplina, ano, domínios e ponderações).\n" +
            "Os alunos e instrumentos NÃO são copiados."
        );
        if (!ok) return;
        const { data } = await api.post(`/turmas/${turmaAtiva.id}/duplicate`);
        setTurmas((s) => [...s, data]);
        setTurmaId(data.id);
    }

    async function deleteTurma() {
        if (!turmaAtiva) return;
        if (!window.confirm(`Eliminar a turma "${turmaAtiva.disciplina} ${turmaAtiva.ano}${turmaAtiva.turma}" e todos os seus alunos, instrumentos e notas? Esta ação é irreversível.`)) return;
        await api.delete(`/turmas/${turmaAtiva.id}`);
        const remaining = turmas.filter((t) => t.id !== turmaAtiva.id);
        setTurmas(remaining);
        setTurmaId(remaining[0]?.id || null);
    }

    async function saveDominios(newDominios) {
        const { data } = await api.put(`/turmas/${turmaId}/dominios`, { dominios: newDominios });
        setTurmas((s) => s.map((t) => (t.id === turmaId ? { ...t, dominios: data.dominios } : t)));
    }

    async function saveAprendizagems(newComps) {
        const { data } = await api.put(`/turmas/${turmaId}/competencias`, { competencias: newComps });
        setTurmas((s) => s.map((t) => (t.id === turmaId ? { ...t, competencias: data.competencias } : t)));
    }

    async function saveTurmaConfig(payload) {
        const { data } = await api.put(`/turmas/${turmaId}/config`, payload);
        setTurmas((s) => s.map((t) => (t.id === turmaId ? { ...t, ...data } : t)));
    }

    async function addAluno(payload) {
        const body = typeof payload === "string" ? { nome: payload } : payload;
        const { data } = await api.post("/alunos", body, { params: { turma_id: turmaId } });
        setAlunos((s) => [...s, data]);
    }
    async function addAlunosBulk(nomes) {
        const { data } = await api.post("/alunos/bulk", { nomes }, { params: { turma_id: turmaId } });
        setAlunos((s) => [...s, ...(data.alunos || [])]);
        return data;
    }
    async function delAluno(id) {
        if (!window.confirm("Eliminar aluno?")) return;
        await api.delete(`/alunos/${id}`);
        setAlunos((s) => s.filter((a) => a.id !== id));
        const r = await api.get("/instrumentos", { params: { turma_id: turmaId } });
        setInsts(r.data);
    }
    async function addInstrumento(payload) {
        const { data } = await api.post("/instrumentos", payload, { params: { turma_id: turmaId } });
        setInsts((s) => [...s, data]);
    }
    async function updateInstrumento(id, payload) {
        const { data } = await api.put(`/instrumentos/${id}`, payload);
        setInsts((s) => s.map((i) => (i.id === id ? data : i)));
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

    function onExport() {
        if (!turmaAtiva) return;
        exportGrelhaPDF({ user, turma: turmaAtiva, alunos, insts });
    }

    if (!loadingTurmas && turmas.length === 0) {
        return (
            <div className="min-h-screen">
                <SimpleHeader user={user} onLogout={logout} />
                <TurmasEmpty onCreate={() => setShowTurmaModal(true)} />
                {showTurmaModal && (
                    <TurmaFormModal onClose={() => setShowTurmaModal(false)} onSubmit={createTurma} />
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <header className="bg-surface border-b border-crisp">
                <div className="max-w-6xl mx-auto px-6 sm:px-10 pt-5 pb-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-md bg-brand-forest flex items-center justify-center flex-shrink-0">
                                <span className="text-page font-serif text-xl leading-none">G</span>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.25em] text-brand-sage">Agrupamento · 2025/2026</div>
                                <div className="relative inline-block">
                                    <button
                                        data-testid="turma-picker-btn"
                                        onClick={() => setShowTurmaPicker((v) => !v)}
                                        className="flex items-center gap-2 group -ml-1 px-1 py-0.5 rounded-md hover:bg-page transition-colors duration-200"
                                    >
                                        <span className="font-serif text-2xl text-brand-forest leading-tight">
                                            {turmaAtiva ? `${turmaAtiva.disciplina} · ${turmaAtiva.ano} ${turmaAtiva.turma}` : "Selecionar turma"}
                                        </span>
                                        <ChevronDown size={16} className="text-brand-sage group-hover:text-brand-charcoal transition-colors" />
                                    </button>
                                    {showTurmaPicker && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setShowTurmaPicker(false)} />
                                            <div className="absolute left-0 top-full mt-1 z-50 card-surface shadow-lg min-w-[260px] overflow-hidden" data-testid="turma-picker-menu">
                                                <div className="text-[10px] uppercase tracking-[0.2em] text-brand-sage px-4 pt-3 pb-1">Minhas turmas</div>
                                                {turmas.map((t) => {
                                                    const active = t.id === turmaId;
                                                    return (
                                                        <button
                                                            key={t.id}
                                                            data-testid={`pick-turma-${t.id}`}
                                                            onClick={() => { setTurmaId(t.id); setShowTurmaPicker(false); }}
                                                            className={`w-full text-left px-4 py-2.5 hover:bg-page transition-colors duration-150 flex items-baseline justify-between gap-4 ${active ? "bg-page" : ""}`}
                                                        >
                                                            <div>
                                                                <div className="font-medium text-brand-charcoal text-sm">{t.disciplina}</div>
                                                                <div className="text-[11px] text-brand-charcoal/60">{t.ano} {t.turma}</div>
                                                            </div>
                                                            {active && <span className="text-[10px] text-brand-forest uppercase tracking-wider">Atual</span>}
                                                        </button>
                                                    );
                                                })}
                                                <div className="divider-dashed" />
                                                <button
                                                    data-testid="picker-new-turma"
                                                    onClick={() => { setShowTurmaPicker(false); setShowTurmaModal(true); }}
                                                    className="w-full text-left px-4 py-2.5 text-sm text-brand-forest hover:bg-page transition-colors duration-150 flex items-center gap-2"
                                                >
                                                    <Plus size={14} /> Nova turma
                                                </button>
                                                {turmaAtiva && (
                                                    <>
                                                        <button
                                                            data-testid="picker-edit-turma"
                                                            onClick={() => { setShowTurmaPicker(false); setEditTurmaModal(true); }}
                                                            className="w-full text-left px-4 py-2.5 text-sm text-brand-charcoal hover:bg-page transition-colors duration-150 flex items-center gap-2"
                                                        >
                                                            <Pencil size={14} /> Renomear turma
                                                        </button>
                                                        <button
                                                            data-testid="picker-dup-turma"
                                                            onClick={() => { setShowTurmaPicker(false); duplicateTurma(); }}
                                                            className="w-full text-left px-4 py-2.5 text-sm text-brand-charcoal hover:bg-page transition-colors duration-150 flex items-center gap-2"
                                                        >
                                                            <Copy size={14} /> Duplicar turma
                                                        </button>
                                                        <button
                                                            data-testid="picker-del-turma"
                                                            onClick={() => { setShowTurmaPicker(false); deleteTurma(); }}
                                                            className="w-full text-left px-4 py-2.5 text-sm text-[#9E3921] hover:bg-[#FDF0ED] transition-colors duration-150 flex items-center gap-2"
                                                        >
                                                            <Trash2 size={14} /> Eliminar turma atual
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button data-testid="export-pdf-btn" onClick={onExport} disabled={!turmaAtiva} className="btn-ghost">
                                <Download size={15} /> Exportar avaliação final
                            </button>
                            <div className="relative">
                                <button
                                    data-testid="user-menu-btn"
                                    onClick={() => setUserMenuOpen((v) => !v)}
                                    className="text-right hidden sm:flex items-center gap-2 px-2 py-1 rounded-md hover:bg-page transition-colors duration-200"
                                >
                                    <div>
                                        <div className="text-sm font-medium text-brand-charcoal">{user?.nome}</div>
                                        <div className="text-[11px] text-brand-sage">{user?.email}</div>
                                    </div>
                                    <ChevronDown size={14} className="text-brand-sage" />
                                </button>
                                {userMenuOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                                        <div className="absolute right-0 top-full mt-1 z-50 card-surface shadow-lg min-w-[220px] overflow-hidden" data-testid="user-menu">
                                            <button
                                                data-testid="menu-change-pw"
                                                onClick={() => { setUserMenuOpen(false); setShowChangePw(true); }}
                                                className="w-full text-left px-4 py-2.5 text-sm text-brand-charcoal hover:bg-page transition-colors duration-150 flex items-center gap-2"
                                            >
                                                <KeyRound size={14} /> Alterar palavra-passe
                                            </button>
                                            <button
                                                onClick={() => { setUserMenuOpen(false); logout(); }}
                                                className="w-full text-left px-4 py-2.5 text-sm text-[#9E3921] hover:bg-[#FDF0ED] transition-colors duration-150 flex items-center gap-2"
                                            >
                                                <LogOut size={14} /> Sair
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                            <button data-testid="logout-btn" onClick={logout} className="btn-ghost sm:hidden" title="Sair">
                                <LogOut size={15} />
                            </button>
                        </div>
                    </div>

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
                                    onClick={() => { setTab(t.id); setClassifyingInstId(null); }}
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
                {loadingData || loadingTurmas ? (
                    <div className="text-center text-brand-sage py-24">A carregar...</div>
                ) : (
                    <>
                        {tab === "dashboard" && <Dashboard turma={turmaAtiva} alunos={alunos} insts={insts} dominios={dominios} />}
                        {tab === "alunos" && <Turma alunos={alunos} addAluno={addAluno} delAluno={delAluno} addAlunosBulk={addAlunosBulk} />}
                        {tab === "instrumentos" && (
                            classifyingInstId ? (
                                <div className="anim-in">
                                    <div className="mb-4">
                                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-sage mb-1">Instrumentos de avaliação</div>
                                        <h2 className="font-serif text-xl text-brand-forest">Classificações</h2>
                                    </div>
                                    <LancarNotas
                                        alunos={alunos}
                                        insts={insts}
                                        dominios={dominios}
                                        saveNotas={saveNotas}
                                        focusedInstId={classifyingInstId}
                                        onBack={() => setClassifyingInstId(null)}
                                    />
                                </div>
                            ) : (
                                <Instrumentos
                                    turma={turmaAtiva}
                                    insts={insts}
                                    dominios={dominios}
                                    competencias={competencias}
                                    parametrosOD={parametrosOD}
                                    addInstrumento={addInstrumento}
                                    updateInstrumento={updateInstrumento}
                                    delInstrumento={delInstrumento}
                                    onClassify={(id) => setClassifyingInstId(id)}
                                    onExportRelatorio={(inst) => exportInstrumentoRelatorioPDF({ user, turma: turmaAtiva, alunos, instrumento: inst })}
                                />
                            )
                        )}
                        {tab === "config" && (
                            <Config
                                turma={turmaAtiva}
                                dominios={dominios}
                                competencias={competencias}
                                saveDominios={saveDominios}
                                saveAprendizagems={saveAprendizagems}
                                saveTurmaConfig={saveTurmaConfig}
                            />
                        )}
                    </>
                )}
            </main>

            {showTurmaModal && (
                <TurmaFormModal onClose={() => setShowTurmaModal(false)} onSubmit={createTurma} />
            )}

            {editTurmaModal && turmaAtiva && (
                <TurmaFormModal
                    initial={turmaAtiva}
                    onClose={() => setEditTurmaModal(false)}
                    onSubmit={editTurma}
                />
            )}

            {showChangePw && (
                <ChangePasswordModal onClose={() => setShowChangePw(false)} />
            )}
        </div>
    );
}

function SimpleHeader({ user, onLogout }) {
    return (
        <header className="bg-surface border-b border-crisp">
            <div className="max-w-6xl mx-auto px-6 sm:px-10 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-brand-forest flex items-center justify-center">
                        <span className="text-page font-serif text-xl">G</span>
                    </div>
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.25em] text-brand-sage">Bem-vindo(a)</div>
                        <div className="font-serif text-xl text-brand-forest">{user?.nome}</div>
                    </div>
                </div>
                <button data-testid="logout-btn" onClick={onLogout} className="btn-ghost">
                    <LogOut size={15} /> Sair
                </button>
            </div>
        </header>
    );
}
