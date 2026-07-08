import { useState } from "react";
import { Trash2, UserPlus } from "lucide-react";

export default function Turma({ alunos, addAluno, delAluno }) {
    const [nome, setNome] = useState("");
    async function submit(e) {
        e.preventDefault();
        if (!nome.trim()) return;
        await addAluno(nome.trim());
        setNome("");
    }
    return (
        <div className="space-y-6 anim-in" data-testid="turma-view">
            <div className="card-surface p-6">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-sage mb-1">Turma</div>
                <h2 className="font-serif text-xl text-brand-forest mb-4">Adicionar aluno</h2>
                <form onSubmit={submit} className="flex gap-3">
                    <input
                        data-testid="aluno-nome-input"
                        className="input-forest flex-1"
                        placeholder="Nome completo"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                    />
                    <button data-testid="add-aluno-btn" type="submit" className="btn-primary whitespace-nowrap">
                        <UserPlus size={16} /> Adicionar
                    </button>
                </form>
            </div>

            <div className="card-surface overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-page border-b border-crisp">
                        <tr className="text-left text-[11px] uppercase tracking-[0.15em] text-brand-sage">
                            <th className="px-5 py-2.5 font-semibold w-16">Nº</th>
                            <th className="px-5 py-2.5 font-semibold">Nome</th>
                            <th className="px-5 py-2.5 font-semibold w-16"></th>
                        </tr>
                    </thead>
                    <tbody data-testid="alunos-list">
                        {alunos.length === 0 ? (
                            <tr><td colSpan={3} className="px-5 py-12 text-center text-brand-sage">Nenhum aluno na turma. Adicione o primeiro acima.</td></tr>
                        ) : alunos.map((a, i) => (
                            <tr key={a.id} className={`border-b border-crisp last:border-0 row-hover ${i % 2 === 1 ? "bg-page/60" : ""}`}>
                                <td className="px-5 py-3 font-mono text-xs text-brand-sage tabular-nums">{String(i + 1).padStart(2, "0")}</td>
                                <td className="px-5 py-3 font-medium text-brand-charcoal">{a.nome}</td>
                                <td className="px-5 py-3 text-right">
                                    <button data-testid={`del-aluno-${a.id}`} onClick={() => delAluno(a.id)} className="btn-danger-ghost" title="Eliminar">
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
