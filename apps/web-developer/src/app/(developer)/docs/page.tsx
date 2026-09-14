'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';

export default function DocsPage() {
  const [loading, setLoading] = useState(true);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Документация API</h1>
          <p className="mt-1 text-sm text-slate-500">
            Swagger UI — полное описание всех эндпоинтов
          </p>
        </div>

        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
              </div>
              <span className="text-xs font-medium text-slate-400 font-mono">/api/v1/docs</span>
            </div>
            <a
              href="/api/v1/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Открыть в новой вкладке
            </a>
          </div>
          <div className="relative min-h-[600px]">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Загрузка Swagger UI...
                </div>
              </div>
            )}
            <iframe
              src="/api/v1/docs"
              className="h-[800px] w-full border-0"
              title="Swagger API Documentation"
              onLoad={() => setLoading(false)}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
