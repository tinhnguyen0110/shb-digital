// TraceBlock.test.tsx — khối trace collapsible (F1): thu gọn mặc định, click mở, thinking+tool render.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TraceBlock } from './TraceBlock';
import type { TraceItem } from '../types';

const items: TraceItem[] = [
  { kind: 'thinking', id: 'th1', task_id: null, text: 'cân nhắc DSCR' },
  { kind: 'tool', id: 'tc1', task_id: null, tool: 'orch_dispatch', summary: 'role=credit' },
  { kind: 'tool', id: 'tc2', task_id: 't1', tool: 'credit_assess', summary: 'C001 5 tỷ' },
];

describe('TraceBlock', () => {
  it('rỗng → KHÔNG render (không khối trống)', () => {
    const { container } = render(<TraceBlock items={[]} />);
    expect(container.querySelector('[data-testid=trace-block]')).toBeNull();
  });

  it('mặc định THU GỌN — hiện tổng, không hiện dòng chi tiết', () => {
    render(<TraceBlock items={items} />);
    expect(screen.getByText(/3 cập nhật/)).toBeInTheDocument();
    expect(screen.getByText(/2 bước đã ghi nhận/)).toBeInTheDocument();
    // chưa mở → chi tiết ẩn
    expect(screen.queryByText('Đang phân tích thông tin hồ sơ')).not.toBeInTheDocument();
    expect(screen.queryByText('Đánh giá thông tin tín dụng')).not.toBeInTheDocument();
  });

  it('click mở → hiện dòng thinking + tool', () => {
    render(<TraceBlock items={items} />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByText('Đang phân tích thông tin hồ sơ')).toBeInTheDocument();
    expect(screen.getByText('Chuyển nội dung đến bộ phận phụ trách')).toBeInTheDocument();
    expect(screen.getByText('Đánh giá thông tin tín dụng')).toBeInTheDocument();
  });

  it('actor: task_id null → điều phối; có taskRole → tên bộ phận', () => {
    render(<TraceBlock items={items} taskRole={(id) => (id === 't1' ? 'credit' : undefined)} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getAllByText('Điều phối hồ sơ').length).toBeGreaterThan(0);
    expect(screen.getByText('Thẩm định tín dụng')).toBeInTheDocument();
  });

  it('toggle 2 lần → đóng lại', () => {
    render(<TraceBlock items={items} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(screen.getByText('Đang phân tích thông tin hồ sơ')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText('Đang phân tích thông tin hồ sơ')).not.toBeInTheDocument();
  });
});
