import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config.js';
import AuthDialog from '../components/AuthDialog.jsx';

const storageKey = 'steam-review-session';
const storageAvailable = typeof window !== 'undefined';

const readStoredSession = () => {
  if (!storageAvailable) {
    return { token: null, user: null };
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return { token: null, user: null };
    }
    const parsed = JSON.parse(raw);
    return {
      token: parsed?.token ?? null,
      user: parsed?.user ?? null,
    };
  } catch (error) {
    console.warn('Não foi possível ler a sessão local:', error);
    return { token: null, user: null };
  }
};

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const storedSession = readStoredSession();
  const [token, setToken] = useState(storedSession.token);
  const [user, setUser] = useState(storedSession.user);
  const [favorites, setFavorites] = useState([]);
  const [dialogState, setDialogState] = useState({ open: false, mode: 'login' });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const persistSession = useCallback((nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
    if (storageAvailable) {
      window.localStorage.setItem(storageKey, JSON.stringify({ token: nextToken, user: nextUser }));
    }
  }, []);

  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
    setFavorites([]);
    if (storageAvailable) {
      window.localStorage.removeItem(storageKey);
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const authFetch = useCallback(async (url, options = {}) => {
    if (!token) {
      throw new Error('Usuário não autenticado.');
    }
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });
    if (response.status === 401) {
      clearSession();
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    return response;
  }, [token, clearSession]);

  const refreshFavorites = useCallback(async () => {
    if (!token) {
      setFavorites([]);
      return;
    }
    try {
      const response = await authFetch(`${API_BASE_URL}/user/favorites`);
      const data = await response.json();
      if (data.success) {
        setFavorites(data.favorites ?? []);
      }
    } catch (error) {
      console.error('Erro ao carregar favoritos:', error.message);
    }
  }, [token, authFetch]);

  useEffect(() => {
    refreshFavorites();
  }, [refreshFavorites]);

  const handleAuth = useCallback(async (endpoint, payload) => {
    try {
      setAuthLoading(true);
      setAuthError('');
      const response = await fetch(`${API_BASE_URL}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.error ?? 'Não foi possível autenticar.');
      }
      persistSession(data.token, data.user);
      setDialogState((prev) => ({ ...prev, open: false }));
      await refreshFavorites();
      return data;
    } catch (error) {
      setAuthError(error.message ?? 'Erro ao autenticar.');
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }, [persistSession, refreshFavorites]);

  const login = useCallback((payload) => handleAuth('login', payload), [handleAuth]);

  const register = useCallback((payload) => handleAuth('register', payload), [handleAuth]);

  const toggleFavorite = useCallback(async (appId) => {
    if (!token) {
      throw new Error('Faça login para salvar favoritos.');
    }
    const normalizedId = appId?.toString();
    const alreadyFavorite = favorites.some((fav) => fav.app_id?.toString() === normalizedId);
    const endpoint = alreadyFavorite
      ? `${API_BASE_URL}/user/favorites/${normalizedId}`
      : `${API_BASE_URL}/user/favorites`;
    const options = alreadyFavorite
      ? { method: 'DELETE' }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId: normalizedId }),
        };

    const response = await authFetch(endpoint, options);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error ?? 'Não foi possível atualizar o favorito.');
    }
    await refreshFavorites();
    return { favorite: !alreadyFavorite };
  }, [token, favorites, authFetch, refreshFavorites]);

  const isFavorite = useCallback((appId) => favorites.some((fav) => fav.app_id?.toString() === appId?.toString()), [favorites]);

  const requireAuth = useCallback(() => {
    if (token) {
      return true;
    }
    setAuthError('');
    setDialogState({ open: true, mode: 'login' });
    return false;
  }, [token]);

  const openAuthDialog = useCallback((mode = 'login') => {
    setAuthError('');
    setDialogState({ open: true, mode });
  }, []);

  const closeAuthDialog = useCallback(() => {
    setAuthError('');
    setDialogState((prev) => ({ ...prev, open: false }));
  }, []);

  const handleDialogSubmit = useCallback((mode, values) => {
    const payload = {
      email: values.email,
      password: values.password,
    };
    if (mode === 'register') {
      payload.displayName = values.displayName;
    }
    return mode === 'register' ? register(payload) : login(payload);
  }, [login, register]);

  const value = useMemo(() => ({
    user,
    token,
    favorites,
    login,
    register,
    logout,
    toggleFavorite,
    isFavorite,
    requireAuth,
    openAuthDialog,
    refreshFavorites,
  }), [user, token, favorites, login, register, logout, toggleFavorite, isFavorite, requireAuth, openAuthDialog, refreshFavorites]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthDialog
        open={dialogState.open}
        mode={dialogState.mode}
        loading={authLoading}
        error={authError}
        onClose={closeAuthDialog}
        onSubmit={handleDialogSubmit}
        onSwitch={() => setDialogState((prev) => ({ ...prev, mode: prev.mode === 'login' ? 'register' : 'login' }))}
      />
    </AuthContext.Provider>
  );
};
