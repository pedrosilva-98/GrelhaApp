import { createContext, useContext, useEffect, useState } from "react";
import api, { setToken, getToken } from "@/lib/api";

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
        setUser(false);
        window.location.href = "/login";
    }

    return (
        <AuthContext.Provider value={{ user, setUser, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
