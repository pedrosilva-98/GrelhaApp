import { School, Plus } from "lucide-react";

export default function TurmasEmpty({ onCreate }) {
    return (
        <div className="min-h-[calc(100vh-160px)] flex items-center justify-center px-6 anim-in">
            <div className="max-w-lg text-center">
                <div className="w-16 h-16 rounded-full bg-brand-forest/10 text-brand-forest flex items-center justify-center mx-auto mb-6">
                    <School size={28} />
                </div>
                <div className="text-[11px] uppercase tracking-[0.25em] text-brand-sage mb-2">Comece por aqui</div>
                <h1 className="font-serif text-3xl text-brand-forest mb-3">Crie a sua primeira turma</h1>
                <p className="text-brand-charcoal/70 mb-8 leading-relaxed">
                    Cada turma tem os seus próprios alunos, instrumentos de avaliação e domínios. Pode ter várias turmas — basta selecioná-las no topo da página.
                </p>
                <button data-testid="empty-create-turma-btn" onClick={onCreate} className="btn-primary">
                    <Plus size={16} /> Criar turma
                </button>
            </div>
        </div>
    );
}
