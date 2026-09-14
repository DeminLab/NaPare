'use client';

import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { getToken } from '@/lib/api';

interface SessionRecord {
  device: string;
  ip: string;
  location: string;
  created: string;
  activity: string;
  status: 'Active' | 'Expired' | 'Revoked';
  current?: boolean;
}

function Status({ value }: { value: SessionRecord['status'] }) {
  const styles = {
    Active: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    Expired: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
    Revoked: 'border-red-400/20 bg-red-400/10 text-red-300',
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${styles[value]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{value}</span>;
}

export default function SessionPage() {
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const token = getToken();
    const userAgent = navigator.userAgent;
    const device = userAgent.includes('Edg') ? 'Microsoft Edge' : userAgent.includes('Chrome') ? 'Google Chrome' : userAgent.includes('Firefox') ? 'Firefox' : 'Current browser';
    setSession(token ? { device, ip: 'Unavailable', location: 'Local browser', created: 'Unavailable', activity: new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()), status: 'Active', current: true } : null);
  }, []);

  const announceUnavailable = (action: string) => setNotice(`${action} недоступно: backend не предоставляет endpoint управления сессиями.`);

  return <div className="min-h-full bg-[#0b0e14] px-4 py-6 text-white sm:px-6 lg:px-8 lg:py-8"><div className="mx-auto max-w-7xl space-y-7">
    <div className="flex items-center gap-2 text-xs text-white/40">Developer <span>/</span> <span className="text-white/80">Sessions</span></div>
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Sessions</h1><p className="mt-1 text-sm text-white/45">Manage signed-in browsers and protect access to your developer account.</p></div><Button variant="secondary" onClick={() => announceUnavailable('Revoke all other sessions')}>Revoke all others</Button></div>

    <div className="grid grid-cols-3 gap-3"><Card className="border-white/10 bg-white/[0.04]"><p className="text-xs text-white/40">Active</p><p className="mt-2 text-2xl font-bold text-emerald-300">{session ? '1' : '—'}</p></Card><Card className="border-white/10 bg-white/[0.04]"><p className="text-xs text-white/40">Expired</p><p className="mt-2 text-2xl font-bold text-white">—</p></Card><Card className="border-white/10 bg-white/[0.04]"><p className="text-xs text-white/40">Revoked</p><p className="mt-2 text-2xl font-bold text-white">—</p></Card></div>

    {notice && <div role="status" className="rounded-xl border border-amber-400/20 bg-amber-400/[0.08] px-4 py-3 text-sm text-amber-200">{notice}</div>}
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"><div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6"><div><h2 className="text-base font-semibold">Signed-in sessions</h2><p className="mt-1 text-xs text-white/35">Only the current browser session is available from the existing authentication API.</p></div><span className="text-xs text-white/30">{session ? '1 session' : 'No active session'}</span></div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-black/10 text-[11px] uppercase tracking-wider text-white/35"><tr><th className="px-6 py-3 font-medium">Device</th><th className="px-4 py-3 font-medium">IP</th><th className="px-4 py-3 font-medium">Location</th><th className="px-4 py-3 font-medium">Created</th><th className="px-4 py-3 font-medium">Last activity</th><th className="px-4 py-3 font-medium">Status</th><th className="px-6 py-3" /></tr></thead><tbody className="divide-y divide-white/10">{session ? <tr className="text-white/65"><td className="px-6 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-400/10 text-sky-300">▣</span><div><p className="font-medium text-white/85">{session.device}</p><span className="mt-1 inline-flex rounded-md bg-sky-400/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-300">Current session</span></div></div></td><td className="px-4 py-4 font-mono text-xs text-white/40">{session.ip}</td><td className="px-4 py-4">{session.location}</td><td className="px-4 py-4 text-white/40">{session.created}</td><td className="px-4 py-4 text-white/55">{session.activity}</td><td className="px-4 py-4"><Status value={session.status} /></td><td className="px-6 py-4 text-right"><button type="button" onClick={() => announceUnavailable('Revoke')} className="text-xs text-white/35 hover:text-red-300">Revoke</button></td></tr> : <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-white/40">Нет активной сессии в этом браузере.</td></tr>}</tbody></table></div>
      <div className="space-y-3 p-4 md:hidden">{session ? <div className="rounded-xl border border-white/10 bg-black/10 p-4"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-400/10 text-sky-300">▣</span><div><p className="font-medium text-white/85">{session.device}</p><span className="mt-1 inline-flex rounded-md bg-sky-400/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-300">Current session</span></div></div><Status value={session.status} /></div><dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-white/30">IP</dt><dd className="mt-1 font-mono text-white/55">{session.ip}</dd></div><div><dt className="text-white/30">Location</dt><dd className="mt-1 text-white/55">{session.location}</dd></div><div><dt className="text-white/30">Created</dt><dd className="mt-1 text-white/55">{session.created}</dd></div><div><dt className="text-white/30">Last activity</dt><dd className="mt-1 text-white/55">{session.activity}</dd></div></dl><button type="button" onClick={() => announceUnavailable('Revoke')} className="mt-4 w-full rounded-lg border border-white/10 px-3 py-2 text-xs text-white/45 hover:border-red-400/30 hover:text-red-300">Revoke</button></div> : <p className="py-8 text-center text-sm text-white/40">Нет активной сессии в этом браузере.</p>}</div>
    </section>

    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"><div className="flex items-start gap-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300">!</span><div><h2 className="text-base font-semibold">Security information</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">Review active sessions regularly. If you see an unfamiliar browser, revoke it immediately and rotate your access credentials. IP address, location, session history, and remote revocation require a dedicated sessions API, which is not currently available in the backend.</p></div></div></section>
  </div></div>;
}
