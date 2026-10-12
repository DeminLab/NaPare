"use client";

import { useEffect } from "react";

export default function LoginPage() {
  useEffect(() => { window.location.replace("/login"); }, []);
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white"><div><h1 className="text-xl font-semibold">Единый вход в НаПаре</h1><p className="mt-3 text-sm text-slate-300">Открываем страницу входа для вашего аккаунта.</p><a href="/login" className="mt-4 inline-flex min-h-11 items-center text-cyan-200">Перейти к входу →</a></div></main>;
}
