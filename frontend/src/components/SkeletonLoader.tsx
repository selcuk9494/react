'use client';

import React from 'react';

interface SkeletonLoaderProps {
  type?: 'card' | 'list' | 'chart' | 'table';
  count?: number;
}

export default function SkeletonLoader({ type = 'card', count = 3 }: SkeletonLoaderProps) {
  if (type === 'card') {
    return (
      <div className="space-y-4 animate-pulse">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
              <div className="flex-1">
                <div className="h-5 bg-gray-200 rounded w-32 mb-2"></div>
                <div className="h-4 bg-gray-100 rounded w-24"></div>
              </div>
              <div className="h-8 bg-gray-200 rounded w-20"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'chart') {
    return (
      <div className="animate-pulse space-y-6">
        {/* Summary Card */}
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl p-8">
          <div className="h-6 bg-white/20 rounded w-40 mx-auto mb-4"></div>
          <div className="h-12 bg-white/20 rounded w-56 mx-auto mb-4"></div>
          <div className="h-4 bg-white/10 rounded w-32 mx-auto"></div>
        </div>

        {/* Chart */}
        <div className="bg-white rounded-3xl p-6 shadow-lg">
          <div className="h-6 bg-gray-200 rounded w-32 mb-6"></div>
          <div className="h-64 bg-gray-100 rounded-2xl flex items-end justify-around gap-2 p-4">
            {[60, 80, 70, 90, 75, 85, 65].map((h, i) => (
              <div key={i} className="bg-gray-200 rounded-t" style={{ height: `${h}%`, width: '12%' }}></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-100 rounded w-1/2"></div>
              </div>
              <div className="h-6 bg-gray-200 rounded w-16"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden animate-pulse">
        <div className="p-4 border-b border-gray-100">
          <div className="h-5 bg-gray-200 rounded w-40"></div>
        </div>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="p-4 border-b border-gray-50 flex items-center gap-4">
            <div className="w-8 h-8 bg-gray-200 rounded"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-100 rounded w-1/2"></div>
            </div>
            <div className="h-4 bg-gray-200 rounded w-20"></div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
