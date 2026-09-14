import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // =========================================================
  // CHECK AUTHENTICATION
  // =========================================================

  const checkAuth = useCallback(async () => {
    if (!API_URL) {
      console.error(
        'VITE_API_URL is not configured.'
      );

      setUser(null);
      return false;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/auth/me`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
          },
          cache: 'no-store',
        }
      );

      // -----------------------------------------------------
      // NOT AUTHENTICATED
      // -----------------------------------------------------

      if (response.status === 401) {
        setUser(null);
        return false;
      }

      // -----------------------------------------------------
      // OTHER SERVER ERROR
      // -----------------------------------------------------

      if (!response.ok) {
        console.error(
          'Auth check returned:',
          response.status
        );

        setUser(null);
        return false;
      }

      // -----------------------------------------------------
      // RESPONSE
      // -----------------------------------------------------

      const data = await response.json();

      console.log(
        'SYNCO authentication response:',
        data
      );

      if (
        data &&
        data.authenticated === true &&
        data.user
      ) {
        setUser(data.user);
        return true;
      }

      setUser(null);
      return false;

    } catch (error) {
      console.error(
        'SYNCO authentication check failed:',
        error
      );

      setUser(null);
      return false;
    }
  }, []);

  // =========================================================
  // INITIAL AUTH CHECK
  // =========================================================

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        await checkAuth();
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, [checkAuth]);

  // =========================================================
  // LOGIN
  // =========================================================

  const login = (userData = null) => {
    if (userData) {
      setUser(userData);
    }
  };

  // =========================================================
  // LOGOUT
  // =========================================================

  const logout = async () => {
    try {
      if (API_URL) {
        await fetch(
          `${API_URL}/api/auth/logout`,
          {
            method: 'GET',
            credentials: 'include',
          }
        );
      }
    } catch (error) {
      console.error(
        'Logout request failed:',
        error
      );
    } finally {
      setUser(null);
    }
  };

  // =========================================================
  // DISCORD COMPATIBILITY
  // =========================================================

  const verifyWithDiscord = (discordData) => {
    setUser((previousUser) => ({
      ...(previousUser || {}),
      ...(discordData || {}),
    }));
  };

  // =========================================================
  // CONTEXT VALUE
  // =========================================================

  const value = {
    user,
    loading,
    checkAuth,
    login,
    logout,
    verifyWithDiscord,
    isAuthenticated: Boolean(user),
  };

  // =========================================================
  // PROVIDER
  // =========================================================

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// =========================================================
// HOOK
// =========================================================

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used inside an AuthProvider'
    );
  }

  return context;
};