const manifest = {
  id: '/student/',
  name: 'НаПаре — Студент',
  short_name: 'НаПаре',
  description: 'Расписание занятий, уведомления и общение — всё в одном месте',
  start_url: '/student/today',
  scope: '/student/',
  display: 'standalone',
  background_color: '#f8fafc',
  theme_color: '#2563eb',
  lang: 'ru',
  icons: [{ src: '/student/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
};

export function GET() {
  return Response.json(manifest, {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
