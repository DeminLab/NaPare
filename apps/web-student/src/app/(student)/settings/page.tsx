'use client';

import { useState } from 'react';
import { Card, Button, Input } from '@/components/ui';

export default function SettingsPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="ds-page-title text-slate-900">Настройки</h1>

      <Card>
        <h3 className="mb-4 font-bold text-slate-900">Профиль</h3>
        <div className="space-y-4">
          <Input label="Имя" value={name} onChange={e => setName(e.target.value)} placeholder="Ваше имя" />
          <Input label="Телефон" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (999) 123-45-67" />
          <Button onClick={handleSave}>
            {saved ? '✓ Сохранено' : 'Сохранить'}
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 font-bold text-slate-900">Уведомления</h3>
        <div className="space-y-3">
          {[
            { label: 'Изменения расписания', default: true },
            { label: 'Новые объявления', default: true },
            { label: 'Домашние задания', default: true },
            { label: 'Пропуски', default: true },
          ].map((item) => (
            <label key={item.label} className="flex items-center justify-between rounded-xl px-4 py-3 hover:bg-slate-50 cursor-pointer">
              <span className="text-sm font-medium text-slate-700">{item.label}</span>
              <input type="checkbox" defaultChecked={item.default} className="h-5 w-5 rounded-lg border-slate-300 text-indigo-500 focus:ring-indigo-500" />
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 font-bold text-slate-900">О приложении</h3>
        <div className="space-y-2 text-sm text-slate-600">
          <p>Версия: 1.0.0</p>
          <p>© 2026 НаПаре</p>
        </div>
      </Card>
    </div>
  );
}
