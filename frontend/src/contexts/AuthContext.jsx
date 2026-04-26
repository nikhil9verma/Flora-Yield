import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const api = axios.create({ baseURL: '/api' });

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('flora_token') || null);
  const [loading, setLoading] = useState(true);

  // Inject token into every request
  useEffect(() => {
    const id = api.interceptors.request.use((config) => {
      const t = localStorage.getItem('flora_token');
      if (t) config.headers['Authorization'] = `Bearer ${t}`;
      return config;
    });
    return () => api.interceptors.request.eject(id);
  }, []);

  // Auto-refresh on 401 with refresh token
  useEffect(() => {
    const id = api.interceptors.response.use(
      (r) => r,
      async (err) => {
        const orig = err.config;
        if (err.response?.status === 401 && !orig._retry) {
          orig._retry = true;
          try {
            const rt = localStorage.getItem('flora_refresh');
            const { data } = await axios.post('/api/auth/refresh', { refreshToken: rt });
            const newToken = data.data.accessToken;
            localStorage.setItem('flora_token', newToken);
            setToken(newToken);
            orig.headers['Authorization'] = `Bearer ${newToken}`;
            return api(orig);
          } catch {
            logout();
          }
        }
        return Promise.reject(err);
      }
    );
    return () => api.interceptors.response.eject(id);
  }, []);

  // Rehydrate user on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('flora_token');
    if (!storedToken) { setLoading(false); return; }
    api.get('/auth/me')
      .then(({ data }) => setUser(data.data))
      .catch(() => { localStorage.removeItem('flora_token'); localStorage.removeItem('flora_refresh'); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    const { user: u, accessToken, refreshToken } = data.data;
    localStorage.setItem('flora_token', accessToken);
    localStorage.setItem('flora_refresh', refreshToken);
    setToken(accessToken);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    const { user: u, accessToken, refreshToken } = data.data;
    localStorage.setItem('flora_token', accessToken);
    localStorage.setItem('flora_refresh', refreshToken);
    setToken(accessToken);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    localStorage.removeItem('flora_token');
    localStorage.removeItem('flora_refresh');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
