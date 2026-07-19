// ControlTower.tsx — màn admin (deliverable #4 · SPEC §12/§13). 4 khối: approval queue (duyệt tại
// chỗ) · audit view (filter) · cost meter (tasks.cost per-turn) · trạng thái agent (conv/tasks).
// Data: GET /api/approvals?pending · GET /api/audit?filters · GET /api/conversations. Admin (D-19).
// Look-and-feel tham khảo design/Digital Expert Guild.dc.html Tower (D-13).
import { useCallback, useEffect, useState } from 'react';
import { conversationApi } from '../api';
import { ApiRequestError } from '../api/client';
import { useApprovalBadge } from '../hooks/useApprovalBadge';
import { roleLabel } from '../roles';
import type { ApprovalRow, AuditRow, CompareResult, CompareSide, Conversation } from '../types';
import { activityLabel, approvalActionLabel } from '../uiCopy';
import './ControlTower.css';

type Tab = 'queue' | 'audit' | 'agents' | 'compare';

export function ControlTower({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('queue');
  // ControlTower chỉ render cho admin (App gate) → poll badge phiếu-bay luôn bật. Số nổi trên tab queue.
  const pending = useApprovalBadge(true);
  return (
    <div className="ct">
      <header className="ct__head">
        <button type="button" className="ct__back" onClick={onBack}>← Quay lại</button>
        <span className="ct__title">Trung tâm giám sát</span>
        <span className="ct__sub">Phê duyệt · nhật ký hoạt động · tổng hợp vận hành</span>
        <div className="ct__tabs">
          {(['queue', 'audit', 'agents', 'compare'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`ct__tab${tab === t ? ' ct__tab--active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'queue' ? 'Phê duyệt' : t === 'audit' ? 'Nhật ký hoạt động' : t === 'agents' ? 'Tiến độ xử lý' : 'Đối chiếu kết quả'}
              {t === 'queue' && pending > 0 && (
                <span className="ct__tab-badge" data-testid="ct-queue-badge">{pending}</span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="ct__body" data-scroll>
        {tab === 'queue' && <ApprovalQueue />}
        {tab === 'audit' && <AuditView />}
        {tab === 'agents' && <AgentStatus />}
        {tab === 'compare' && <CompareView />}
      </div>
    </div>
  );
}

// ── Khối 1: Approval queue — list phiếu pending + duyệt tại chỗ ──
function ApprovalQueue() {
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    conversationApi
      .listApprovals('pending')
      .then((r) => { setRows(r); setError(null); })
      .catch(() => setError('Chưa tải được danh sách chờ phê duyệt. Vui lòng thử lại.'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const decide = (row: ApprovalRow, decision: 'approved' | 'rejected') => {
    setBusyId(row.id);
    conversationApi
      .decideApproval(row.id, decision, '')
      .then(() => { setRows((prev) => prev.filter((r) => r.id !== row.id)); }) // rời khỏi hàng chờ
      .catch((e: unknown) => {
        if (e instanceof ApiRequestError && e.status === 409) { setRows((prev) => prev.filter((r) => r.id !== row.id)); }
        else setError('Chưa ghi nhận được quyết định. Vui lòng thử lại.');
      })
      .finally(() => setBusyId(null));
  };

  return (
    <div className="ct__section">
      <div className="ct__section-head">
        <span className="ct__section-title">Yêu cầu chờ phê duyệt ({rows.length})</span>
        <button type="button" className="ct__refresh" onClick={load}>Tải lại</button>
      </div>
      {error && <div className="ct__error">{error}</div>}
      {rows.length === 0 ? (
        <div className="ct__empty" data-testid="queue-empty">Không có yêu cầu nào chờ phê duyệt.</div>
      ) : (
        <div className="ct__rows">
          {rows.slice(0, 50).map((row) => (
            <div key={row.id} className="ct__appr-row" data-testid={`queue-row-${row.id}`}>
              <span className="ct__appr-action">{approvalActionLabel(row.action)}</span>
              <span className="ct__appr-conv">Hồ sơ {shortId(row.conv_id)}</span>
              <span className="ct__appr-payload">Đang chờ quyết định của quản lý</span>
              <div className="ct__appr-btns">
                <button type="button" className="btn btn--ok ct__appr-btn" onClick={() => decide(row, 'approved')} disabled={busyId === row.id}>✓ Duyệt</button>
                <button type="button" className="btn btn--danger ct__appr-btn" onClick={() => decide(row, 'rejected')} disabled={busyId === row.id}>✗ Từ chối</button>
              </div>
            </div>
          ))}
          {rows.length > 50 && <div className="ct__more">Còn {rows.length - 50} yêu cầu khác chưa hiển thị.</div>}
        </div>
      )}
    </div>
  );
}

// ── Khối 2: Audit view — filter tool_calls ──
function AuditView() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [convId, setConvId] = useState('');
  const [tool, setTool] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const filters: Record<string, string> = {};
    if (convId.trim()) filters.conv_id = convId.trim();
    if (tool.trim()) filters.tool = tool.trim();
    conversationApi
      .auditFiltered(filters)
      .then((r) => { setRows(r); setError(null); })
      .catch(() => setError('Chưa tải được nhật ký hoạt động. Vui lòng thử lại.'));
  }, [convId, tool]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="ct__section">
      <div className="ct__section-head">
        <span className="ct__section-title">Nhật ký hoạt động ({rows.length})</span>
        <input className="ct__filter" placeholder="Mã hồ sơ…" value={convId} onChange={(e) => setConvId(e.target.value)} aria-label="Lọc theo mã hồ sơ" />
        <input className="ct__filter" placeholder="Nội dung hoạt động…" value={tool} onChange={(e) => setTool(e.target.value)} aria-label="Lọc theo nội dung hoạt động" />
      </div>
      {error && <div className="ct__error">{error}</div>}
      {rows.length === 0 ? (
        <div className="ct__empty">Chưa có hoạt động phù hợp với điều kiện lọc.</div>
      ) : (
        <table className="ct__audit">
          <thead><tr><th>Thời điểm</th><th>Bộ phận</th><th>Hoạt động</th><th>Thông tin liên quan</th></tr></thead>
          <tbody>
            {rows.slice(0, 100).map((r) => (
              <tr key={r.id}>
                <td className="ct__audit-ts">{fmtTs(r.ts)}</td>
                <td className="ct__audit-actor">{r.actor === 'main' ? 'Điều phối hồ sơ' : roleLabel(r.actor)}</td>
                <td><span className="ct__audit-tool">{activityLabel(r.tool)}</span></td>
                <td className="ct__audit-in">{formatAuditDetails(r.input)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Khối 3+4: Trạng thái đội + cost meter (từ conversations + tasks) ──
function AgentStatus() {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    conversationApi
      .listConversations()
      .then((c) => { setConvs(c); setError(null); })
      .catch(() => setError('Chưa tải được tiến độ hồ sơ. Vui lòng thử lại.'));
  }, []);

  const byStatus = convs.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="ct__section">
      <div className="ct__section-title">Tiến độ xử lý — {convs.length} hồ sơ</div>
      {error && <div className="ct__error">{error}</div>}
      <div className="ct__stat-grid">
        {(['running', 'waiting_approval', 'done', 'failed', 'idle'] as const).map((s) => (
          <div key={s} className={`ct__stat ct__stat--${s}`}>
            <div className="ct__stat-num">{byStatus[s] ?? 0}</div>
            <div className="ct__stat-label">{STATUS_LABEL[s]}</div>
          </div>
        ))}
      </div>
      <div className="ct__note">
        Số liệu được tổng hợp theo từng hồ sơ và cập nhật theo tiến độ xử lý gần nhất.
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  running: 'Đang thẩm định',
  waiting_approval: 'Chờ phê duyệt',
  done: 'Hoàn tất',
  failed: 'Cần bổ sung',
  idle: 'Mới tiếp nhận',
};

// ── Deliverable #5: compare single-agent vs multi-agent (2 cột) ──
function CompareView() {
  const [question, setQuestion] = useState('Khách C001 vay 500 triệu được không?');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    if (running || !question.trim()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    conversationApi
      .runCompare(question.trim())
      .then((r) => setResult(r))
      .catch(() => setError('Chưa hoàn tất đối chiếu. Vui lòng thử lại sau.'))
      .finally(() => setRunning(false));
  };

  return (
    <div className="ct__section">
      <div className="ct__section-title">Đối chiếu kết quả hỗ trợ thẩm định</div>
      <div className="ct__cmp-input">
        <input
          className="ct__cmp-q"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Câu hỏi thẩm định…"
          aria-label="Câu hỏi so sánh"
          disabled={running}
        />
        <button type="button" className="btn btn--primary ct__cmp-run" onClick={run} disabled={running} data-testid="compare-run">
          {running ? 'Đang đối chiếu…' : 'Bắt đầu đối chiếu'}
        </button>
      </div>
      {running && <div className="ct__cmp-loading">Đang tổng hợp kết quả từ hai phương thức hỗ trợ. Quá trình này có thể mất khoảng 90 giây.</div>}
      {error && <div className="ct__error">{error}</div>}
      {result && (
        <div className="ct__cmp-cols">
          <CompareColumn title="Phương thức cơ bản" side={result.single} accent="single" />
          <CompareColumn title="Phối hợp chuyên môn" side={result.multi} accent="multi" />
        </div>
      )}
    </div>
  );
}

function CompareColumn({ title, side, accent }: { title: string; side: CompareSide | null | undefined; accent: 'single' | 'multi' }) {
  if (!side) {
    return (
      <div className={`ct__cmp-col ct__cmp-col--${accent}`}>
        <div className="ct__cmp-col-title">{title}</div>
        <div className="ct__cmp-partial">Chưa có kết quả từ phương thức này.</div>
      </div>
    );
  }
  return (
    <div className={`ct__cmp-col ct__cmp-col--${accent}`}>
      <div className="ct__cmp-col-title">{title}</div>
      <div className="ct__cmp-metrics">
        {side.duration_s != null && <span className="ct__cmp-metric">Thời gian: {side.duration_s} giây</span>}
        {side.tool_calls != null && <span className="ct__cmp-metric">{side.tool_calls} bước xử lý</span>}
        {side.cards != null && <span className="ct__cmp-metric">{side.cards} kết quả tổng hợp</span>}
      </div>
      <div className="ct__cmp-text">{side.text ?? '(không có nội dung)'}</div>
      {side.conv_id && <div className="ct__cmp-link">Hồ sơ tham chiếu: {shortId(side.conv_id)}</div>}
    </div>
  );
}

function shortId(id: string): string {
  return id.length > 14 ? `${id.slice(0, 10)}…` : id;
}
function formatAuditDetails(input: Record<string, unknown> | null | undefined): string {
  if (!input) return 'Đã ghi nhận';
  const customerId = input.customer_id ?? input.owner_id;
  if (typeof customerId === 'string' && customerId.trim()) {
    return `Mã khách hàng: ${customerId}`;
  }
  return 'Đã ghi nhận';
}
function fmtTs(ts: string): string {
  return ts ? ts.slice(0, 19).replace('T', ' ') : '';
}
