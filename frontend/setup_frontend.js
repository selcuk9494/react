const fs = require('fs');
const path = require('path');

const files = {
  'src/lib/api.ts': `import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = \`Bearer \${token}\`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;`,

  'src/lib/utils.ts': `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}`,

  'src/store/authStore.ts': `import { create } from 'zustand';
import api from '@/lib/api';

interface Branch {
  name: string;
  kasa_no?: number;
}

interface User {
  id: string;
  email: string;
  branches: Branch[];
  selected_branch: number;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: any) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  selectBranch: (index: number) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (credentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      const { access_token, user } = response.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, isAuthenticated: true });
    } catch (error) {
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    const token = localStorage.getItem('token');
    if (!token) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const response = await api.get('/auth/me');
      set({ user: response.data, isAuthenticated: true });
    } catch (error) {
      set({ user: null, isAuthenticated: false });
      localStorage.removeItem('token');
    } finally {
      set({ isLoading: false });
    }
  },

  selectBranch: async (index: number) => {
    try {
      await api.post('/auth/select-branch', { branch_index: index });
      const { user } = get();
      if (user) {
        set({ user: { ...user, selected_branch: index } });
      }
      window.location.reload(); 
    } catch (error) {
      console.error('Failed to select branch', error);
      throw error;
    }
  },
}));`,

  'src/components/layout/Sidebar.tsx': `'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ShoppingBag, Package, BarChart2, CreditCard, XCircle, Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Ürün Satış', href: '/dashboard/product-sales', icon: ShoppingBag },
  { name: 'Ödeme Tipleri', href: '/dashboard/payment-types', icon: CreditCard },
  { name: 'İptal, İade ve İkram', href: '/dashboard/cancelled-items', icon: XCircle },
  { name: 'Performans', href: '/dashboard/performance', icon: BarChart2 },
  { name: 'Ayarlar', href: '/dashboard/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="flex flex-col w-64 bg-gray-900 h-screen text-white fixed left-0 top-0 overflow-y-auto">
      <div className="flex items-center justify-center h-16 border-b border-gray-800">
        <h1 className="text-xl font-bold">Rapor Paneli</h1>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center px-4 py-2 text-sm font-medium rounded-md group transition-colors",
                isActive
                  ? "bg-gray-800 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              )}
            >
              <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={() => {
            logout();
            window.location.href = '/login';
          }}
          className="flex items-center w-full px-4 py-2 text-sm font-medium text-red-400 rounded-md hover:bg-gray-800 hover:text-red-300 transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Çıkış Yap
        </button>
      </div>
    </div>
  );
}`,

  'src/components/layout/Header.tsx': `'use client';

import { useAuthStore } from '@/store/authStore';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function Header() {
  const { user, selectBranch } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  const currentBranch = user.branches[user.selected_branch]?.name || 'Şube Seçiniz';

  return (
    <header className="bg-white shadow-sm h-16 flex items-center justify-between px-6 fixed top-0 right-0 left-64 z-10">
      <div className="flex items-center">
        <h2 className="text-xl font-semibold text-gray-800">Hoşgeldiniz, {user.email}</h2>
      </div>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 bg-gray-100 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors focus:outline-none"
        >
          <span className="font-medium text-gray-700">{currentBranch}</span>
          <ChevronDown className="h-4 w-4 text-gray-500" />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 border border-gray-200 z-20">
            {user.branches.map((branch, index) => (
              <button
                key={index}
                onClick={() => {
                  selectBranch(index);
                  setIsOpen(false);
                }}
                className={cn(
                  "block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100",
                  user.selected_branch === index && "bg-blue-50 text-blue-700 font-medium"
                )}
              >
                {branch.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}`,

  'src/components/ui/StatCard.tsx': `import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  className?: string;
  iconClassName?: string;
}

export default function StatCard({ title, value, icon: Icon, description, className, iconClassName }: StatCardProps) {
  return (
    <div className={cn("bg-white overflow-hidden shadow rounded-lg", className)}>
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Icon className={cn("h-6 w-6 text-gray-400", iconClassName)} aria-hidden="true" />
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd>
                <div className="text-lg font-medium text-gray-900">{value}</div>
                {description && <div className="text-xs text-gray-500 mt-1">{description}</div>}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}`,

  'src/app/login/page.tsx': `'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email, password });
      router.push('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">Giriş Yap</h2>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Şifre</label>
            <input
              type="password"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={cn(
              "w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
              loading && "opacity-50 cursor-not-allowed"
            )}
          >
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
}`,

  'src/app/dashboard/layout.tsx': `'use client';

import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { useAuthStore } from '@/store/authStore';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { checkAuth, isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>;
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <Header />
      <main className="ml-64 pt-16 p-6">
        {children}
      </main>
    </div>
  );
}`,

  'src/app/dashboard/page.tsx': \`'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import StatCard from '@/components/ui/StatCard';
import { CreditCard, ShoppingBag, XCircle, Clock } from 'lucide-react';

interface DashboardData {
  acik_adisyon_toplam: number;
  kapali_adisyon_toplam: number;
  kapali_iskonto_toplam: number;
  iptal_toplam: number;
  acik_adisyon_adet: number;
  kapali_adisyon_adet: number;
  iptal_adet: number;
  dagilim: any;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get(\`/dashboard?period=\${period}\`);
        setData(res.data);
      } catch (error) {
        console.error('Failed to fetch dashboard data', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [period]);

  if (loading) return <div>Yükleniyor...</div>;
  if (!data) return <div>Veri bulunamadı.</div>;

  const totalSales = data.acik_adisyon_toplam + data.kapali_adisyon_toplam;
  const totalOrders = data.acik_adisyon_adet + data.kapali_adisyon_adet;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Genel Bakış</h2>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="bg-white border border-gray-300 rounded-md shadow-sm px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <option value="today">Bugün</option>
          <option value="yesterday">Dün</option>
          <option value="week">Bu Hafta</option>
          <option value="month">Bu Ay</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Toplam Ciro"
          value={\`₺\${totalSales.toFixed(2)}\`}
          icon={CreditCard}
          description={\`\${data.kapali_adisyon_toplam.toFixed(2)} Kapalı / \${data.acik_adisyon_toplam.toFixed(2)} Açık\`}
          iconClassName="text-green-500"
        />
        <StatCard
          title="Toplam Sipariş"
          value={totalOrders}
          icon={ShoppingBag}
          description={\`\${data.kapali_adisyon_adet} Kapalı / \${data.acik_adisyon_adet} Açık\`}
          iconClassName="text-blue-500"
        />
        <StatCard
          title="Toplam İskonto"
          value={\`₺\${data.kapali_iskonto_toplam.toFixed(2)}\`}
          icon={Clock} 
          iconClassName="text-yellow-500"
        />
        <StatCard
          title="İptal Tutarı"
          value={\`₺\${data.iptal_toplam.toFixed(2)}\`}
          icon={XCircle}
          description={\`\${data.iptal_adet} Adet İptal\`}
          iconClassName="text-red-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Satış Dağılımı</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-gray-600">Paket Servis</span>
              <span className="font-semibold">₺{data.dagilim.paket.toplam_tutar.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-gray-600">Adisyon (Masa)</span>
              <span className="font-semibold">₺{data.dagilim.adisyon.toplam_tutar.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}\`,

  'src/app/layout.tsx': \`import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Rapor Paneli",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}\`
};

for (const [filePath, content] of Object.entries(files)) {
  const fullPath = path.join(__dirname, filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content);
  console.log('Wrote ' + filePath);
}
