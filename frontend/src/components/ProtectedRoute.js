import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ role, children }) {
    const { user, loading } = useAuth();
    if (loading || user === null) {
        return <div className="min-h-screen flex items-center justify-center text-brand-sage">A verificar sessão...</div>;
    }
    if (!user) return <Navigate to="/login" replace />;
    if (role && user.role !== role) {
        return <Navigate to={user.role === "admin" ? "/admin" : "/app"} replace />;
    }
    return children;
}
