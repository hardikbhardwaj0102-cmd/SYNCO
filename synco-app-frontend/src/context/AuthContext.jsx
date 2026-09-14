import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

const API_URL = 'http://127.0.0.1:5000';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        setUser(null);
        return false;
      }

      const data = await response.json();

      console.log('Auth response:', data);

      if (data.authenticated) {
        setUser(data.user);
        return true;
      }

      setUser(null);
      return false;

    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      return false;
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      await checkAuth();
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = (userData = null) => {
    // Kept for compatibility with existing frontend components.
    // Real OAuth login is handled by Flask.
    if (userData) {
      setUser(userData);
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'GET',
        credentials: 'include',
      });

      setUser(null);

    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const verifyWithDiscord = (discordData) => {
    setUser((prev) => ({
      ...prev,
      ...discordData,
    }));
  };

  const value = {
    user,
    loading,
    checkAuth,
    login,
    logout,
    verifyWithDiscord,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};