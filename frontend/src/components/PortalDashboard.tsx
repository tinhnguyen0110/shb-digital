import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity,
  ArrowRight,
  Bell,
  BookOpenCheck,
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
  CircleHelp,
  CircleGauge,
  FileClock,
  FileCheck2,
  FileText,
  Files,
  Landmark,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  RefreshCw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  UsersRound,
  WalletCards,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { conversationApi, USE_MOCK_API } from '../api';
import { ApiRequestError } from '../api/client';
import {
  caseAttachments,
  DEMO_LOAN_CASES,
  needsStaffReassessment,
  type DemoLoanCase,
} from '../data/loanCases';
import {
  REGION_SERVICE_CONFIGS,
  SHB_LOAN_PRODUCTS,
  SMALL_UNSECURED_POLICY,
  type RegionCode,
} from '../data/loanProducts';
import type { ApprovalRow, AuthUser, Conversation, ConversationStatus } from '../types';
import type { ThemeMode } from '../hooks/useTheme';
import { can, type Permission } from '../rbac';
import { userRoleLabel } from '../uiCopy';
import { ThemeToggle } from './ThemeToggle';
import './PortalDashboard.css';

type PortalSection = 'dashboard' | 'pipeline' | 'portfolio' | 'policy' | 'access' | 'settings';

interface Props {
  user: AuthUser;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenWorkspace: () => void;
  onOpenTower?: () => void;
  onAuthExpired: () => void;
}

const NAV_ITEMS: Array<{ id: PortalSection; label: string; icon: LucideIcon; permission: Permission }> = [
  { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, permission: 'cases.read' },
  { id: 'pipeline', label: 'Tiến độ hồ sơ', icon: Workflow, permission: 'cases.read' },
  { id: 'portfolio', label: 'Sản phẩm vay', icon: WalletCards, permission: 'products.read' },
  { id: 'policy', label: 'Chính sách phê duyệt', icon: ShieldCheck, permission: 'policies.read' },
  { id: 'access', label: 'Người dùng & phân quyền', icon: UsersRound, permission: 'users.read' },
  { id: 'settings', label: 'Cài đặt', icon: Settings2, permission: 'cases.read' },
];

const AccessManagementView = lazy(() =>
  import('./AccessManagementView').then((module) => ({ default: module.AccessManagementView })),
);

const STATUS_META: Record<ConversationStatus, { label: string; color: string; tone: string }> = {
  idle: { label: 'Mới tiếp nhận', color: 'var(--faint)', tone: 'idle' },
  running: { label: 'Đang thẩm định', color: 'var(--run)', tone: 'run' },
  waiting_approval: { label: 'Chờ xác nhận', color: 'var(--warn)', tone: 'warn' },
  done: { label: 'Hoàn tất', color: 'var(--pass)', tone: 'pass' },
  failed: { label: 'Cần đánh giá lại', color: 'var(--fail)', tone: 'fail' },
};

const PORTAL_DEMO_CONVERSATIONS: Conversation[] = DEMO_LOAN_CASES.map((item) => item.conversation);

