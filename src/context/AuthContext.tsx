import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabase';
import Cookies from 'js-cookie';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => false,
  logout: () => {},
  isAuthenticated: false,
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // First check if we have a session in cookies
        const storedUser = Cookies.get('user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setIsAuthenticated(true);
        }

        // Then get the current session from Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session retrieval error:', error);
          Cookies.remove('user', { path: '/' });
          setUser(null);
          setIsAuthenticated(false);
          return;
        }

        if (session?.user) {
          const userData: User = {
            id: session.user.id,
            email: session.user.email || '',
            token: session.access_token
          };
          setUser(userData);
          setIsAuthenticated(true);
          
          // Update cookies with fresh session data
          Cookies.set('user', JSON.stringify(userData), { 
            expires: 30,
            secure: true,
            sameSite: 'strict',
            path: '/'
          });
        } else {
          // No valid session found
          Cookies.remove('user', { path: '/' });
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Failed to restore auth state:', error);
        Cookies.remove('user', { path: '/' });
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      if (event === 'SIGNED_OUT') {
        Cookies.remove('user', { path: '/' });
        setUser(null);
        setIsAuthenticated(false);
        return;
      }

      if (session?.user) {
        const userData: User = {
          id: session.user.id,
          email: session.user.email || '',
          token: session.access_token
        };
        setUser(userData);
        setIsAuthenticated(true);
        
        // Update cookies on session change
        Cookies.set('user', JSON.stringify(userData), { 
          expires: 30,
          secure: true,
          sameSite: 'strict',
          path: '/'
        });
      } else {
        Cookies.remove('user', { path: '/' });
        setUser(null);
        setIsAuthenticated(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // First try to sign in with Supabase auth
      const { data: { session }, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        console.error('Supabase auth error:', authError);
        throw new Error(authError.message);
      }

      if (!session?.user) {
        throw new Error('No user session after login');
      }

      // If successful, create user data
      const userData: User = {
        id: session.user.id,
        email: session.user.email || '',
        token: session.access_token
      };
      
      setUser(userData);
      setIsAuthenticated(true);
      
      // Set cookies with proper options
      Cookies.set('user', JSON.stringify(userData), { 
        expires: 30,
        secure: true,
        sameSite: 'strict',
        path: '/'
      });
      
      return true;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      Cookies.remove('user', { path: '/' });
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};