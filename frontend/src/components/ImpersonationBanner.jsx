import { ArrowLeft, Eye } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// Faixa mostrada quando o admin está dentro da conta de um professor.
export default function ImpersonationBanner() {
    const { user, voltarAoAdmin } = useAuth();
    if (!user?.impersonated_by) return null;
    return (
        <div className="bg-[#FEF5E6] border-b border-[#F7DBAA] text-brand-charcoal" data-testid="impersonation-banner">
            <div className="max-w-6xl mx-auto px-6 sm:px-10 py-2 flex items-center justify-between gap-3 flex-wrap text-sm">
                <span className="flex items-center gap-2">
                    <Eye size={14} className="text-[#8A5A19]" />
                    Está na conta de <strong>{user.nome}</strong> como administrador.
                </span>
                <button data-testid="voltar-admin-btn" onClick={voltarAoAdmin} className="btn-ghost !py-1 text-sm">
                    <ArrowLeft size={14} /> Voltar ao Admin
                </button>
            </div>
        </div>
    );
}