export function PortalDashboard({
  user,
  theme,
  onToggleTheme,
  onOpenWorkspace,
  onOpenTower,
  onAuthExpired,
}: Props) {
  const [section, setSection] = useState<PortalSection>('dashboard');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const activeRegion = user.region ?? 'north';
  const activeTenantId = user.tenant_id ?? REGION_SERVICE_CONFIGS[activeRegion].tenantId;

  const visibleNavItems = useMemo(
    () => NAV_ITEMS
      .filter((item) => can(user, item.permission))
      .map((item) => item.id === 'pipeline'
        ? { ...item, label: user.role === 'admin' ? 'Hồ sơ chi nhánh' : 'Cần đánh giá lại' }
        : item),
    [user],
  );

  const loadPortal = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [conversationRows, approvalRows] = await Promise.all([
        conversationApi.listConversations(),
        can(user, 'cases.approve') ? conversationApi.listApprovals('pending') : Promise.resolve([]),
      ]);
      setConversations(conversationRows);
      setApprovals(approvalRows);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        onAuthExpired();
        return;
      }
      setError('Chưa tải được thông tin. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  }, [onAuthExpired, user]);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  const portalConversations = useMemo(() => {
    // Portal demo dùng dataset nghiệp vụ cố định, không trộn các phòng tác nghiệp tạm được tạo
    // trong Workspace. Production luôn dùng danh sách đã scope từ API.
    const rows = USE_MOCK_API ? PORTAL_DEMO_CONVERSATIONS : conversations;
    const allowedIds = new Set(
      DEMO_LOAN_CASES
        .filter((item) => item.tenantId === activeTenantId)
        .map((item) => item.conversation.id),
    );
    const tenantRows = rows.filter((item) => {
      if (item.tenant_id) return item.tenant_id === activeTenantId;
      if (USE_MOCK_API) return allowedIds.has(item.id);
      // Tương thích API cũ: backend mới vẫn là ranh giới bắt buộc; client không nhận tenant từ bộ lọc.
      return true;
    });
    if (user.role === 'admin') return tenantRows;

    return tenantRows.filter((conversation) => {
      const demoCase = DEMO_LOAN_CASES.find((item) => item.conversation.id === conversation.id);
      if (demoCase) return needsStaffReassessment(demoCase);
      return conversation.status === 'failed';
    });
  }, [activeTenantId, conversations, user.role]);

  const selectedCase = useMemo(
    () => DEMO_LOAN_CASES.find(
      (item) => item.tenantId === activeTenantId && item.conversation.id === selectedCaseId,
    ) ?? null,
    [activeTenantId, selectedCaseId],
  );

  const counts = useMemo(() => {
    const result: Record<ConversationStatus, number> = {
      idle: 0,
      running: 0,
      waiting_approval: 0,
      done: 0,
      failed: 0,
    };
    for (const conversation of portalConversations) result[conversation.status] += 1;
    return result;
  }, [portalConversations]);

  const chartData = useMemo(
    () =>
      (Object.keys(STATUS_META) as ConversationStatus[]).map((status) => ({
        status,
        name: STATUS_META[status].label,
        value: counts[status],
        color: STATUS_META[status].color,
      })),
    [counts],
  );

  const selectSection = (next: PortalSection) => {
    setSection(next);
    setMenuOpen(false);
  };

  return (
    <div className="portal">
      {menuOpen && <button className="portal__scrim" type="button" onClick={() => setMenuOpen(false)} aria-label="Đóng menu" />}
      <aside className={`portal__sidebar${menuOpen ? ' portal__sidebar--open' : ''}`}>
        <div className="portal__identity">
          <span className="portal__bank-mark" aria-hidden="true"><Landmark size={24} /></span>
          <div>
            <strong>SHB Tín dụng</strong>
            <span>Quản lý hồ sơ vay</span>
          </div>
          <button className="portal__mobile-close" type="button" onClick={() => setMenuOpen(false)} aria-label="Đóng menu">
            <X size={19} />
          </button>
        </div>

        <nav className="portal__nav" aria-label="Điều hướng trang quản lý">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`portal__nav-item${active ? ' portal__nav-item--active' : ''}`}
                onClick={() => selectSection(item.id)}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="portal__sidebar-bottom">
          {can(user, 'cases.review') ? (
            <button className="portal__agent-switch" type="button" onClick={onOpenWorkspace}>
              <Files size={18} aria-hidden="true" />
              {user.role === 'admin' ? 'Mở khu vực quyết định' : 'Mở hàng đợi đánh giá lại'}
            </button>
          ) : null}
          <div className="portal__sidebar-links">
            <button type="button"><CircleHelp size={16} /> Hỗ trợ</button>
            <button type="button"><Bell size={16} /> Thông báo</button>
          </div>
        </div>
      </aside>

      <div className="portal__main">
        <header className="portal__topbar">
          <div className="portal__topbar-leading">
            <button className="portal__menu" type="button" onClick={() => setMenuOpen(true)} aria-label="Mở menu">
              <Menu size={21} />
            </button>
            <div>
              <strong>Cổng quản lý hồ sơ vay</strong>
              <span>Tiếp nhận, thẩm định và theo dõi hồ sơ</span>
            </div>
          </div>
          <div className="portal__topbar-actions">
            {USE_MOCK_API && <span className="portal__mock-badge">MÔI TRƯỜNG DEMO</span>}
            <div className="portal__unit-select" aria-label="Đơn vị quản lý">
              <MapPin size={14} aria-hidden="true" />
              <strong>{user.tenant_name ?? REGION_SERVICE_CONFIGS[activeRegion].label}</strong>
            </div>
            {can(user, 'cases.create') && (
              <button className="portal__primary-action" type="button" onClick={onOpenWorkspace}>
                Tạo hồ sơ mới
                <ArrowRight size={16} />
              </button>
            )}
            {onOpenTower && (
              <button className="portal__icon-button" type="button" onClick={onOpenTower} aria-label="Mở trung tâm giám sát" title="Trung tâm giám sát" data-testid="open-tower">
                <Activity size={18} />
              </button>
            )}
            <ThemeToggle theme={theme} onToggle={onToggleTheme} className="portal__icon-button" />
            <img className="portal__avatar" src="/officer-avatar.jpg" alt="Cán bộ tín dụng SHB" />
            <div className="portal__user">
              <strong>{user.username}</strong>
              <span>{userRoleLabel(user.role)}</span>
            </div>
            <button className="portal__icon-button portal__logout" type="button" onClick={onAuthExpired} aria-label="Đăng xuất" title="Đăng xuất">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="portal__content">
          {section !== 'access' && (
            <div className="portal__page-heading">
              <div>
                <span className="portal__eyebrow">
                  {user.role === 'admin' ? 'Giám đốc chi nhánh' : 'Nhân viên đánh giá lại'}
                </span>
                <h1>{visibleNavItems.find((item) => item.id === section)?.label ?? 'Tổng quan'}</h1>
                <p>
                  {user.role === 'admin'
                    ? 'Xem hồ sơ trong chi nhánh, tài liệu đính kèm và các trường hợp cần xác nhận.'
                    : 'Chỉ hiển thị hồ sơ có điểm thấp hoặc lỗi nghiêm trọng cần đánh giá lại.'}
                </p>
              </div>
              <button className="portal__refresh" type="button" onClick={() => void loadPortal()} disabled={loading}>
                <RefreshCw size={16} className={loading ? 'portal__spin' : ''} />
                Làm mới
              </button>
            </div>
          )}

          {error && (
            <div className="portal__error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => void loadPortal()}>Thử lại</button>
            </div>
          )}

          {section === 'dashboard' && (
            <DashboardView
              conversations={portalConversations}
              approvals={approvals}
              counts={counts}
              chartData={chartData}
              loading={loading}
              onOpenWorkspace={onOpenWorkspace}
              onOpenCase={setSelectedCaseId}
              onOpenPipeline={() => selectSection('pipeline')}
              user={user}
            />
          )}
          {section === 'pipeline' && (
            <PipelineView
              conversations={portalConversations}
              loading={loading}
              onOpenCase={setSelectedCaseId}
              user={user}
            />
          )}
          {section === 'portfolio' && <ProductCatalogView />}
          {section === 'policy' && can(user, 'policies.read') && (
            <PolicyView
              activeRegion={activeRegion}
              canManage={can(user, 'policies.manage')}
            />
          )}
          {section === 'access' && can(user, 'users.read') && (
            <Suspense fallback={<div className="portal__table-state" role="status">Đang mở quản lý người dùng…</div>}>
              <AccessManagementView user={user} />
            </Suspense>
          )}
          {section === 'settings' && (
            <SettingsView
              user={user}
              theme={theme}
              onToggleTheme={onToggleTheme}
              onOpenWorkspace={onOpenWorkspace}
            />
          )}
        </main>
      </div>
      {selectedCase && (
        <CaseDetail
          loanCase={selectedCase}
          user={user}
          onClose={() => setSelectedCaseId(null)}
          onOpenWorkspace={onOpenWorkspace}
        />
      )}
    </div>
  );
}

