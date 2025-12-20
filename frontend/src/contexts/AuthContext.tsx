'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/utils/api';

interface User {
  id: string;
  email: string;
  selected_branch?: number;
  branches?: any[];
  days_left?: number;
  expiry_date?: string;
  is_admin?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  selectBranch: (index: number) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check local storage on mount
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      fetchUser(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async (authToken: string) => {
    try {
      const res = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setUser(res.data);
    } catch (e) {
      console.error('Failed to fetch user', e);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, pass: string) => {
    const res = await axios.post(`${API_URL}/auth/login`, { email, password: pass });
    const { access_token, user } = res.data;
    setToken(access_token);
    setUser(user);
    localStorage.setItem('token', access_token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    router.push('/dashboard');
  };

  const register = async (email: string, pass: string) => {
    const res = await axios.post(`${API_URL}/auth/register`, { email, password: pass });
    const { access_token, user } = res.data;
    setToken(access_token);
    setUser(user);
    localStorage.setItem('token', access_token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    router.push('/dashboard');
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    router.push('/auth/login');
  };

  const selectBranch = async (index: number) => {
    if (!user) return;
    try {
      await axios.post(`${API_URL}/auth/select-branch`, { index });
      const updatedUser = { ...user, selected_branch: index };
      setUser(updatedUser);
      // Reload page to refresh data with new branch context
      window.location.reload();
    } catch (e) {
      console.error('Failed to select branch', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, selectBranch, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
