// Đăng nhập nội bộ cho staff/admin. Khách vay không đi qua màn hình này.
import { ArrowLeft } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { conversationApi, USE_MOCK_API } from '../api';
import { ApiRequestError } from '../api/client';
import type { AuthUser } from '../types';
import './Login.css';

export function Login({ onSuccess, onBack }: { onSuccess: (user: AuthUser) => void; onBack?: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // UNCONTROLLED form: đọc value từ FormData lúc submit (không giữ state per-keystroke). Chuẩn
  // HTML form → hoạt động đồng nhất với người gõ, password-manager autofill, và automation tool
  // (React controlled input bỏ lỡ input event do các nguồn này set value trực tiếp).
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const form = new FormData(e.currentTarget);
    const username = String(form.get('username') ?? '').trim();
    const password = String(form.get('password') ?? '');
    if (!username || !password) {
      setError('Nhập đủ tên đăng nhập và mật khẩu.');
      return;
    }
    setBusy(true);
    setError(null);
    conversationApi
      .login(username, password)
      .then((res) => onSuccess(res.user))
      .catch((err: unknown) => {
        if (err instanceof ApiRequestError && err.status === 401) {
          setError('Tên đăng nhập hoặc mật khẩu không đúng.');
        } else {
          setError('Không thể đăng nhập. Vui lòng thử lại sau.');
        }
      })
      .finally(() => setBusy(false));
  };

  return (
    <div className="login">
      <form className="login__card" onSubmit={submit}>
        {onBack && (
          <button className="login__back" type="button" onClick={onBack}>
            <ArrowLeft size={15} /> Quay lại trang tư vấn
          </button>
        )}
        <div className="login__brand">
          <span className="login__logo">S</span>
          <div>
            <div className="login__title">Đăng nhập nội bộ SHB</div>
            <div className="login__sub">Dành cho nhân viên và quản lý</div>
          </div>
        </div>

        {USE_MOCK_API && <div className="login__mockflag">MÔI TRƯỜNG DEMO · Dữ liệu minh họa</div>}

        <label className="login__field">
          <span>Tên đăng nhập</span>
          <input
            name="username"
            defaultValue="staff"
            autoComplete="username"
            aria-label="Tên đăng nhập"
          />
        </label>
        <label className="login__field">
          <span>Mật khẩu</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            aria-label="Mật khẩu"
          />
        </label>

        {error && <div className="login__error" role="alert">{error}</div>}

        <button className="btn btn--primary login__submit" type="submit" disabled={busy}>
          {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>

        {USE_MOCK_API && (
          <div className="login__hint">
            Demo: <b>staff / staff</b> — Nhân viên tín dụng · <b>admin / admin</b> — Quản lý
          </div>
        )}
      </form>
    </div>
  );
}