interface DashboardProps {
  user: AuthUser;
  conversations: Conversation[];
  approvals: ApprovalRow[];
  counts: Record<ConversationStatus, number>;
  chartData: Array<{ status: ConversationStatus; name: string; value: number; color: string }>;
  loading: boolean;
  onOpenWorkspace: () => void;
  onOpenCase: (id: string) => void;
  onOpenPipeline: () => void;
}

function DashboardView({
  user,
  conversations,
  approvals,
  counts,
  chartData,
  loading,
  onOpenWorkspace,
  onOpenCase,
  onOpenPipeline,
}: DashboardProps) {
  const currentAction = user.role === 'admin'
    ? approvals.length > 0
      ? `${approvals.length} yêu cầu đang chờ giám đốc chi nhánh`
      : counts.waiting_approval > 0
        ? `${counts.waiting_approval} hồ sơ cần xác nhận`
        : 'Không có hồ sơ cần quyết định ngay'
    : conversations.length > 0
      ? `${conversations.length} hồ sơ cần đánh giá lại`
      : 'Không có hồ sơ ngoại lệ cần đánh giá lại';

  return (
    <div className="portal__grid">
      <section className="portal__action-card">
        <div className="portal__action-icon"><FileClock size={24} /></div>
        <div>
          <span>Hành động ưu tiên</span>
          <h2>{currentAction}</h2>
          <p>
            {user.role === 'admin'
              ? 'Xem đầy đủ thông tin, tài liệu đính kèm và quyết định các hồ sơ được chuyển cấp.'
              : 'Hàng đợi chỉ gồm hồ sơ điểm thấp hoặc có lỗi nghiêm trọng do hệ thống chuyển lên.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const priority = conversations.find((item) => item.status === 'waiting_approval') ?? conversations[0];
            if (priority) onOpenCase(priority.id);
            else onOpenWorkspace();
          }}
        >
          Xem hồ sơ <ArrowRight size={16} />
        </button>
      </section>

      <MetricCard
        icon={Files}
        label={user.role === 'admin' ? 'Hồ sơ chi nhánh' : 'Cần đánh giá lại'}
        value={loading ? '—' : String(conversations.length)}
        helper={user.role === 'admin' ? 'Toàn bộ hồ sơ trong phạm vi chi nhánh' : 'Điểm thấp hoặc có lỗi nghiêm trọng'}
      />
      <MetricCard icon={Activity} label="Đang xử lý" value={loading ? '—' : String(counts.running)} helper="Đang ở bước đánh giá" tone="run" />
      <MetricCard icon={FileClock} label="Chờ xác nhận" value={loading ? '—' : String(counts.waiting_approval + approvals.length)} helper="Cần người có thẩm quyền xem xét" tone="warn" />
      <MetricCard icon={CheckCircle2} label="Đã hoàn tất" value={loading ? '—' : String(counts.done)} helper="Bao gồm hồ sơ tự động phê duyệt" tone="pass" />

      <section className="portal__card portal__card--chart">
        <CardHeading title="Số lượng hồ sơ theo tiến độ" icon={Activity} />
        <div className="portal__chart" aria-label="Biểu đồ số lượng hồ sơ theo tiến độ">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--bd)" strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fill: 'var(--mute)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--mute)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'var(--p2)' }} contentStyle={{ background: 'var(--p1)', border: '1px solid var(--bd)', borderRadius: 8, color: 'var(--tx)' }} />
              <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={42}>
                {chartData.map((entry) => <Cell key={entry.status} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="portal__card portal__card--distribution">
        <CardHeading title="Cơ cấu hồ sơ theo tiến độ" icon={Workflow} />
        <div className="portal__distribution">
          <div className="portal__donut" aria-label="Biểu đồ cơ cấu hồ sơ theo tiến độ">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={64} paddingAngle={2}>
                  {chartData.map((entry) => <Cell key={entry.status} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--p1)', border: '1px solid var(--bd)', borderRadius: 8, color: 'var(--tx)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="portal__legend">
            {chartData.map((entry) => (
              <div key={entry.status}>
                <span style={{ background: entry.color }} />
                <span>{entry.name}</span>
                <strong>{entry.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="portal__card portal__card--pipeline">
        <CardHeading
          title={user.role === 'admin' ? 'Hồ sơ gần đây' : 'Hồ sơ cần đánh giá lại'}
          icon={Workflow}
          action="Xem tất cả"
          onAction={onOpenPipeline}
        />
        <ConversationTable conversations={conversations.slice(0, 5)} loading={loading} onOpenCase={onOpenCase} />
      </section>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, helper, tone }: { icon: LucideIcon; label: string; value: string; helper: string; tone?: string }) {
  return (
    <section className={`portal__card portal__metric${tone ? ` portal__metric--${tone}` : ''}`}>
      <div className="portal__metric-head"><span>{label}</span><Icon size={18} /></div>
      <strong>{value}</strong>
      <small>{helper}</small>
    </section>
  );
}

function CardHeading({ title, icon: Icon, action, onAction }: { title: string; icon: LucideIcon; action?: string; onAction?: () => void }) {
  return (
    <div className="portal__card-heading">
      <div><Icon size={18} /><h2>{title}</h2></div>
      {action && <button type="button" onClick={onAction}>{action}</button>}
    </div>
  );
}

function PipelineView({
  conversations,
  loading,
  onOpenCase,
  user,
}: {
  conversations: Conversation[];
  loading: boolean;
  onOpenCase: (id: string) => void;
  user: AuthUser;
}) {
  const [filter, setFilter] = useState<ConversationStatus | 'all'>('all');
  const filtered = filter === 'all' ? conversations : conversations.filter((conversation) => conversation.status === filter);
  return (
    <section className="portal__card portal__pipeline-page">
      <div className="portal__pipeline-toolbar">
        <div>
          <CardHeading
            title={user.role === 'admin' ? 'Hồ sơ trong chi nhánh' : 'Hàng đợi đánh giá lại'}
            icon={Workflow}
          />
          <p className="portal__pipeline-description">
            {user.role === 'admin'
              ? 'Mở từng hồ sơ để xem thông tin cơ bản, kết quả đánh giá và toàn bộ tài liệu đính kèm.'
              : 'Hệ thống chỉ chuyển lên các hồ sơ dưới ngưỡng tự động hoặc có lỗi nghiêm trọng.'}
          </p>
        </div>
        <div className="portal__filters" aria-label="Lọc theo tiến độ hồ sơ">
          <button className={filter === 'all' ? 'is-active' : ''} type="button" onClick={() => setFilter('all')}>Tất cả</button>
          {(Object.keys(STATUS_META) as ConversationStatus[]).map((status) => (
            <button className={filter === status ? 'is-active' : ''} key={status} type="button" onClick={() => setFilter(status)}>
              {STATUS_META[status].label}
            </button>
          ))}
        </div>
      </div>
      <ConversationTable conversations={filtered} loading={loading} onOpenCase={onOpenCase} />
    </section>
  );
}

function ConversationTable({
  conversations,
  loading,
  onOpenCase,
}: {
  conversations: Conversation[];
  loading: boolean;
  onOpenCase: (id: string) => void;
}) {
  if (loading) return <div className="portal__table-state" role="status">Đang tải danh sách hồ sơ…</div>;
  if (conversations.length === 0) return <div className="portal__table-state">Không có hồ sơ phù hợp bộ lọc.</div>;
  return (
    <div className="portal__table-wrap">
      <table className="portal__table">
        <thead>
          <tr><th>Hồ sơ</th><th>Tiến độ</th><th>Ngày tiếp nhận</th><th><span className="sr-only">Thao tác</span></th></tr>
        </thead>
        <tbody>
          {conversations.map((conversation) => {
            const meta = STATUS_META[conversation.status];
            return (
              <tr key={conversation.id}>
                <td><strong>{conversation.title}</strong></td>
                <td><span className={`pill pill--${meta.tone}`}>{meta.label}</span></td>
                <td>{formatDate(conversation.created_at)}</td>
                <td><button type="button" onClick={() => onOpenCase(conversation.id)} aria-label={`Xem chi tiết hồ sơ ${conversation.title}`}><ArrowRight size={17} /></button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProductCatalogView() {
  return (
    <section className="portal__card portal__catalog">
      <div className="portal__catalog-heading">
        <CardHeading title="Sản phẩm vay đang tư vấn" icon={WalletCards} />
        <p>Dữ liệu minh họa được chuẩn hóa từ thông tin công khai trên website SHB; điều kiện thực tế có thể thay đổi theo từng thời kỳ.</p>
      </div>
      <div className="portal__catalog-grid">
        {SHB_LOAN_PRODUCTS.map((product) => (
          <article key={product.id}>
            <span>{product.supportsQuickCheck ? 'Có kiểm tra nhanh dưới 10 triệu' : 'Cần chuyên viên xem xét'}</span>
            <h3>{product.name}</h3>
            <p>{product.summary}</p>
            <dl>
              <div><dt>Hạn mức</dt><dd>{product.limitLabel}</dd></div>
              <div><dt>Thời hạn</dt><dd>{product.termLabel}</dd></div>
              <div><dt>Tài sản bảo đảm</dt><dd>{product.collateralLabel}</dd></div>
            </dl>
            <a href={product.sourceUrl} target="_blank" rel="noreferrer">Xem nguồn SHB <ArrowRight size={14} /></a>
          </article>
        ))}
      </div>
    </section>
  );
}

function PolicyView({
  activeRegion,
  canManage,
}: {
  activeRegion: RegionCode;
  canManage: boolean;
}) {
  const policy = SMALL_UNSECURED_POLICY;
  const serviceConfig = REGION_SERVICE_CONFIGS[activeRegion];
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const prioritizedProducts = serviceConfig.productPriorities
    .map((productId) => SHB_LOAN_PRODUCTS.find((product) => product.id === productId)?.name)
    .filter((name): name is string => Boolean(name));

  useEffect(() => {
    if (!draftOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDraftOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [draftOpen]);

  const saveDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const totalWeight = ['repaymentCapacity', 'incomeStability', 'paymentHistory']
      .map((field) => Number(form.get(field)))
      .reduce((sum, value) => sum + value, 0);
    if (totalWeight !== 100) {
      setDraftError('Tổng tỷ trọng phải bằng 100%.');
      return;
    }
    setDraftError(null);
    setDraftSaved(true);
    setDraftOpen(false);
  };

  return (
    <>
      {draftSaved && (
        <div className="portal__draft-saved" role="status">
          <CheckCircle2 size={16} />
          Đã lưu bản dự thảo trong phiên demo. Cấu hình đang áp dụng chưa thay đổi.
        </div>
      )}
      <div className="portal__policy-layout">
        <section className="portal__card portal__policy-summary">
          <div className="portal__policy-head">
            <CardHeading title="Bộ điều kiện tín dụng đang áp dụng" icon={ShieldCheck} />
            <div className="portal__policy-actions">
              <span className="portal__policy-unit"><MapPin size={14} /> {serviceConfig.label}</span>
              {canManage ? (
                <button type="button" onClick={() => setDraftOpen(true)}>
                  <FileClock size={14} /> Tạo bản dự thảo
                </button>
              ) : null}
            </div>
          </div>
          <div className="portal__policy-version">
            <div><span>Phiên bản</span><strong>{policy.version}</strong></div>
            <div><span>Hiệu lực từ</span><strong>{formatDate(policy.effectiveAt)}</strong></div>
            <div><span>Trạng thái</span><strong className="is-active">Đang áp dụng</strong></div>
          </div>
          <div className="portal__policy-rules">
            <PolicyRule label="Giới hạn kiểm tra nhanh" value={`Dưới ${formatCurrency(policy.quickCheckLimitVnd)}`} />
            <PolicyRule label="Độ tuổi tối thiểu" value={`${policy.minAge} tuổi`} />
            <PolicyRule label="Tuổi tối đa khi kết thúc khoản vay" value={`${policy.maxAgeAtMaturity} tuổi`} />
            <PolicyRule label="Thu nhập tối thiểu" value={`${formatCurrency(policy.minMonthlyIncomeVnd)}/tháng`} />
            <PolicyRule label="Tỷ lệ nghĩa vụ trả nợ tối đa" value={`${Math.round(policy.maxDebtToIncome * 100)}%`} />
          </div>
          <ScoreWeights weights={policy.weights} />
        </section>

        <section className="portal__card portal__policy-weights">
          <CardHeading title="Cấu hình phục vụ theo đơn vị" icon={SlidersHorizontal} />
          <p>Đơn vị được phép ưu tiên danh mục và thời gian phản hồi. Ngưỡng tín dụng dùng chung toàn quốc, không thay đổi theo khu vực.</p>
          <div className="portal__policy-service">
            <div><span>Đơn vị</span><strong>{serviceConfig.label}</strong></div>
            <div><span>Phiên bản cấu hình</span><strong>{serviceConfig.version}</strong></div>
            <div><span>Thời gian tiếp nhận mục tiêu</span><strong>Trong {serviceConfig.serviceSlaHours} giờ làm việc</strong></div>
          </div>
          <div className="portal__priority-products">
            <span>Sản phẩm ưu tiên tư vấn</span>
            {prioritizedProducts.map((name, index) => (
              <div key={name}><strong>{index + 1}</strong><span>{name}</span></div>
            ))}
          </div>
          <div className="portal__policy-warning">
            <CircleAlert size={17} />
            <p>Mọi thay đổi ngưỡng, trọng số hoặc điều kiện tín dụng phải được bộ phận Rủi ro và Pháp chế phê duyệt, có phiên bản và ngày hiệu lực.</p>
          </div>
        </section>
      </div>
      {draftOpen && canManage && (
        <div className="portal__draft-layer">
          <button
            type="button"
            className="portal__draft-scrim"
            aria-label="Đóng bản dự thảo"
            onClick={() => setDraftOpen(false)}
          />
          <form className="portal__draft-dialog" role="dialog" aria-modal="true" aria-labelledby="policy-draft-title" onSubmit={saveDraft}>
            <header>
              <div>
                <span>Bản dự thảo · chưa áp dụng</span>
                <h2 id="policy-draft-title">Điều chỉnh cấu hình</h2>
              </div>
              <button type="button" onClick={() => setDraftOpen(false)} aria-label="Đóng"><X size={18} /></button>
            </header>
            <div className="portal__draft-body">
              <label>
                <span>Đơn vị áp dụng</span>
                <input value={serviceConfig.label} readOnly />
              </label>
              <label>
                <span>Thời gian tiếp nhận mục tiêu (giờ làm việc)</span>
                <input name="serviceSlaHours" type="number" min="1" max="48" defaultValue={serviceConfig.serviceSlaHours} />
              </label>
              <div className="portal__draft-section">
                <strong>Tỷ trọng điểm hỗ trợ</strong>
                <p>Tỷ trọng dùng chung toàn hệ thống bán lẻ và không tự tạo quyết định phê duyệt.</p>
                <div>
                  <label><span>Khả năng trả nợ (%)</span><input name="repaymentCapacity" type="number" min="0" max="100" defaultValue={policy.weights.repaymentCapacity} /></label>
                  <label><span>Ổn định thu nhập (%)</span><input name="incomeStability" type="number" min="0" max="100" defaultValue={policy.weights.incomeStability} /></label>
                  <label><span>Lịch sử thanh toán (%)</span><input name="paymentHistory" type="number" min="0" max="100" defaultValue={policy.weights.paymentHistory} /></label>
                </div>
              </div>
              <label>
                <span>Ngày dự kiến áp dụng</span>
                <input name="effectiveAt" type="date" min="2026-07-20" defaultValue="2026-08-01" />
              </label>
              <div className="portal__draft-note">
                <ShieldCheck size={16} />
                Bản dự thảo phải qua kiểm soát Rủi ro và Pháp chế trước khi có thể áp dụng.
              </div>
              {draftError && <div className="portal__draft-error" role="alert">{draftError}</div>}
            </div>
            <footer>
              <button type="button" className="portal__outline-action" onClick={() => setDraftOpen(false)}>Hủy</button>
              <button type="submit" className="portal__primary-action">Lưu bản dự thảo</button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}

function ScoreWeights({ weights }: { weights: typeof SMALL_UNSECURED_POLICY.weights }) {
  const rows = [
    ['Khả năng trả nợ', weights.repaymentCapacity],
    ['Độ ổn định thu nhập', weights.incomeStability],
    ['Lịch sử thanh toán', weights.paymentHistory],
  ] as const;
  return (
    <div className="portal__score-weights">
      <div><strong>Tỷ trọng điểm hỗ trợ</strong><span>Không thay thế điều kiện bắt buộc</span></div>
      {rows.map(([label, value]) => (
        <div key={label}><span>{label}</span><strong>{value}%</strong></div>
      ))}
    </div>
  );
}

function PolicyRule({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function SettingsView({
  user,
  theme,
  onToggleTheme,
  onOpenWorkspace,
}: {
  user: AuthUser;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenWorkspace: () => void;
}) {
  return (
    <div className="portal__two-column">
      <section className="portal__card portal__settings-card">
        <CardHeading title="Giao diện" icon={Settings2} />
        <div className="portal__setting-row">
          <div><strong>Chế độ màu</strong><span>Đang áp dụng giao diện {theme === 'light' ? 'sáng' : 'tối'} cho toàn bộ trang quản lý.</span></div>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} className="portal__theme-wide" />
        </div>
      </section>
      {can(user, 'cases.review') ? (
        <section className="portal__card portal__settings-card">
          <CardHeading title="Khu vực xử lý hồ sơ" icon={Workflow} />
          <div className="portal__setting-row">
            <div><strong>Xử lý chuyên sâu</strong><span>Mở nơi nhân viên xem nội dung trao đổi và phối hợp xử lý hồ sơ.</span></div>
            <button type="button" className="portal__outline-action" onClick={onOpenWorkspace}>Mở khu vực xử lý <ArrowRight size={16} /></button>
          </div>
        </section>
      ) : null}
      <section className="portal__card portal__settings-card">
        <CardHeading title="Quyền truy cập" icon={ShieldCheck} />
        <div className="portal__setting-row">
          <div>
            <strong>{userRoleLabel(user.role)}</strong>
            <span>
              {can(user, 'policies.manage')
                ? 'Giám đốc chi nhánh được xem toàn bộ hồ sơ, tài liệu và xác nhận các trường hợp được chuyển cấp.'
                : 'Chỉ đánh giá lại hồ sơ có điểm thấp hoặc lỗi nghiêm trọng do hệ thống chuyển lên.'}
            </span>
          </div>
          <span className="pill pill--pass">Đang hoạt động</span>
        </div>
      </section>
    </div>
  );
}

function CaseDetail({
  loanCase,
  user,
  onClose,
  onOpenWorkspace,
}: {
  loanCase: DemoLoanCase;
  user: AuthUser;
  onClose: () => void;
  onOpenWorkspace: () => void;
}) {
  const status = STATUS_META[loanCase.conversation.status];
  const attachments = caseAttachments(loanCase);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  return (
    <div className="portal__case-layer">
      <button className="portal__case-scrim" type="button" aria-label="Đóng chi tiết hồ sơ" onClick={onClose} />
      <section className="portal__case-detail" role="dialog" aria-modal="true" aria-labelledby="case-detail-title">
        <header className="portal__case-header">
          <button type="button" onClick={onClose} aria-label="Quay lại danh sách hồ sơ"><ChevronLeft size={19} /></button>
          <div>
            <span>{loanCase.applicationCode}</span>
            <h2 id="case-detail-title">{loanCase.customerName}</h2>
            <p>{loanCase.productName} · {formatCurrency(loanCase.amountVnd)} · {loanCase.termMonths} tháng</p>
          </div>
          <span className={`pill pill--${status.tone}`}>{status.label}</span>
          <button type="button" onClick={onClose} aria-label="Đóng"><X size={19} /></button>
        </header>

        <div className="portal__case-body">
          <CaseDecisionSummary loanCase={loanCase} />

          <div className="portal__case-facts">
            <CaseFact icon={WalletCards} label="Sản phẩm" value={loanCase.productName} />
            <CaseFact icon={MapPin} label="Đơn vị xử lý" value={loanCase.unitName} />
            <CaseFact icon={UserRound} label="Nhân viên phụ trách" value={loanCase.ownerName} />
            <CaseFact icon={BookOpenCheck} label="Chính sách áp dụng" value={loanCase.policyVersion} />
            <CaseFact
              icon={loanCase.customerDataVerified ? FileCheck2 : CircleAlert}
              label="Dữ liệu khách hàng"
              value={loanCase.customerDataVerified ? 'Đã xác thực' : 'Cần xác minh lại'}
            />
          </div>

          <section className="portal__case-panel portal__case-panel--attachments">
            <CardHeading title={`Tài liệu đính kèm (${attachments.length})`} icon={Files} />
            <div className="portal__attachment-list">
              {attachments.map((attachment) => (
                <article key={attachment.id}>
                  <span className="portal__attachment-icon"><FileText size={18} /></span>
                  <div>
                    <strong>{attachment.title}</strong>
                    <span>{attachment.fileName} · {attachment.sizeLabel}</span>
                  </div>
                  <span className={`pill ${attachment.verification === 'verified' ? 'pill--pass' : 'pill--warn'}`}>
                    {attachment.verification === 'verified' ? 'Đã đối chiếu' : 'Cần kiểm tra'}
                  </span>
                </article>
              ))}
            </div>
          </section>

          <div className="portal__case-columns">
            <section className="portal__case-panel">
              <CardHeading title="Khả năng trả nợ" icon={CircleGauge} />
              <dl className="portal__case-metrics">
                <div><dt>Thu nhập khai báo</dt><dd>{formatCurrency(loanCase.monthlyIncomeVnd)}/tháng</dd></div>
                <div><dt>Nghĩa vụ trả nợ hiện tại</dt><dd>{formatCurrency(loanCase.monthlyDebtVnd)}/tháng</dd></div>
                <div><dt>Tỷ lệ nghĩa vụ trên thu nhập</dt><dd>{Math.round(loanCase.debtToIncome * 100)}%</dd></div>
                <div><dt>Lịch sử thanh toán</dt><dd>{loanCase.paymentHistory}</dd></div>
              </dl>
            </section>
            <section className="portal__case-panel">
              <CardHeading title="Điểm cần quan tâm" icon={ShieldCheck} />
              <div className="portal__case-notes">
                {loanCase.strengths.map((item) => <p className="is-positive" key={item}><CheckCircle2 size={15} /> {item}</p>)}
                {loanCase.attentionPoints.map((item) => <p className="is-warning" key={item}><CircleAlert size={15} /> {item}</p>)}
                {loanCase.seriousIssues.map((item) => <p className="is-critical" key={item}><CircleAlert size={15} /> {item}</p>)}
              </div>
            </section>
          </div>

          <div className="portal__case-columns">
            <section className="portal__case-panel">
              <CardHeading title="Phạm vi quyết định hiện tại" icon={ShieldCheck} />
              <div className="portal__decision-scope">
                <div>
                  <span>Cấp có thẩm quyền</span>
                  <strong>Giám đốc chi nhánh</strong>
                </div>
                <p>Các cấp phê duyệt cao hơn và luồng chuyển Hội sở chưa nằm trong phạm vi triển khai hiện tại.</p>
              </div>
            </section>
            <section className="portal__case-panel">
              <CardHeading title="Lịch sử xử lý" icon={Workflow} />
              <ol className="portal__timeline">
                {loanCase.timeline.map((item) => (
                  <li className={`is-${item.state}`} key={`${item.label}-${item.at}`}>
                    <span />
                    <div><strong>{item.label}</strong><small>{item.at}</small></div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>

        <footer className="portal__case-footer">
          <button type="button" className="portal__outline-action" onClick={onClose}>Quay lại danh sách</button>
          <CaseFooterAction loanCase={loanCase} user={user} onOpenWorkspace={onOpenWorkspace} />
        </footer>
      </section>
    </div>
  );
}

function CaseDecisionSummary({ loanCase }: { loanCase: DemoLoanCase }) {
  if (loanCase.decisionRoute === 'auto_approved') {
    return (
      <section className="portal__case-recommendation portal__case-recommendation--approved">
        <div>
          <span>Kết quả tự động</span>
          <h3>{loanCase.recommendationLabel}</h3>
          <p>Dữ liệu khách hàng đã xác thực, không có lỗi nghiêm trọng và điểm chính sách đạt ngưỡng tự động.</p>
        </div>
        <CaseScore score={loanCase.policyScore} />
      </section>
    );
  }

  if (loanCase.decisionRoute === 'staff_reassessment') {
    return (
      <section className="portal__case-recommendation portal__case-recommendation--review">
        <div>
          <span>Hệ thống đã chuyển cấp</span>
          <h3>{loanCase.recommendationLabel}</h3>
          <p>Hồ sơ không đủ điều kiện tự động phê duyệt do điểm thấp hoặc có lỗi nghiêm trọng cần xác minh.</p>
        </div>
        <CaseScore score={loanCase.policyScore} />
      </section>
    );
  }

  return (
    <section className="portal__case-recommendation portal__case-recommendation--manager">
      <div>
        <span>Chờ xác nhận có thẩm quyền</span>
        <h3>{loanCase.recommendationLabel}</h3>
        <p>Nhân viên đã rà soát ngoại lệ; hồ sơ đang chờ giám đốc chi nhánh xác nhận quyết định vay.</p>
      </div>
      <CaseScore score={loanCase.policyScore} />
    </section>
  );
}

function CaseScore({ score }: { score: number }) {
  return (
    <div className="portal__case-score">
      <CircleGauge size={22} />
      <span>Điểm chính sách</span>
      <strong>{score}<small>/100</small></strong>
    </div>
  );
}

function CaseFooterAction({
  loanCase,
  user,
  onOpenWorkspace,
}: {
  loanCase: DemoLoanCase;
  user: AuthUser;
  onOpenWorkspace: () => void;
}) {
  if (loanCase.decisionRoute === 'auto_approved') return null;
  if (!can(user, 'cases.review') && !can(user, 'cases.approve')) return null;

  const label = loanCase.decisionRoute === 'branch_manager_review' && can(user, 'cases.approve')
    ? 'Xem và xác nhận hồ sơ'
    : user.role === 'admin'
      ? 'Theo dõi đánh giá lại'
      : 'Mở đánh giá lại';

  return (
    <button type="button" className="portal__primary-action" onClick={onOpenWorkspace}>
      {label}
      <ArrowRight size={16} />
    </button>
  );
}

function CaseFact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div><Icon size={17} /><span>{label}</span><strong>{value}</strong></div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}
