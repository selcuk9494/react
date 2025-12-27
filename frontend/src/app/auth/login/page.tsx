'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import clsx from 'clsx';
import { Eye, EyeOff, Mail, Lock, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login, register } = useAuth();
  const { t, lang, setLang } = useI18n();
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
      setEmailErr(lang === 'tr' ? 'Geçerli bir e-posta girin' : 'Enter a valid email');
      return;
    }
    if (!password || password.length < 4) {
      setPassErr(lang === 'tr' ? 'Şifre en az 4 karakter olmalı' : 'Password must be at least 4 characters');
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-emerald-200 to-teal-200 rounded-full blur-3xl opacity-30 -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-200 to-indigo-200 rounded-full blur-3xl opacity-30 translate-x-1/2 translate-y-1/2"></div>
      
      {/* Language Toggle */}
      <button 
        onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')}
        className="absolute top-4 right-4 text-sm font-bold text-gray-500 bg-white/80 backdrop-blur-sm px-3 py-2 rounded-xl hover:bg-white transition-all shadow-sm border border-gray-200"
      >
        {lang === 'tr' ? '🇹🇷 TR' : '🇬🇧 EN'}
      </button>

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/40 mb-6">
            <span className="text-white font-black text-3xl">FR</span>
          </div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">
            {t('app_title')}
          </h2>
          <p className="mt-2 text-sm text-gray-500 font-medium">
            {isLogin ? t('welcome_subtitle') : (lang === 'tr' ? 'Yeni hesap oluşturun' : 'Create a new account')}
          </p>
        </div>

        {/* Login Form */}
        <form className="mt-8 space-y-5 bg-white/70 backdrop-blur-xl p-8 rounded-3xl shadow-xl border border-white/50" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Email Field */}
            <div>
              <label htmlFor="email-address" className="block text-sm font-semibold text-gray-700 mb-2">
                {t('email')}
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={clsx(
                    "block w-full pl-11 pr-4 py-3.5 border-2 rounded-2xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none transition-all duration-200",
                    emailErr 
                      ? "border-red-300 focus:ring-4 focus:ring-red-100 focus:border-red-400 bg-red-50/50" 
                      : "border-gray-200 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 bg-gray-50/50"
                  )}
                  placeholder={lang === 'tr' ? 'ornek@email.com' : 'example@email.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {emailErr && <p className="mt-2 text-xs text-red-600 font-medium flex items-center gap-1"><span>⚠️</span>{emailErr}</p>}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                {t('password')}
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className={clsx(
                    "block w-full pl-11 pr-14 py-3.5 border-2 rounded-2xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none transition-all duration-200",
                    passErr 
                      ? "border-red-300 focus:ring-4 focus:ring-red-100 focus:border-red-400 bg-red-50/50" 
                      : "border-gray-200 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 bg-gray-50/50"
                  )}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-all"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {passErr && <p className="mt-2 text-xs text-red-600 font-medium flex items-center gap-1"><span>⚠️</span>{passErr}</p>}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
              <p className="text-sm font-medium text-red-700 flex items-center gap-2">
                <span>❌</span>{error}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-4 px-6 border-0 text-base font-bold rounded-2xl text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transform hover:-translate-y-0.5"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{lang === 'tr' ? 'Giriş yapılıyor...' : 'Logging in...'}</span>
              </>
            ) : (
              isLogin ? t('login') : t('register')
            )}
          </button>
          
          {/* Toggle Login/Register */}
          <div className="text-center pt-2">
            <button
              type="button"
              className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? t('no_account') : (lang === 'tr' ? 'Zaten hesabınız var mı? Giriş yapın' : 'Already have an account? Sign in')}
            </button>
          </div>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 font-medium">
          © 2024 FR Reports. {lang === 'tr' ? 'Tüm hakları saklıdır.' : 'All rights reserved.'}
        </p>
      </div>
    </div>
  );
}
