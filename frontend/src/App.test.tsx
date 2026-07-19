// App.test.tsx — vòng lõi chat qua mock API (VITE_USE_MOCK_API mặc định bật trong test).
// Chứng minh: tạo ca → gõ câu C001 → mock stream chat.delta + task credit → DSCR 3.709 render +
// badge task "xong". Bổ trợ Chrome verify (không thay thế — Gate 2 vẫn đòi browser).
// Test Workspace TRỰC TIẾP (auth gate ở App = test riêng App.gate.test.tsx) — inject user giả.
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Workspace } from './Workspace';
import { mockBackend } from './api/mock';
import type { AuthUser } from './types';

const USER: AuthUser = { username: 'user', role: 'user' };
const CUSTOMER: AuthUser = { username: 'c001', role: 'customer', owner_id: 'C001' };
const noop = vi.fn();

// mockBackend singleton → reset giữa test để rooms/tasks không leak (ca cũ auto-select lúc mount).
afterEach(() => mockBackend.reset());

describe('Workspace chat — vòng lõi S1 (mock API)', () => {
  it('tạo ca → gõ câu C001 → hiển thị DSCR 3.709 + badge Tín dụng xong', async () => {
    render(<Workspace user={USER} onAuthExpired={noop} />);

    // ban đầu: empty state
    expect(screen.getByText(/Chưa mở hồ sơ nào/i)).toBeInTheDocument();

    // "+ Ca mới" → khung soạn (draft): composer + picker hiện, ca CHƯA tạo (lazy — D-45b)
    fireEvent.click(screen.getByRole('button', { name: /Hồ sơ mới/i }));

    // ô nhập xuất hiện (draft mode)
    const input = await screen.findByLabelText('Ô nhập câu hỏi');
    fireEvent.change(input, { target: { value: 'Khách C001 xin vay 5 tỷ — DSCR bao nhiêu?' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // gửi câu đầu → ca tạo lazy → user message hiện (optimistic, sau POST create — dùng findBy async)
    expect(await screen.findByText(/Khách C001 xin vay 5 tỷ/)).toBeInTheDocument();

    // chờ tới khi stream chạy XONG câu trả lời (credit_assess đứng sau DSCR trong answer —
    // chờ nó đảm bảo cả DSCR 3.709 + nguồn đều đã render). Số kèm nguồn — SPEC §6.
    await waitFor(
      () => expect(screen.getAllByText(/DSCR = 3\.709/).length).toBeGreaterThan(0),
      { timeout: 5000 },
    );
    expect(screen.getAllByText(/DSCR = 3\.709/).length).toBeGreaterThan(0);

    // badge task credit chuyển "xong"
    const tasksPanel = screen.getByLabelText('Tiến độ phối hợp xử lý');
    await waitFor(() =>
      expect(within(tasksPanel).getByText(/Thẩm định tín dụng · ✓ hoàn tất/)).toBeInTheDocument(),
    );
  });

  it('câu không liên quan tín dụng → vẫn stream trả lời, không tạo task credit', async () => {
    render(<Workspace user={USER} onAuthExpired={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /Hồ sơ mới/i }));
    const input = await screen.findByLabelText('Ô nhập câu hỏi');
    fireEvent.change(input, { target: { value: 'Xin chào' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(
      () => expect(screen.getByText(/Nội dung đã được ghi nhận/i)).toBeInTheDocument(),
      { timeout: 5000 },
    );
    // không có bảng task
    expect(screen.queryByLabelText('Tiến độ phối hợp xử lý')).not.toBeInTheDocument();
  });

  it('mở ca CÓ SẴN → hydrate trace toolcall từ GET /api/audit (reload-safe T4-2 fix)', async () => {
    // seed 1 ca sẵn trong mock → mở lại ca đó (click sidebar) → auditByConv hydrate trace.
    // (flow lazy-create D-45b: "+ Ca mới" chỉ mở draft, KHÔNG open ca — hydrate test qua MỞ ca có sẵn.)
    const seeded = mockBackend.createConversation('Ca có sẵn');
    const { conversationApi } = await import('./api');
    vi.spyOn(conversationApi, 'auditByConv').mockResolvedValue([
      { id: 'au_reload', task_id: 't1', conv_id: seeded.id, ts: '', actor: 'credit', tool: 'credit_assess', input: { owner_id: 'C001' }, output: {} },
    ]);
    const { container } = render(<Workspace user={USER} onAuthExpired={noop} />);
    // click ca có sẵn trong SIDEBAR (title xuất hiện cả ở chat-head khi active) → openConversation
    // → auditByConv → setTrace → TraceBlock hiện
    await waitFor(() => expect(container.querySelector('.conv-sidebar__title')).toBeInTheDocument());
    fireEvent.click(container.querySelector('.conv-sidebar__title')!);
    await waitFor(() => expect(screen.getByTestId('trace-block')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByText('Đánh giá thông tin tín dụng')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('SUB fail (§4b Gap2 A) → badge failed + render task.result.reason + badge ca "Lỗi"', async () => {
    render(<Workspace user={USER} onAuthExpired={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /Hồ sơ mới/i }));
    const input = await screen.findByLabelText('Ô nhập câu hỏi');
    fireEvent.change(input, { target: { value: 'C001 vay — credit fail đi' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // reason từ task.result.reason hiển thị (không phải chỉ badge)
    await waitFor(
      () => expect(screen.getByText(/Nội dung chưa hoàn tất/i)).toBeInTheDocument(),
      { timeout: 5000 },
    );
    // badge task đỏ
    const tasksPanel = screen.getByLabelText('Tiến độ phối hợp xử lý');
    expect(within(tasksPanel).getByText(/Thẩm định tín dụng · ✗ cần kiểm tra/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(/^Cần bổ sung$/).length).toBeGreaterThan(0));
  });

  it('MAIN fail (§4b Gap2 B) → system message lỗi + badge ca "Lỗi", KHÔNG treo bubble streaming', async () => {
    render(<Workspace user={USER} onAuthExpired={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /Hồ sơ mới/i }));
    const input = await screen.findByLabelText('Ô nhập câu hỏi');
    fireEvent.change(input, { target: { value: 'lỗi main mô phỏng quá tải' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // nội dung lỗi hiển thị (đến qua chat.delta done full_text — §4b Gap2 B)
    await waitFor(
      () => expect(screen.getByText(/Quá trình xử lý chưa hoàn tất/i)).toBeInTheDocument(),
      { timeout: 5000 },
    );
    // bubble streaming đã đóng (done kết lượt — không treo)
    await waitFor(() => expect(screen.queryByTestId('streaming-bubble')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByText(/^Cần bổ sung$/).length).toBeGreaterThan(0));
  });

  it('customer không thấy model/trace/lobby kỹ thuật và vẫn gửi thêm khi ca đang chạy', async () => {
    render(<Workspace user={CUSTOMER} onAuthExpired={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /Hồ sơ mới/i }));

    expect(screen.queryByLabelText('Chọn phương án xử lý')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bộ phận phối hợp/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kết quả hồ sơ/i })).toBeInTheDocument();

    const input = await screen.findByLabelText('Ô nhập câu hỏi');
    fireEvent.change(input, { target: { value: 'Khách C001 xin vay 5 tỷ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await screen.findByText(/Khách C001 xin vay 5 tỷ/);
    expect(input).not.toBeDisabled();
    fireEvent.change(input, { target: { value: 'Bổ sung mục đích mua nhà' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByText('Bổ sung mục đích mua nhà')).toBeInTheDocument();
    expect(screen.queryByTestId('trace-block')).not.toBeInTheDocument();
  });
});
