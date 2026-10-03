import { createContext, useContext, useEffect, useState } from "react";
import api, { setToken, getToken, getAdminToken, setAdminToken } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null); // null = checking; false = anon; object = user
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const t = getToken();
        if (!t) {
            setUser(false);
            setLoading(false);
            return;
        }
        api.get("/auth/me")
            .then((r) => setUser(r.data))
            .catch(() => {
                setToken(null);
                setUser(false);
            })
            .finally(() => setLoading(false));
    }, []);

    async function login(email, password) {
        const { data } = await api.post("/auth/login", { email, password });
        setToken(data.access_token);
        setUser(data.user);
        return data.user;
    }

    function logout() {
        setToken(null);
        setAdminToken(null);
        setUser(false);
        window.location.href = "/login";
    }

    // Admin: entrar diretamente na conta de um professor.
    async function entrarComo(teacherId) {
        const { data } = await api.post(`/admin/teachers/${teacherId}/entrar`);
        setAdminToken(getToken());
        setToken(data.access_token);
        window.location.href = "/app";
    }

    // Sair da conta do professor e regressar à página do admin.
    function voltarAoAdmin() {
        const adminToken = getAdminToken();
        setAdminToken(null);
        if (!adminToken) return logout();
        setToken(adminToken);
        window.location.href = "/admin";
    }

    return (
        <AuthContext.Provider value={{ user, setUser, loading, login, logout, entrarComo, voltarAoAdmin }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
