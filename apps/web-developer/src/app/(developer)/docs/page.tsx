"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const sections = [
  { id: "introduction", label: "Начало работы" },
  { id: "authentication", label: "Аутентификация" },
  { id: "api-request", label: "Запрос к API" },
  { id: "responses", label: "Ответы и ошибки" },
];

export default function DocsPage() {
  const [origin, setOrigin] = useState("");
  const [language, setLanguage] = useState("curl");
  const [copyStatus, setCopyStatus] = useState("");
  useEffect(() => { if (!copyStatus) return; const timer = window.setTimeout(() => setCopyStatus(""), 4000); return () => window.clearTimeout(timer); }, [copyStatus]);
  useEffect(() => setOrigin(window.location.origin), []);
  const baseUrl = origin + "/api/v1";
  const examples: Record<string, string> = {
    curl: `curl '${baseUrl}/users/me' -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'`,
    javascript: `const response = await fetch('/api/v1/users/me', {
  headers: { Authorization: \`Bearer \${token}\` },
});
if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
const user = await response.json();`,
    python: `import requests

response = requests.get(
    "${baseUrl}/users/me",
    headers={"Authorization": f"Bearer {token}"},
)
response.raise_for_status()`,
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(examples[language]); setCopyStatus("Скопировано"); }
    catch { setCopyStatus("Не удалось скопировать. Выделите код вручную."); }
  };
  const [query,setQuery]=useState('');
  const searchableText:Record<string,string>={
    introduction:'Начало работы адрес текущего стенда единый домен сайт база url /api/v1 проверьте срок текущей сессии выполните запрос аккаунта в локальном инструменте выберите метод и схему в Swagger',
    authentication:'Аутентификация Authorization Bearer access token права зависят от роли и университета аккаунта не публикуйте токены в коде скриншотах или журналах JWT токен доступ сессия вход',
    'api-request':'Запрос к API первый запрос мой аккаунт users/me YOUR_ACCESS_TOKEN curl javascript python fetch requests headers response json HTTP статус скопировать пример',
    responses:'Ответы и ошибки формат ответа объект список пагинация Swagger HTTP статус 401 сессия истекла токен отсутствует 403 нет доступа 400 обязательные поля формат значений выбранного запроса',
  };
  const matches=(id:string)=>!query.trim()||(searchableText[id]||'').toLocaleLowerCase('ru-RU').includes(query.trim().toLocaleLowerCase('ru-RU'));
  const matchedSections=sections.filter(section=>matches(section.id));
  const resultLabel=(count:number)=>count===1?'раздел':count>=2&&count<=4?'раздела':'разделов';
  return <div className="mx-auto max-w-6xl space-y-7 px-4 py-6 text-white sm:px-6 lg:px-8">
    <div><p className="text-sm text-sky-300">Разработчик</p><h1 className="mt-2 text-2xl font-bold sm:text-3xl">Документация API</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">Начните с адреса текущего стенда и проверки своего аккаунта. Схемы методов и обязательные поля доступны в Swagger.</p><a href="/api/v1/docs" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-white/20 px-4 text-sm font-semibold text-sky-200 hover:bg-white/5">Открыть Swagger ↗</a></div>
    <label className="block max-w-xl text-sm text-white/70">Поиск по документации<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Например, токен или ошибка…" className="mt-2 min-h-11 w-full rounded-lg border border-white/20 bg-[#0b0e14] px-3 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300"/></label>
    <p role="status" aria-live="polite" className={query.trim() ? "-mt-5 text-sm text-white/70" : "sr-only"}>{query.trim() ? matchedSections.length ? `Найдено ${matchedSections.length} ${resultLabel(matchedSections.length)}.` : 'Разделов по этому запросу нет. Измените поиск.' : `Показаны все ${sections.length} раздела.`}</p>
    <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="Содержание документации" className="flex flex-wrap gap-2 lg:sticky lg:top-24 lg:block lg:self-start">{matchedSections.map(section => <a key={section.id} href={"#" + section.id} className="flex min-h-11 items-center rounded-lg px-3 text-sm text-white/70 hover:bg-white/5 hover:text-sky-200">{section.label}</a>)}</nav>
      <div className="min-w-0 space-y-6">
        <section hidden={!matches('introduction')} id="introduction" className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"><h2 className="text-lg font-semibold">Адрес текущего стенда</h2><p className="mt-3 text-sm leading-6 text-white/60">Все кабинеты работают через единый домен. Адрес ниже соответствует сайту, который открыт сейчас.</p><code className="mt-4 block break-all rounded-lg bg-black/20 p-3 text-sm text-sky-200">{origin ? baseUrl : "Определяем адрес…"}</code><ol className="mt-4 list-inside list-decimal space-y-2 text-sm text-white/70"><li>Проверьте срок текущей сессии.</li><li>Выполните запрос аккаунта в локальном инструменте.</li><li>Выберите метод и схему в Swagger.</li></ol></section>
        <section hidden={!matches('authentication')} id="authentication" className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"><h2 className="text-lg font-semibold">Аутентификация</h2><p className="mt-3 text-sm leading-6 text-white/60">Передавайте access token в заголовке Authorization: Bearer. Права зависят от роли и университета аккаунта. Не публикуйте токены в коде, скриншотах или журналах.</p><Link href="/session" className="mt-4 inline-flex min-h-11 items-center text-sm text-sky-200">Проверить текущую сессию →</Link></section>
        <section hidden={!matches('api-request')} id="api-request" className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"><h2 className="text-lg font-semibold">Первый запрос: мой аккаунт</h2><p className="mt-3 text-sm leading-6 text-white/60">Замените YOUR_ACCESS_TOKEN своим токеном в локальном инструменте. Пример не содержит данные текущей сессии.</p><div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#080b12]"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-2"><div className="flex gap-1">{Object.keys(examples).map(item => <button key={item} type="button" aria-pressed={item === language} onClick={() => {setLanguage(item); setCopyStatus("");}} className={`min-h-11 rounded-lg px-3 text-xs ${item === language ? "bg-white/10 text-white" : "text-white/60"}`}>{item}</button>)}</div><button type="button" onClick={copy} className="min-h-11 rounded-lg px-3 text-xs text-sky-200">Копировать</button></div><pre className="overflow-x-auto p-4 text-xs leading-6 text-sky-100"><code>{examples[language]}</code></pre></div>{copyStatus && <p role="status" className="mt-2 text-sm text-white/70">{copyStatus}</p>}</section>
        <section hidden={!matches('responses')} id="responses" className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"><h2 className="text-lg font-semibold">Ответы и ошибки</h2><p className="mt-3 text-sm leading-6 text-white/60">Формат ответа зависит от метода: объект, список или результат с пагинацией. Проверяйте схему выбранного запроса в Swagger и HTTP-статус перед чтением данных.</p><dl className="mt-4 space-y-3 text-sm"><div className="flex gap-4"><dt className="font-mono text-sky-200">401</dt><dd className="text-white/60">Сессия истекла или токен отсутствует. Выполните вход заново.</dd></div><div className="flex gap-4"><dt className="font-mono text-sky-200">403</dt><dd className="text-white/60">У аккаунта нет доступа к этому действию или университету.</dd></div><div className="flex gap-4"><dt className="font-mono text-sky-200">400</dt><dd className="text-white/60">Проверьте обязательные поля и формат значений.</dd></div></dl><Link href="/api" className="mt-5 inline-flex min-h-11 items-center text-sm text-sky-200">Открыть обозреватель API →</Link></section>
      </div>
    </div>
  </div>;
}
