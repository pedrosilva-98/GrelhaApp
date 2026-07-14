import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import Admin from "@/pages/Admin";
import Teacher from "@/pages/Teacher";

function RootRedirect() {
    const { user, loading } = useAuth();
    if (loading || user === null) return <div className="min-h-screen flex items-center justify-center text-brand-sage">A carregar...</div>;
    if (!user) return <Navigate to="/login" replace />;
    return <Navigate to={user.role === "admin" ? "/admin" : "/app"} replace />;
}

export default function App() {
    // Persist the browser title against any external overrides.
    useEffect(() => {
        const desired = "Caderno · Avaliação Docente";
        document.title = desired;
        const id = setInterval(() => { if (document.title !== desired) document.title = desired; }, 1000);
        return () => clearInterval(id);
    }, []);
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<RootRedirect />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/admin" element={<ProtectedRoute role="admin"><Admin /></ProtectedRoute>} />
                    <Route path="/app" element={<ProtectedRoute role="teacher"><Teacher /></ProtectedRoute>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}
