// components.test.tsx — render test cho MessageBubble + StreamingMessageBubble + TaskBadge.
// Presentational thuần → assert DOM/class theo sender/status. Độc lập BE.
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MessageBubble, StreamingMessageBubble } from './MessageBubble';
import { TaskBadge } from './TaskBadge';
import type { Message, OrchTask } from '../types';

const msg = (sender: Message['sender'], content: string): Message => ({
  id: 'm', conv_id: 'c1', ts: '', sender, content, meta: null,
});
const task = (status: OrchTask['status'], role = 'credit'): OrchTask => ({
  id: 't', conv_id: 'c1', role, title: 'x', status,
});

describe('MessageBubble', () => {
  it('user → class --user + text', () => {
    const { container } = render(<MessageBubble msg={msg('user', 'Xin chào')} />);
    expect(screen.getByText('Xin chào')).toBeInTheDocument();
    expect(container.querySelector('.msg-bubble--user')).toBeTruthy();
  });

  it('assistant → class --assistant', () => {
    const { container } = render(<MessageBubble msg={msg('assistant', 'DSCR = 3.709')} />);
    expect(container.querySelector('.msg-bubble--assistant')).toBeTruthy();
    expect(screen.getByText(/DSCR = 3\.709/)).toBeInTheDocument();
  });

  it('system → class --note', () => {
    const { container } = render(<MessageBubble msg={msg('system', 'ghi chú hệ thống')} />);
    expect(container.querySelector('.msg-bubble--note')).toBeTruthy();
    expect(container.querySelector('.msg-bubble--note-error')).toBeFalsy();
  });

  it('system + meta.error → variant --note-error (CONTRACT §4b main fail)', () => {
    const m: Message = { ...msg('system', '⚠ MAIN hết trần retry'), meta: { error: true } };
    const { container } = render(<MessageBubble msg={m} />);
    expect(container.querySelector('.msg-bubble--note-error')).toBeTruthy();
  });

  it('streaming bubble → có cursor + testid', () => {
    render(<StreamingMessageBubble bubble={{ turnId: 't1', text: 'đang gõ' }} />);
    const el = screen.getByTestId('streaming-bubble');
    expect(el).toHaveTextContent('đang gõ');
    expect(el.querySelector('.msg-bubble__cursor')).toBeTruthy();
  });
});

describe('TaskBadge', () => {
  it('running → dot + nhãn "đang xử lý…" + tone run', () => {
    const { container } = render(<TaskBadge task={task('running')} />);
    expect(screen.getByText(/đang xử lý/)).toBeInTheDocument();
    expect(container.querySelector('.task-badge--run')).toBeTruthy();
    expect(container.querySelector('.task-badge__dot')).toBeTruthy();
  });

  it('done → "✓ hoàn tất" + tone pass, không có dot chạy', () => {
    const { container } = render(<TaskBadge task={task('done')} />);
    expect(screen.getByText(/✓ hoàn tất/)).toBeInTheDocument();
    expect(container.querySelector('.task-badge--pass')).toBeTruthy();
    expect(container.querySelector('.task-badge__dot')).toBeFalsy();
  });

  it('failed → "✗ cần kiểm tra" + tone fail', () => {
    const { container } = render(<TaskBadge task={task('failed')} />);
    expect(screen.getByText(/✗ cần kiểm tra/)).toBeInTheDocument();
    expect(container.querySelector('.task-badge--fail')).toBeTruthy();
  });

  it('role Việt hoá: credit → "Thẩm định tín dụng"', () => {
    render(<TaskBadge task={task('running', 'credit')} />);
    expect(screen.getByText(/Thẩm định tín dụng/)).toBeInTheDocument();
  });

  it('role động lạ → dùng nhãn nghiệp vụ an toàn', () => {
    render(<TaskBadge task={task('running', 'risk')} />);
    expect(screen.getByText(/Bộ phận nghiệp vụ/)).toBeInTheDocument();
  });
});
