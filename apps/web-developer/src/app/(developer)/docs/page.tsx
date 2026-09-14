'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

const sections = ['Getting Started', 'Authentication', 'API', 'Users', 'Schedule', 'Groups', 'Notifications', 'Errors', 'Webhooks'];
const pageLinks = ['Introduction', 'Authentication', 'API request', 'Response format', 'Errors'];

const examples = {
  curl: `curl https://api.napare.ru/api/v1/users/me \\
  -H "Authorization: Bearer $TOKEN"`,
  javascript: `const response = await fetch('/api/v1/users/me', {
  headers: { Authorization: \`Bearer \${token}\` },
});

const user = await response.json();`,
  python: `import requests

response = requests.get(
    "https://api.napare.ru/api/v1/users/me",
    headers={"Authorization": f"Bearer {token}"},
)`,
};

function CodeBlock() {
  const [language, setLanguage] = useState<keyof typeof examples>('curl');
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(examples[language]);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return <div className="overflow-hidden rounded-xl border border-white/10 bg-[#080b12] shadow-2xl shadow-black/20">
    <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
      <div className="flex gap-1" role="tablist" aria-label="Code language">
        {(Object.keys(examples) as Array<keyof typeof examples>).map((item) => <button key={item} type="button" role="tab" aria-selected={language === item} onClick={() => setLanguage(item)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${language === item ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/75'}`}>{item}</button>)}
      </div>
      <button type="button" onClick={copy} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-white/45 transition-colors hover:bg-white/10 hover:text-white">{copied ? 'Copied' : 'Copy'}</button>
    </div>
    <pre className="overflow-x-auto p-4 text-[13px] leading-6 text-sky-100"><code>{examples[language]}</code></pre>
  </div>;
}

export default function DocsPage() {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('Getting Started');
  const visibleSections = useMemo(() => sections.filter((section) => section.toLowerCase().includes(query.toLowerCase())), [query]);

  return <div className="min-h-full bg-[#0b0e14] text-white">
    <div className="border-b border-white/10 px-4 py-4 sm:px-6 lg:px-8"><div className="mx-auto flex max-w-[1500px] items-center gap-2 text-xs text-white/40">Developer <span>/</span> <span className="text-white/80">Docs</span></div></div>
    <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[220px_minmax(0,1fr)_190px]">
      <aside className="border-b border-white/10 px-4 py-5 lg:min-h-[calc(100vh-74px)] lg:border-b-0 lg:border-r lg:px-5">
        <label className="relative block"><span className="sr-only">Search docs</span><span className="pointer-events-none absolute left-3 top-2.5 text-white/35">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search docs..." className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 pl-8 pr-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-sky-400/60" /></label>
        <nav className="mt-6 grid grid-cols-2 gap-1 lg:block" aria-label="Documentation sections">{visibleSections.map((section) => <button key={section} type="button" onClick={() => setActive(section)} className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${active === section ? 'bg-sky-400/10 font-medium text-sky-300' : 'text-white/55 hover:bg-white/[0.05] hover:text-white'}`}>{section}</button>)}{visibleSections.length === 0 && <p className="col-span-2 px-3 py-2 text-xs text-white/35">No matching sections</p>}</nav>
      </aside>
      <main className="min-w-0 px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <div className="mx-auto max-w-3xl"><div className="mb-8 flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-sky-300">{active}</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Build with NaPare</h1><p className="mt-4 max-w-2xl text-base leading-7 text-white/55">Connect your university tools to the NaPare platform and keep schedules, groups, assignments, and notifications in sync.</p></div><a href="/api/v1/docs" target="_blank" rel="noopener noreferrer" className="hidden shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white sm:block">Open Swagger ↗</a></div>
          <section id="introduction" className="scroll-mt-8"><h2 className="text-xl font-semibold text-white">Introduction</h2><p className="mt-3 text-sm leading-7 text-white/55">The NaPare API is a REST interface for authenticated access to the university workspace. Requests use JSON and return a predictable response envelope.</p></section>
          <section id="authentication" className="mt-10 scroll-mt-8"><h2 className="text-xl font-semibold text-white">Authentication</h2><p className="mt-3 text-sm leading-7 text-white/55">Send your access token in the Authorization header. Keep tokens private and rotate them if a credential is exposed.</p><div className="mt-5"><CodeBlock /></div></section>
          <section id="api-request" className="mt-10 scroll-mt-8"><h2 className="text-xl font-semibold text-white">API request</h2><p className="mt-3 text-sm leading-7 text-white/55">Use the base URL below for platform requests. The interactive API explorer contains the complete endpoint schema and response models.</p><div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 font-mono text-sm text-sky-200">https://api.napare.ru/api/v1</div></section>
          <section className="mt-10 border-t border-white/10 pt-8"><h2 className="text-xl font-semibold text-white">Continue exploring</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{['Users', 'Schedule', 'Groups', 'Notifications'].map((item) => <button key={item} type="button" onClick={() => setActive(item)} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-white/65 hover:border-sky-400/40 hover:text-white">{item}<span className="float-right text-white/30">→</span></button>)}</div></section>
        </div>
      </main>
      <aside className="hidden border-l border-white/10 px-5 py-12 xl:block"><p className="text-xs font-semibold uppercase tracking-wider text-white/35">On this page</p><nav className="mt-4 space-y-3">{pageLinks.map((item, index) => <a key={item} href={`#${['introduction', 'authentication', 'api-request', 'api-request', 'errors'][index]}`} className="block text-xs text-white/45 hover:text-sky-300">{item}</a>)}</nav><div className="mt-10 border-t border-white/10 pt-5"><p className="text-xs text-white/30">Need the full schema?</p><Link href="/api" className="mt-2 inline-block text-xs font-medium text-sky-300 hover:text-sky-200">Open API Explorer →</Link></div></aside>
    </div>
  </div>;
}
