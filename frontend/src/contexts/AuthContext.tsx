'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/utils/api';
const dispatchStart = () => typeof window !== 'undefined' && window.dispatchEvent(new CustomEvent('app:transition:start'));
const dispatchEnd = () => typeof window !== 'undefined' && window.dispatchEvent(new CustomEvent('app:transition:end'));

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
    dispatchStart();
    const res = await axios.post(`${API_URL}/auth/login`, { email, password: pass });
    const { access_token, user } = res.data;
    setToken(access_token);
    localStorage.setItem('token', access_token);
    document.cookie = `token=${access_token}; path=/; max-age=${30 * 24 * 60 * 60}`;
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    await fetchUser(access_token);
    router.push('/dashboard');
    dispatchEnd();
  };

  const register = async (email: string, pass: string) => {
    dispatchStart();
    const res = await axios.post(`${API_URL}/auth/register`, { email, password: pass });
    const { access_token, user } = res.data;
    setToken(access_token);
    localStorage.setItem('token', access_token);
    document.cookie = `token=${access_token}; path=/; max-age=${30 * 24 * 60 * 60}`;
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    await fetchUser(access_token);
    router.push('/dashboard');
    dispatchEnd();
  };

  const logout = async () => {
    dispatchStart();
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    document.cookie = `token=; path=/; max-age=0`;
    delete axios.defaults.headers.common['Authorization'];
    router.push('/auth/login');
    dispatchEnd();
  };

  const selectBranch = async (index: number) => {
    if (!user) return;
    try {
      dispatchStart();
      await axios.post(`${API_URL}/auth/select-branch`, { index });
      const updatedUser = { ...user, selected_branch: index };
      setUser(updatedUser);
      if (token) {
        await fetchUser(token);
      }
      dispatchEnd();
    } catch (e) {
      console.error('Failed to select branch', e);
      dispatchEnd();
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
