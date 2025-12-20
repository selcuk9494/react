'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import clsx from 'clsx';

export default function LoginPage() {
  const { login, register } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailErr, setEmailErr] = useState('');
  const [passErr, setPassErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailErr('');
    setPassErr('');
    const emailValid = /\S+@\S+\.\S+/.test(email);
    if (!emailValid) {
      setEmailErr('Geçerli bir e-posta girin');
      return;
    }
    if (!password || password.length < 4) {
      setPassErr('Şifre en az 4 karakter olmalı');
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || t('login_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {t('app_title')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {isLogin ? t('welcome_subtitle') : t('no_account')}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <input type="hidden" name="remember" value="true" />
          <div className="rounded-md shadow-sm space-y-3">
            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-gray-800 mb-1">
                {t('email')}
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={clsx(
                  "block w-full px-3 py-3 border rounded-md sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2",
                  emailErr ? "border-red-400 focus:ring-red-500 focus:border-red-500" : "border-gray-300 focus:ring-indigo-600 focus:border-indigo-600"
                )}
                placeholder=""
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {emailErr && <p className="mt-1 text-xs text-red-600">{emailErr}</p>}
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-800 mb-1">
                {t('password')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className={clsx(
                    "block w-full px-3 py-3 border rounded-md sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 pr-12",
                    passErr ? "border-red-400 focus:ring-red-500 focus:border-red-500" : "border-gray-300 focus:ring-indigo-600 focus:border-indigo-600"
                  )}
                  placeholder=""
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  {showPassword ? 'Gizle' : 'Göster'}
                </button>
              </div>
              {passErr && <p className="mt-1 text-xs text-red-600">{passErr}</p>}
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 disabled:opacity-50"
            >
              {loading ? '...' : isLogin ? t('login') : t('register')}
            </button>
          </div>
          
          <div className="text-center">
            <button
              type="button"
              className="text-sm text-indigo-600 hover:text-indigo-500"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? t('no_account') : t('login')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
