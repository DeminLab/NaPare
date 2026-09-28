# Hyperframes Composition Brief: НаПаре

## Objective
Собрать короткий launch-ролик для NaPare, показывающий, как изменение расписания попадает в контекст конкретного занятия и становится заметным студенту.

## Output
- Composition directory: `composition/`
- Rendered video: `brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20 seconds

## Source Material
- Project root: `C:\Users\home\NaPare`
- Primary files read: `apps/web-portal/src/app/page.tsx`, `apps/web-portal/src/components/ProductShowcase.tsx`, `apps/web-portal/src/app/portal.css`, `packages/design-tokens/styles.css`, `apps/web-portal/src/app/layout.tsx`
- Product name: НаПаре
- Tagline / strongest claim: «Учебный день — в одном понятном окне»
- Key UI or visual moment to recreate: демонстрационный экран «Мой день» с расписанием, уведомлением об изменении аудитории и блоком подготовки к паре.
- Copy that must appear verbatim:
  - «Мой день»
  - «Аудитория обновлена»
  - «Учебный день — в одной системе.»

## Creative Direction
- Tone preset: polished
- Creative direction: тёплый технологичный рекламный ролик с одной лёгкой шуткой на открытии.
- Interpretation: уверенная подача, короткие фразы, плавные переходы и сдержанное движение.
- Angle: «Аудитория поменялась. А чат уже молчит?» становится входом в демонстрацию: NaPare связывает изменение с занятием, показывает подготовку и уведомляет нужного участника.
- Hook: «Аудитория поменялась. А чат уже молчит?» плюс замена 316 → 408.
- Outro / punchline: «НаПаре. Учебный день — в одной системе.»
- Avoid: generic SaaS language, invented metrics, external data, implying live MAX, replacing Moodle grading/submissions, exposing personal contact information, abstract filler visuals.

## Visual Identity
- Background: #081631 opening; #f6f7f9 and white UI surfaces.
- Text: #172033 on light surfaces; #ffffff on dark surfaces.
- Accent: #4f46e5 and #a5b4fc; secondary #67e8f9.
- Display font: Segoe UI / Arial system sans, avoiding remote font dependencies.
- Body font: Segoe UI / Arial system sans, avoiding remote font dependencies.
- Visual references from the project: copied campus photo, NaPare brand mark, schedule and Pair Space language from the actual landing page/showcase.

## Storyboard
1. Аудитория изменилась — 3s — campus, hook, room 316 changes to 408.
2. Изменение у занятия — 4s — schedule UI, updated room notification.
3. Весь день в контексте — 4s — «Мой день», preparation and announcements.
4. Каждой роли — своё — 5s — student, teacher and university panels.
5. Финальный кадр — 4s — logo, tagline and launch discussion CTA.

## Audio
- Audio role: warm, understated music bed.
- Audio arc: quick opening cue, low-level UI accents, warm fade at the end.
- Music: `assets/music/happy-beats-business-moves-vol-1-by-ende-dot-app.mp3`
- Music treatment: moderate volume, start at 0s, fade out during final 0.6s.
- Music cue guidance: `music-cues.md`, ~120 BPM; strong cues at 17.02s, 18.02s, 20.02s; align visual entrances only where readability is preserved.
- Audio-reactive treatment: none.
- Audio-coupled moments: room update; in-context notification; final logo/CTA.
- SFX selection guidance: a few quiet interface accents that match the room update and notification; no alarm sounds.
- SFX analysis guidance: use Brag's bundled `skills/brag/assets/sfx/sfx-analysis.md` when selecting any SFX.
- Exact SFX choice: choose after motion is authored and validated.
- Audio files: music is already copied to `composition/assets/music/`.

## Hyperframes Instructions
- Use `/hyperframes-core`, `/hyperframes-animation`, `/hyperframes-creative`, `/hyperframes-keyframes`, and `/hyperframes-cli` rules.
- Show actual NaPare terminology and clearly demonstrative interface values.
- All required text must remain readable in the rendered video.
- Total duration: 20 seconds.
- Keep the supplied logo and campus image local to this composition.
