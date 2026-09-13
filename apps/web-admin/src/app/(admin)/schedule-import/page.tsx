'use client';

import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export default function ScheduleImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await apiFetch<{ success: boolean; message: string }>('/admin/schedule/upload', {
        method: 'POST',
        body: formData,
        headers: {},
      });
      setUploadResult(result);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Импорт расписания</h1>
        <p className="mt-1 text-sm text-slate-500">Загрузка расписания из файла</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {uploadResult && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${
          uploadResult.success
            ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
            : 'border-red-200 bg-red-50 text-red-600'
        }`}>
          {uploadResult.message}
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
          dragOver
            ? 'border-sky-400 bg-sky-50'
            : file
              ? 'border-emerald-300 bg-emerald-50'
              : 'border-slate-300 bg-white hover:border-slate-400'
        }`}
      >
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        <div className="flex flex-col items-center">
          {file ? (
            <>
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-900">{file.name}</p>
              <p className="mt-1 text-xs text-slate-400">{(file.size / 1024).toFixed(1)} КБ</p>
            </>
          ) : (
            <>
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-900">
                Перетащите файл сюда
              </p>
              <p className="mt-1 text-xs text-slate-400">
                или нажмите для выбора файла
              </p>
              <p className="mt-3 text-xs text-slate-400">
                Поддерживаются форматы .xlsx, .xls, .csv
              </p>
            </>
          )}
        </div>
      </div>

      {file && (
        <div className="flex justify-end">
          <Button onClick={handleUpload} loading={uploading}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Загрузить
          </Button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-slate-900">Статус синхронизации</h2>
        <SyncStatus />
      </div>
    </div>
  );
}

function SyncStatus() {
  const [status, setStatus] = useState<{ lastSync?: string; inProgress?: boolean } | null>(null);

  useState(() => {
    apiFetch<{ lastSync?: string; inProgress?: boolean }>('/admin/schedule/sync-status')
      .then(setStatus)
      .catch(() => {});
  });

  if (!status) {
    return <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />;
  }

  return (
    <div className="flex items-center gap-3">
      <div className={`h-2.5 w-2.5 rounded-full ${status.inProgress ? 'animate-pulse bg-amber-400' : 'bg-emerald-400'}`} />
      <span className="text-sm text-slate-600">
        {status.inProgress
          ? 'Синхронизация...'
          : status.lastSync
            ? `Последняя синхронизация: ${new Date(status.lastSync).toLocaleString('ru-RU')}`
            : 'Синхронизация ещё не выполнялась'}
      </span>
    </div>
  );
}
