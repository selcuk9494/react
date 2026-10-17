'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/utils/api';
const dispatchStart = () => typeof window !== 'undefined' && window.dispatchEvent(new CustomEvent('app:transition:start'));
const dispatchEnd = () => typeof window !== 'undefined' && window.dispatchEvent(new CustomEvent('app:transition:end'));

interface User {
  id: string;
  email: string;
  selected_branch?: number;
  selected_branch_id?: number;
  branches?: any[];
  days_left?: number;
  expiry_date?: string;
  is_admin?: boolean;
  allowed_reports?: string[] | null;
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
  const lastUserFetchRef = useRef(0);
  const branchSwitchUntilRef = useRef(0);
  const selectedBranchRef = useRef<{ index: number; id?: number } | null>(null);

  useEffect(() => {
    const getCookieToken = () => {
      if (typeof document === 'undefined') return null;
      const match = document.cookie.match(/(?:^|; )token=([^;]*)/);
      return match ? decodeURIComponent(match[1]) : null;
    };

    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      fetchUser(storedToken);
      return;
    }

    const cookieToken = getCookieToken();
    if (cookieToken) {
      setToken(cookieToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${cookieToken}`;
      fetchUser(cookieToken);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async (authToken: string) => {
    try {
      const res = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      // Sube gecisi sirasinda /me eski selected_branch ile geri basmasin
      if (Date.now() < branchSwitchUntilRef.current && selectedBranchRef.current) {
        const { index, id } = selectedBranchRef.current;
        setUser({
          ...res.data,
          selected_branch: index,
          selected_branch_id: id ?? res.data?.branches?.[index]?.id,
        });
      } else {
        setUser(res.data);
      }
    } catch (e) {
      console.error('Failed to fetch user', e);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;

    const maybeRefresh = async () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastUserFetchRef.current < 15000) return;
      lastUserFetchRef.current = now;
      await fetchUser(token);
    };

    const onFocus = () => {
      maybeRefresh();
    };
    const onVis = () => {
      maybeRefresh();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    const intervalId = window.setInterval(() => {
      maybeRefresh();
    }, 30000);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(intervalId);
    };
  }, [token]);

  const login = async (email: string, pass: string) => {
    dispatchStart();
    try {
      const params = new URLSearchParams();
      params.append('email', email);
      params.append('password', pass);

      const res = await axios.post(`${API_URL}/auth/login`, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      const { access_token, user } = res.data;
      setToken(access_token);
      localStorage.setItem('token', access_token);
      document.cookie = `token=${access_token}; path=/; max-age=${30 * 24 * 60 * 60}`;
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      await fetchUser(access_token);
      // Once dashboard'a gec — prefetch + tum subeleri arka planda isit
      router.push('/dashboard');
      const branchIdx =
        typeof user?.selected_branch === 'number'
          ? user.selected_branch
          : typeof res.data?.user?.selected_branch === 'number'
            ? res.data.user.selected_branch
            : 0;
      const authHdr = { Authorization: `Bearer ${access_token}` };
      void axios
        .get(`${API_URL}/dashboard?period=today&fast=1`, {
          headers: authHdr,
          timeout: 20000,
        })
        .then((dash) => {
          if (dash.data && !dash.data.connection_error) {
            try {
              window.localStorage.setItem(
                `dashboard_snap_v1_${branchIdx}_today__`,
                JSON.stringify(dash.data),
              );
              window.localStorage.setItem(
                `dashboard_snap_v1_0_today__`,
                JSON.stringify(dash.data),
              );
            } catch {}
          }
        })
        .catch(() => {});
      void axios
        .post(`${API_URL}/dashboard/warm-mine`, {}, { headers: authHdr, timeout: 5000 })
        .catch(() => {});
    } catch (e) {
      throw e;
    } finally {
      dispatchEnd();
    }
  };

  const register = async (email: string, pass: string) => {
    dispatchStart();
    try {
      const params = new URLSearchParams();
      params.append('email', email);
      params.append('password', pass);

      const res = await axios.post(`${API_URL}/auth/register`, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      const { access_token, user } = res.data;
      setToken(access_token);
      localStorage.setItem('token', access_token);
      document.cookie = `token=${access_token}; path=/; max-age=${30 * 24 * 60 * 60}`;
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      await fetchUser(access_token);
      router.push('/dashboard');
    } catch (e) {
      throw e;
    } finally {
      dispatchEnd();
    }
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
    if (user.selected_branch === index) return;
    const prev = user;
    const selected_branch_id = user.branches?.[index]?.id;
    selectedBranchRef.current = { index, id: selected_branch_id };
    branchSwitchUntilRef.current = Date.now() + 8000;
    // Aninda UI — POST arka planda, /me yarisi ezmesin
    setUser({
      ...user,
      selected_branch: index,
      selected_branch_id,
    });
    try {
      const res = await axios.post(`${API_URL}/auth/select-branch`, { index });
      const id = res.data?.selected_branch_id ?? selected_branch_id;
      selectedBranchRef.current = { index, id };
      setUser((u) =>
        u
          ? {
              ...u,
              selected_branch: index,
              selected_branch_id: id,
            }
          : u,
      );
    } catch (e) {
      console.error('Failed to select branch', e);
      selectedBranchRef.current = {
        index: prev.selected_branch ?? 0,
        id: prev.selected_branch_id,
      };
      setUser(prev);
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
