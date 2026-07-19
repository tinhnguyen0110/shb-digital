// SubAgentView.tsx — F2a (D-43 MUST): click sub → view FULL của sub thay vùng canvas.
// header (role+status+title) · brief (input) · trace timeline (audit persist + live SSE thinking/toolcall
// theo task_id) · result · nút Huỷ (khi running) · quay lại. Sub one-shot → KHÔNG chat 2 chiều (F2b sau).
// Look-and-feel tham khảo design/workspace/chat.jsx SubAgentView (D-13).
import { useEffect, useState } from 'react';
import { conversationApi } from '../api';
import { ApiRequestError } from '../api/client';
import { roleLabel } from '../roles';
import { activityLabel } from '../uiCopy';
import type { AuditRow, OrchTask, TraceItem } from '../types';
import './SubAgentView.css';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  queued: { label: '● Chờ tiếp nhận', cls: 'sav__status--run' },
  running: { label: '● Đang xử lý…', cls: 'sav__status--run' },
  done: { label: '✓ Hoàn tất — đã cập nhật hồ sơ', cls: 'sav__status--done' },
  failed: { label: '✗ Cần kiểm tra', cls: 'sav__status--fail' },
};

// gộp audit rows (persist) + live trace (SSE theo task_id) → 1 danh sách dòng, dedup toolcall theo id.
function mergeTrace(audit: AuditRow[], live: TraceItem[]): TraceItem[] {
  const out: TraceItem[] = audit.map((a) => ({ kind: 'tool', id: a.id, task_id: a.task_id, tool: a.tool, summary: summarizeInput(a.input) }));
  const seen = new Set(out.filter((o) => o.kind === 'tool').map((o) => o.id));
  for (const item of live) {
    if (item.kind === 'tool' && seen.has(item.id)) continue; // đã có từ audit
    out.push(item);
  }
  return out;
}

function summarizeInput(input: Record<string, unknown> | null | undefined): string {
  if (!input) return '';
  try {
    return JSON.stringify(input).slice(0, 120);
  } catch {
    return '';
  }
}

function taskResult(task: OrchTask): string | null {
  const r = task.result;
  if (!r) return null;
  if (typeof r.reason === 'string') return r.reason;
  try {
    return JSON.stringify(r, null, 2);
  } catch {
    return null;
  }
}

interface Props {
  task: OrchTask;
  liveTrace: TraceItem[]; // trace items live (SSE) đã filter theo task_id ở Workspace
  convId: string;
  onBack: () => void;
}

export function SubAgentView({ task, liveTrace, convId, onBack }: Props) {
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // trace persist: GET /api/audit?task_id (sub done vẫn xem được — audit không mất).
  useEffect(() => {
    let alive = true;
    conversationApi
      .auditByTask(task.id)
      .then((rows) => { if (alive) setAudit(rows); })
      .catch(() => { /* audit lỗi không chí mạng — live trace vẫn hiển thị */ });
    return () => { alive = false; };
  }, [task.id]);

  const meta = STATUS_META[task.status] ?? STATUS_META.queued;
  const trace = mergeTrace(audit, liveTrace);
  const result = taskResult(task);
  const running = task.status === 'running' || task.status === 'queued';

  const cancel = () => {
    if (cancelling) return;
    setCancelling(true);
    setError(null);
    conversationApi
      .interruptTask(convId, task.id)
      .catch((err: unknown) => {
        if (err instanceof ApiRequestError && err.status === 409) {
          setError('Nội dung này đã hoàn tất hoặc không còn có thể dừng.');
        } else {
          setError('Chưa thể dừng xử lý. Vui lòng thử lại.');
        }
      })
      .finally(() => setCancelling(false));
  };

  return (
    <section className="sav" data-testid="subagent-view">
      <div className="sav__head">
        <button type="button" className="sav__back" onClick={onBack} aria-label="Quay lại">←</button>
        <div className="sav__head-main">
          <div className="sav__title">{roleLabel(task.role)}</div>
          <div className={`sav__status ${meta.cls}`}>{meta.label}</div>
        </div>
        {running && (
          <button type="button" className="btn btn--danger sav__cancel" onClick={cancel} disabled={cancelling} data-testid="sub-cancel">
            {cancelling ? 'Đang dừng…' : 'Dừng xử lý'}
          </button>
        )}
      </div>

      <div className="sav__body" data-scroll>
        <div className="sav__section">
          <div className="sav__label">NHIỆM VỤ</div>
          <div className="sav__brief">{task.title}</div>
        </div>

        {error && <div className="sav__error" role="alert">{error}</div>}

        <div className="sav__section">
          <div className="sav__label">NHẬT KÝ XỬ LÝ ({trace.length})</div>
          {trace.length === 0 ? (
            <div className="sav__empty">
              {running ? 'Bộ phận đang tiếp nhận nội dung.' : 'Chưa có cập nhật xử lý.'}
            </div>
          ) : (
            <div className="sav__trace">
              {trace.map((it, i) => (
                <div key={`${it.id}-${i}`} className={`sav__row sav__row--${it.kind}`}>
                  <span className="sav__row-icon" aria-hidden="true">{it.kind === 'thinking' ? '🧠' : '🔧'}</span>
                  {it.kind === 'thinking' ? (
                    <span className="sav__row-text">Đang phân tích thông tin hồ sơ</span>
                  ) : (
                    <span className="sav__row-tool">{activityLabel(it.tool)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {result && (
          <div className="sav__section">
            <div className="sav__label">KẾT QUẢ</div>
            <pre className="sav__result">{result}</pre>
          </div>
        )}
      </div>
    </section>
  );
}
