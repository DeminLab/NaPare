"use client";

import { useEffect } from "react";

export default function LoginPage() {
  useEffect(() => { window.location.replace("/login"); }, []);
  return <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] p-6 text-[#111b34]"><div className="w-full max-w-md rounded-2xl border border-[#e2e7f1] bg-white p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-[#5146e8]">НаПаре · кабинет разработчика</p><h1 className="mt-3 text-xl font-semibold">Единый вход в НаПаре</h1><p className="mt-3 text-sm leading-6 text-[#637392]">Открываем страницу входа для вашего аккаунта.</p><a href="/login" className="mt-4 inline-flex min-h-11 items-center font-semibold text-[#5146e8]">Перейти к входу →</a></div></main>;
}
