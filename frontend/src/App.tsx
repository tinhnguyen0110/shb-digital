// Cửa khách luôn công khai. /me chỉ dùng khôi phục phiên nội bộ staff/admin; 401 không được
// chặn trải nghiệm khách vay. Cookie JWT httponly do server giữ trong chế độ full-stack.
import { lazy, Suspense, useEffect, useState } from 'react';
import { conversationApi } from './api';
import { Login } from './components/Login';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useTheme } from './hooks/useTheme';
import { can } from './rbac';
import type { AuthUser } from './types';
import './components/Login.css';

const Workspace = lazy(() => import('./Workspace').then((module) => ({ default: module.Workspace })));
const ControlTower = lazy(() => import('./components/ControlTower').then((module) => ({ default: module.ControlTower })));
const PortalDashboard = lazy(() => import('./components/PortalDashboard').then((module) => ({ default: module.PortalDashboard })));
const BorrowerExperience = lazy(() => import('./components/BorrowerExperience').then((module) => ({ default: module.BorrowerExperience })));

type BootState =
  | { phase: 'public' }
  | { phase: 'authed'; user: AuthUser };

// Boundary ngoài cùng bắt lỗi ở mọi nhánh public/portal/workspace để tránh màn trắng.
export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

function ViewLoading() {
  return <div className="app-view-loading" role="status">Đang mở nội dung…</div>;
}

function AppInner() {
  const [boot, setBoot] = useState<BootState>({ phase: 'public' });
  const [showStaffLogin, setShowStaffLogin] = useState(false);
  const [view, setView] = useState<'portal' | 'workspace' | 'tower'>('portal');
  const [towerBackView, setTowerBackView] = useState<'portal' | 'workspace'>('portal');
  const { theme, toggleTheme } = useTheme();

  const completeLogin = (user: AuthUser) => {
    setView('portal');
    setTowerBackView('portal');
    setShowStaffLogin(false);
    setBoot({ phase: 'authed', user });
  };

  const expireAuth = () => {
    setView('portal');
    setTowerBackView('portal');
    setShowStaffLogin(false);
    setBoot({ phase: 'public' });
  };

  const logout = () => {
    expireAuth();
    void conversationApi.logout().catch(() => undefined);
  };

  // Cửa khách hiển thị ngay, không cần đăng nhập. Nếu đã có phiên nhân viên hợp lệ thì chuyển
  // vào portal nội bộ sau khi /me hoàn tất; lỗi/401 không làm gián đoạn trải nghiệm khách vay.
  useEffect(() => {
    let alive = true;
    conversationApi
      .me()
      .then((res) => {
        if (alive && res.user.role !== 'customer') setBoot({ phase: 'authed', user: res.user });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (boot.phase === 'public') {
    if (showStaffLogin) {
      return <Login onSuccess={completeLogin} onBack={() => setShowStaffLogin(false)} />;
    }
    return (
      <Suspense fallback={<ViewLoading />}>
        <BorrowerExperience
          theme={theme}
          onToggleTheme={toggleTheme}
          onStaffLogin={() => setShowStaffLogin(true)}
        />
      </Suspense>
    );
  }

  const isAdmin = can(boot.user, 'monitoring.read');
  if (view === 'tower' && isAdmin) {
    return (
      <Suspense fallback={<ViewLoading />}>
        <ControlTower onBack={() => setView(towerBackView)} />
      </Suspense>
    );
  }

  if (view === 'portal') {
    return (
      <Suspense fallback={<ViewLoading />}>
        <PortalDashboard
          user={boot.user}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenWorkspace={() => setView('workspace')}
          onOpenTower={isAdmin ? () => { setTowerBackView('portal'); setView('tower'); } : undefined}
          onAuthExpired={logout}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<ViewLoading />}>
      <Workspace
        user={boot.user}
        onAuthExpired={logout}
        onOpenPortal={() => setView('portal')}
        onOpenTower={isAdmin ? () => { setTowerBackView('workspace'); setView('tower'); } : undefined}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    </Suspense>
  );
}
