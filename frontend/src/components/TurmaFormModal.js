import { useEffect, useState } from "react";
import { X, School } from "lucide-react";

export default function TurmaFormModal({ initial, onClose, onSubmit, title }) {
    const isEdit = !!initial;
    const [form, setForm] = useState({
        disciplina: initial?.disciplina || "",
        ano: initial?.ano || "",
        turma: initial?.turma || "",
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (initial) {
            setForm({
                disciplina: initial.disciplina || "",
                ano: initial.ano || "",
                turma: initial.turma || "",
            });
        }
    }, [initial]);

    async function submit(e) {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
            await onSubmit({
                disciplina: form.disciplina.trim(),
                ano: form.ano.trim(),
                turma: form.turma.trim(),
            });
        } catch (e) {
            setError(e?.response?.data?.detail || e.message || "Erro ao guardar.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="card-surface w-full max-w-lg p-8 anim-in" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.25em] text-brand-sage mb-1 flex items-center gap-2">
                            <School size={12} /> Turma
                        </div>
                        <h2 className="font-serif text-2xl text-brand-forest">{title || (isEdit ? "Editar turma" : "Nova turma")}</h2>
                    </div>
                    <button onClick={onClose} className="text-brand-sage hover:text-brand-charcoal">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={submit} className="space-y-4" data-testid="turma-form">
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-3">
                            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage block mb-1.5">Disciplina</label>
                            <input required data-testid="turma-disciplina" className="input-forest" value={form.disciplina} onChange={(e) => setForm((f) => ({ ...f, disciplina: e.target.value }))} placeholder="Ex: Matemática" />
                        </div>
                        <div className="col-span-2">
                            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage block mb-1.5">Ano</label>
                            <input required data-testid="turma-ano" className="input-forest" value={form.ano} onChange={(e) => setForm((f) => ({ ...f, ano: e.target.value }))} placeholder="6º" />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-sage block mb-1.5">Turma</label>
                            <input required data-testid="turma-letra" className="input-forest" value={form.turma} onChange={(e) => setForm((f) => ({ ...f, turma: e.target.value }))} placeholder="A" />
                        </div>
                    </div>
                    {error && <div className="text-sm text-[#9E3921] bg-[#FDF0ED] border border-[#F5C2B8] rounded-md px-3 py-2">{error}</div>}
                    <div className="flex gap-3 pt-3">
                        <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
                        <button type="submit" data-testid="turma-submit" disabled={busy} className="btn-primary flex-1 justify-center">
                            {busy ? "A guardar..." : (isEdit ? "Guardar alterações" : "Criar turma")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
