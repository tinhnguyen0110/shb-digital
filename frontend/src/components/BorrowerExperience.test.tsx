import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BorrowerExperience } from './BorrowerExperience';

function renderBorrower() {
  render(
    <BorrowerExperience
      theme="light"
      onToggleTheme={vi.fn()}
      onStaffLogin={vi.fn()}
    />,
  );
}

describe('BorrowerExperience', () => {
  it('returns an explicitly preliminary result from mock evidence', () => {
    renderBorrower();

    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra điều kiện vay' }));

    expect(screen.getByText('Kết quả sơ bộ')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bạn có thể tiếp tục với gói vay này' })).toBeInTheDocument();
    expect(screen.getByText(/chưa phải quyết định hoặc cam kết cấp tín dụng/i)).toBeInTheDocument();
    expect(screen.getByText(/Không có dữ liệu tín dụng hoặc dữ liệu bên thứ ba thật được tra cứu/i)).toBeInTheDocument();
  });

  it('keeps exactly 10 million outside the quick-check scope', () => {
    renderBorrower();

    fireEvent.change(screen.getByLabelText('Số tiền muốn vay (triệu đồng)'), {
      target: { value: '10' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra điều kiện vay' }));

    expect(screen.getByRole('heading', { name: 'Khoản vay cần chuyên viên xem xét' })).toBeInTheDocument();
    expect(screen.getByText(/chỉ áp dụng cho khoản tín chấp dưới 10 triệu đồng/i)).toBeInTheDocument();
    expect(screen.getByText(/để chuyên viên xem xét nhu cầu hiện tại/i)).toBeInTheDocument();
  });

  it('routes a caution signal to review rather than presenting a decline', () => {
    renderBorrower();

    fireEvent.change(screen.getByLabelText('Lịch sử thanh toán (kịch bản minh họa)'), {
      target: { value: 'late' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra điều kiện vay' }));

    expect(screen.getByRole('heading', { name: 'Nhu cầu này cần được xem xét thêm' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Khoản vay hiện chưa phù hợp' })).not.toBeInTheDocument();
  });
});
