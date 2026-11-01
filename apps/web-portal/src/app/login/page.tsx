'use client';

import Link from 'next/link';
import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import { Icon } from '@napare/ui';
import { MaxLaunchAuth } from '../../components/MaxLaunchAuth';
import './login.css';

type Workspace = 'student' | 'staff' | 'admin' | 'developer' | 'career';
type LoginResponse = { accessToken: string; refreshToken: string; workspace: Workspace };
type SessionRestoreState = 'idle' | 'checking' | 'expired' | 'incomplete' | 'unavailable' | 'unsupported' | 'manual';

const destinations: Record<Workspace, string> = {
  career: '/career',
  student: '/student/today',
  staff: '/staff/today',
  admin: '/deanery/dashboard',
  developer: '/developer/api',
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [maxAvailable, setMaxAvailable] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [studentRegistrationInfo, setStudentRegistrationInfo] = useState(false);
  const [sessionRestoreState, setSessionRestoreState] = useState<SessionRestoreState>('checking');
  const restoreControllerRef = useRef<AbortController | null>(null);
  const manualLoginStartedRef = useRef(false);
  useEffect(() => {
    setMaxAvailable(!!(window.WebApp?.initData || window.__naparePendingMaxInitData || window.location.hash.includes('WebAppData=')));
    setStudentRegistrationInfo(new URLSearchParams(window.location.search).get('reason') === 'student-registration-disabled');

    let active = true;
    const controller = new AbortController();
    restoreControllerRef.current = controller;
    const canRestore = () => active && !manualLoginStartedRef.current && !controller.signal.aborted;
    const restoreSession = async () => {
      let accessToken = window.localStorage.getItem('accessToken');
      const refreshToken = window.localStorage.getItem('refreshToken');
      if (!accessToken && !refreshToken) {
        setSessionRestoreState('idle');
        return;
      }
      if (!accessToken || !refreshToken) {
        setSessionRestoreState('incomplete');
        return;
      }

      setSessionRestoreState('checking');

      try {
        let response = await fetch('/api/v1/users/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        });
        if (!canRestore()) return;

        if (response.status === 401) {
          const refreshed = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
            signal: controller.signal,
          });
          const tokens = await refreshed.json().catch(() => null) as { accessToken?: string; refreshToken?: string } | null;
          if (!canRestore()) return;
          if (refreshed.status === 401) {
            window.localStorage.removeItem('accessToken');
            window.localStorage.removeItem('refreshToken');
            setSessionRestoreState('expired');
            return;
          }
          if (!refreshed.ok || !tokens?.accessToken || !tokens.refreshToken) {
            setSessionRestoreState('unavailable');
            return;
          }
          accessToken = tokens.accessToken;
          if (!canRestore()) return;
          window.localStorage.setItem('accessToken', tokens.accessToken);
          window.localStorage.setItem('refreshToken', tokens.refreshToken);
          response = await fetch('/api/v1/users/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: controller.signal,
          });
          if (!canRestore()) return;
        }

        if (response.status === 401) {
          window.localStorage.removeItem('accessToken');
          window.localStorage.removeItem('refreshToken');
          setSessionRestoreState('expired');
          return;
        }
        if (!response.ok) {
          setSessionRestoreState('unavailable');
          return;
        }
        const user = await response.json() as { role?: string };
        if (!canRestore()) return;
        const destinationByRole: Record<string, string> = {
          student: '/student/today',
          teacher: '/staff/today',
          curator: '/staff/today',
          faculty_dean: '/staff/today',
          department_head: '/staff/today',
          university_admin: '/deanery/dashboard',
          superadmin: '/deanery/dashboard',
          developer: '/developer/api',
          employer: '/career',
          career_staff: '/career',
          career_admin: '/career',
        };
        const destination = user.role ? destinationByRole[user.role] : undefined;
        if (!destination) {
          setSessionRestoreState('unsupported');
          return;
        }
        setSessionRestoreState('idle');
        window.location.replace(destination);
      } catch (reason) {
        if (canRestore() && !(reason instanceof DOMException && reason.name === 'AbortError')) {
          setSessionRestoreState('unavailable');
        }
      }
    };

    void restoreSession();
    return () => {
      active = false;
      controller.abort();
      if (restoreControllerRef.current === controller) restoreControllerRef.current = null;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    stopSessionRestoreForManualLogin();
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    const emailInput = event.currentTarget.elements.namedItem('email') as HTMLInputElement;
    const passwordInput = event.currentTarget.elements.namedItem('password') as HTMLInputElement;
    const fields = {
      email: !normalizedEmail ? 'Введите email своего аккаунта.' : emailInput.validity.typeMismatch ? 'Проверьте адрес: например, name@university.ru.' : undefined,
      password: !password ? 'Введите пароль от аккаунта НаПаре.' : undefined,
    };
    setFieldErrors(fields);
    if (fields.email || fields.password) {
      (fields.email ? emailInput : passwordInput).focus();
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/v1/auth/portal-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401) throw new Error('Неверный email или пароль. Проверьте учётные данные.');
        if (response.status === 403) throw new Error('Доступ к кабинету не настроен. Обратитесь к администратору университета.');
        if (response.status === 429) throw new Error('Слишком много попыток входа. Подождите немного и попробуйте снова.');
        throw new Error('Сервис входа временно недоступен. Попробуйте ещё раз через несколько минут.');
      }

      const data = payload as LoginResponse;
      if (!data?.accessToken || !data.refreshToken || !Object.hasOwn(destinations, data.workspace)) throw new Error('Не удалось открыть кабинет. Повторите вход.');
      window.localStorage.setItem('accessToken', data.accessToken);
      window.localStorage.setItem('refreshToken', data.refreshToken);
      // Brief success state so the button confirms the login before the workspace opens.
      setSucceeded(true);
      window.setTimeout(() => window.location.assign(destinations[data.workspace]), 450);
    } catch (reason) {
      setError(reason instanceof TypeError ? 'Не удалось связаться с сервером. Проверьте интернет и повторите вход.' : reason instanceof Error ? reason.message : 'Не удалось выполнить вход');
    } finally {
      setLoading(false);
    }
  }

  function stopSessionRestoreForManualLogin() {
    manualLoginStartedRef.current = true;
    restoreControllerRef.current?.abort();
    setSessionRestoreState('manual');
  }

  const previewRef = useRef<HTMLDivElement | null>(null);

  // The floating schedule preview tilts gently toward the cursor.
  function tiltPreview(event: ReactPointerEvent<HTMLDivElement>) {
    const card = previewRef.current;
    if (!card || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = card.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.setProperty('--preview-ry', `${(px * 7).toFixed(2)}deg`);
    card.style.setProperty('--preview-rx', `${(-py * 7).toFixed(2)}deg`);
  }

  function resetPreviewTilt() {
    const card = previewRef.current;
    if (!card) return;
    card.style.setProperty('--preview-rx', '0deg');
    card.style.setProperty('--preview-ry', '0deg');
  }

  return (
    <main className="login-layout login-focused">
      {sessionRestoreState === 'checking' && (
        <div className="login-restore-gate" aria-busy="true">
          <span className="home-session-spinner" aria-hidden="true" />
          <div role="status" aria-live="polite">Проверяем сохранённый вход…</div>
          <button type="button" onClick={stopSessionRestoreForManualLogin}>Войти вручную</button>
        </div>
      )}
      <section className="login-hero-aside">
        {/* Plain img (asset is served unoptimized anyway): next/image with priority
            injects a preload link that mismatches SSR DOM and triggers hydration rebuild. */}
        <img src="/brand/campus-learning.png" alt="" aria-hidden="true" className="login-hero-background" />
        <div className="login-hero-aurora" aria-hidden="true"><span className="login-orb login-orb--indigo" /><span className="login-orb login-orb--sky" /></div>
        <div className="login-hero-inner">
          <Link href="/" className="brand login-hero-brand"><img src="/brand/np-mark.png" alt="" width={34} height={34} />НаПаре</Link>
          <div className="login-hero-body">
            <div className="login-hero-copy">
              <p className="eyebrow">Цифровая платформа университета</p>
              <h2>Учебный день — <em>в одном месте</em></h2>
              <p className="login-hero-lead">Расписание и изменения, материалы пары и связь с группой — без десятка чатов и вкладок.</p>
              <ul className="login-hero-points">
                <li><Icon name="check" size={16} /> Актуальное расписание на каждый день</li>
                <li><Icon name="check" size={16} /> Уведомления об изменениях пар</li>
                <li><Icon name="check" size={16} /> Пространство каждой пары</li>
              </ul>
            </div>
            <div className="login-hero-preview" ref={previewRef} onPointerMove={tiltPreview} onPointerLeave={resetPreviewTilt}>
              <div className="login-preview-head"><span className="login-preview-title">Сегодня · 3 пары</span><span className="login-preview-badge">1 изменение</span></div>
              <div className="login-preview-lesson is-current"><time>09:00</time><span className="login-preview-mark" /><div className="login-preview-lesson-copy"><strong>Математический анализ</strong><small>Ауд. 301 · Открыто сейчас</small></div><span className="login-preview-status"><span className="login-preview-pulse" />Сейчас</span></div>
              <div className="login-preview-lesson"><time>10:45</time><span className="login-preview-mark" /><div className="login-preview-lesson-copy"><strong>Программирование</strong><small>Ауд. 412 · аудитория изменилась</small></div></div>
            </div>
          </div>
          <p className="login-hero-footnote">НаПаре · учебный день без лишних сервисов</p>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <MaxLaunchAuth captureOnly />
          <Link href="/" className="brand login-brand"><img src="/brand/np-mark.png" alt="" width={34} height={34} />НаПаре</Link>
          <h1>С возвращением</h1>

          {studentRegistrationInfo && (
            <p className="login-session-status" role="status" aria-live="polite">
              Студенческие аккаунты создаёт вуз. Обратитесь в учебный отдел или к администратору, чтобы получить доступ.
            </p>
          )}

          {sessionRestoreState !== 'idle' && sessionRestoreState !== 'manual' && (
            <p className="login-session-status" role="status" aria-live="polite">
              {sessionRestoreState === 'checking' && 'Проверяем сохранённый вход. Вы можете войти вручную, не дожидаясь проверки.'}
              {sessionRestoreState === 'expired' && 'Сохранённый вход завершился. Войдите снова по email и паролю.'}
              {sessionRestoreState === 'incomplete' && 'Не удалось восстановить сохранённый вход. Войдите снова по email и паролю.'}
              {sessionRestoreState === 'unavailable' && 'Не удалось проверить сохранённый вход из-за временной ошибки. Он сохранён; вы можете войти вручную.'}
              {sessionRestoreState === 'unsupported' && 'Для этой роли пока не настроен кабинет. Обратитесь к администратору.'}
            </p>
          )}

          <form onSubmit={submit} className="login-form" noValidate aria-busy={loading}>
            {error && <p className="error" role="alert" key={error}>{error}</p>}
            <label htmlFor="login-email">Email
              <input id="login-email" name="email" type="email" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(event) => { setEmail(event.target.value); setFieldErrors(previous => ({ ...previous, email: undefined })); }} aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? 'login-email-error' : undefined} required />
              {fieldErrors.email && <span id="login-email-error" className="login-field-error" role="alert">{fieldErrors.email}</span>}
            </label>
            <div>
              <label htmlFor="login-password">Пароль</label>
              <div className="login-password-field">
                <input id="login-password" name="password" type={passwordVisible ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setFieldErrors(previous => ({ ...previous, password: undefined })); }} aria-invalid={!!fieldErrors.password} aria-describedby={fieldErrors.password ? 'login-password-error' : undefined} required />
                <button className="login-password-toggle" type="button" aria-label={passwordVisible ? 'Скрыть пароль' : 'Показать пароль'} aria-pressed={passwordVisible} onClick={() => setPasswordVisible(!passwordVisible)}>{passwordVisible ? 'Скрыть' : 'Показать'}</button>
              </div>
              {fieldErrors.password && <span id="login-password-error" className="login-field-error" role="alert">{fieldErrors.password}</span>}
            </div>
            <button type="submit" disabled={loading || succeeded} className={succeeded ? 'is-success' : loading ? 'is-loading' : undefined}>
              {succeeded ? <><span className="login-btn-check" aria-hidden="true"><Icon name="check" size={16} /></span>Входим в кабинет…</> : loading ? <><span className="login-btn-spinner" aria-hidden="true" />Входим…</> : 'Войти'}
            </button>
          </form>
          <details className="login-alt-method" open={maxAvailable} onClickCapture={(event) => {
            if (event.target instanceof Element && event.target.closest('button')) stopSessionRestoreForManualLogin();
          }}>
            <summary>Войти через MAX</summary>
            <p className="support">Доступно внутри MAX после подключения аккаунта НаПаре. Первый вход — по email и паролю.</p>
            <MaxLaunchAuth />
          </details>
          <details className="login-support-details">
            <summary>Не получается войти?</summary>
            <p className="support">Проверьте email и раскладку клавиатуры. Если вам не выдали пароль или вы его забыли, обратитесь в учебную часть или к администратору университета.</p>
          </details>
          <a href="/career/register" className="login-career-link">Регистрация работодателя</a>
        </div>
        <Link href="/privacy" className="login-privacy-link">Политика конфиденциальности</Link>
      </section>
    </main>
  );
}
