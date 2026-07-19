// App.gate.test.tsx — contract cửa khách công khai + đăng nhập/RBAC nội bộ.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { conversationApi } from './api';

afterEach(() => {
  vi.restoreAllMocks();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = '';
});

async function openStaffLogin() {
  fireEvent.click(await screen.findByRole('button', { name: 'Dành cho nhân viên' }));
  await screen.findByRole('button', { name: 'Đăng nhập' });
}

async function loginAs(username: string, password: string = username) {
  await openStaffLogin();
  fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: username } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
}

describe('App gate — cửa khách công khai và RBAC nội bộ', () => {
  it('khách ẩn danh vào trang tư vấn ngay, không cần đăng nhập', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Tìm gói vay tín chấp phù hợp với bạn' })).toBeInTheDocument();
    expect(screen.getByText(/Bạn không cần đăng nhập/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dành cho nhân viên' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đăng nhập' })).not.toBeInTheDocument();
  });

  it('nút “Dành cho nhân viên” mở đăng nhập và có thể quay lại cửa khách', async () => {
    render(<App />);

    await openStaffLogin();
    expect(screen.getByText('Đăng nhập nội bộ SHB')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Quay lại trang tư vấn/i }));

    expect(await screen.findByRole('heading', { name: 'Tìm gói vay tín chấp phù hợp với bạn' })).toBeInTheDocument();
  });

  it('staff/staff có quyền tiếp nhận và đọc chính sách nhưng không có quyền quản lý', async () => {
    render(<App />);
    await loginAs('staff');

    expect(await screen.findByText('Cổng quản lý hồ sơ vay')).toBeInTheDocument();
    expect(screen.getByText('staff')).toBeInTheDocument();
    expect(screen.getByText('Nhân viên tín dụng')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo hồ sơ mới' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Chính sách phê duyệt' }));
    expect(await screen.findByText('Bộ điều kiện tín dụng đang áp dụng')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tạo bản dự thảo/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('open-tower')).not.toBeInTheDocument();
  });

  it('admin/admin đăng nhập và có quyền chính sách, giám sát', async () => {
    vi.spyOn(conversationApi, 'listApprovals').mockResolvedValue([]);
    render(<App />);
    await loginAs('admin');

    expect(await screen.findByText('Cổng quản lý hồ sơ vay')).toBeInTheDocument();
    expect(screen.getAllByText('Giám đốc chi nhánh').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Chính sách phê duyệt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Người dùng & phân quyền' })).toBeInTheDocument();
    expect(screen.getByTestId('open-tower')).toBeInTheDocument();
  });

  it('quản lý khu vực chỉ thấy hồ sơ và người dùng thuộc đơn vị của mình', async () => {
    vi.spyOn(conversationApi, 'listApprovals').mockResolvedValue([]);
    render(<App />);
    await loginAs('admin_central');

    expect(await screen.findByText('SHB Bán lẻ · Miền Trung')).toBeInTheDocument();
    expect(await screen.findByText(/Trần Hoàng Nam · Vay tiêu dùng tín chấp/)).toBeInTheDocument();
    expect(screen.queryByText(/Nguyễn Minh Anh · Vay tiêu dùng tín chấp/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Người dùng & phân quyền' }));
    expect(await screen.findByRole('heading', { name: 'Danh sách người dùng' })).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Hải Yến')).toBeInTheDocument();
    expect(screen.queryByText('Trần Thu Hà')).not.toBeInTheDocument();
  });

  it('quản lý thêm nhân viên ở trạng thái chờ kích hoạt và không thể tự cấp vai trò quản lý', async () => {
    vi.spyOn(conversationApi, 'listApprovals').mockResolvedValue([]);
    render(<App />);
    await loginAs('admin_central');

    await screen.findByText('Cổng quản lý hồ sơ vay');
    fireEvent.click(screen.getByRole('button', { name: 'Người dùng & phân quyền' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm người dùng' }));

    const dialog = screen.getByRole('dialog', { name: 'Thêm người dùng' });
    expect(dialog).toHaveTextContent('Nhân viên tín dụng');
    expect(dialog).toHaveTextContent('Tài khoản Quản lý do bộ phận quản trị danh tính cấp');
    expect(dialog.querySelector('select[name="role"]')).toBeNull();

    fireEvent.change(screen.getByLabelText(/Họ và tên/), {
      target: { value: 'Phạm Minh Khoa' },
    });
    fireEvent.change(screen.getByLabelText(/Tên đăng nhập/), {
      target: { value: 'pham.minh.khoa' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo người dùng' }));

    expect(await screen.findByText('Phạm Minh Khoa')).toBeInTheDocument();
    expect(screen.getByText('Chờ kích hoạt')).toBeInTheDocument();
    expect(
      screen.getByRole('switch', {
        name: 'Kích hoạt tài khoản của Phạm Minh Khoa',
      }),
    ).toBeDisabled();
  });

  it('đăng nhập sai hiển thị thông báo tiếng Việt', async () => {
    render(<App />);
    await loginAs('admin', 'sai-mat-khau');

    expect(await screen.findByRole('alert')).toHaveTextContent('Tên đăng nhập hoặc mật khẩu không đúng.');
    expect(screen.queryByText('Cổng quản lý hồ sơ vay')).not.toBeInTheDocument();
  });

  it('đăng xuất khỏi cổng nội bộ quay về cửa khách, không quay về màn đăng nhập', async () => {
    vi.spyOn(conversationApi, 'listApprovals').mockResolvedValue([]);
    render(<App />);
    await loginAs('admin');

    await screen.findByText('Cổng quản lý hồ sơ vay');
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));

    expect(await screen.findByRole('heading', { name: 'Tìm gói vay tín chấp phù hợp với bạn' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đăng nhập' })).not.toBeInTheDocument();
  });

  it('phiên legacy role=customer vẫn ở cửa khách công khai', async () => {
    vi.spyOn(conversationApi, 'me').mockResolvedValue({
      user: { username: 'c001', role: 'customer', owner_id: 'C001' },
    });
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Tìm gói vay tín chấp phù hợp với bạn' })).toBeInTheDocument();
    expect(screen.queryByText(/c001 · Khách hàng/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('open-portal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('open-tower')).not.toBeInTheDocument();
  });

  it('phiên nhân viên hợp lệ từ /me vào thẳng cổng nội bộ', async () => {
    vi.spyOn(conversationApi, 'me').mockResolvedValue({
      user: { username: 'staff', role: 'user' },
    });
    render(<App />);

    expect(await screen.findByText('Cổng quản lý hồ sơ vay')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đăng nhập' })).not.toBeInTheDocument();
  });

  it('mở được chi tiết hồ sơ từ danh sách', async () => {
    vi.spyOn(conversationApi, 'me').mockResolvedValue({
      user: { username: 'staff', role: 'user' },
    });
    render(<App />);

    await screen.findByText('Cổng quản lý hồ sơ vay');
    fireEvent.click(await screen.findByRole('button', { name: /Xem chi tiết hồ sơ Đỗ Quang Huy/ }));

    const detail = await screen.findByRole('dialog', { name: 'Đỗ Quang Huy' });
    expect(detail).toHaveTextContent('SHB-HN-260716-019');
    expect(detail).toHaveTextContent('Khả năng trả nợ');
    expect(detail).toHaveTextContent('Tài liệu đính kèm (3)');
    expect(detail).toHaveTextContent('SHB-HN-260716-019_giay-to-dinh-danh.pdf');
    expect(detail).toHaveTextContent('Cần nhân viên đánh giá lại');
    expect(detail).toHaveTextContent('49/100');
    expect(detail).toHaveTextContent('Lịch sử thanh toán có sai lệch nghiêm trọng');
    expect(screen.getByRole('button', { name: /Mở đánh giá lại/ })).toBeInTheDocument();
  });

  it('staff chỉ thấy hàng đợi ngoại lệ và không có trang tài liệu độc lập', async () => {
    vi.spyOn(conversationApi, 'me').mockResolvedValue({
      user: { username: 'staff', role: 'user' },
    });
    render(<App />);

    await screen.findByText('Cổng quản lý hồ sơ vay');
    expect(screen.getByRole('button', { name: 'Cần đánh giá lại' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo hồ sơ mới' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tài liệu hồ sơ' })).not.toBeInTheDocument();
    expect(await screen.findByText('Đỗ Quang Huy · Vay tiêu dùng tín chấp')).toBeInTheDocument();
    expect(screen.queryByText('Nguyễn Minh Anh · Vay tiêu dùng tín chấp')).not.toBeInTheDocument();
  });

  it('giám đốc chi nhánh xem được hồ sơ tự động phê duyệt cùng tài liệu', async () => {
    vi.spyOn(conversationApi, 'me').mockResolvedValue({
      user: { username: 'admin', role: 'admin' },
    });
    vi.spyOn(conversationApi, 'listApprovals').mockResolvedValue([]);
    render(<App />);

    await screen.findByText('Cổng quản lý hồ sơ vay');
    fireEvent.click(await screen.findByRole('button', { name: /Xem chi tiết hồ sơ Nguyễn Minh Anh/ }));

    const detail = await screen.findByRole('dialog', { name: 'Nguyễn Minh Anh' });
    expect(detail).toHaveTextContent('Đã tự động phê duyệt');
    expect(detail).toHaveTextContent('Dữ liệu khách hàng');
    expect(detail).toHaveTextContent('Đã xác thực');
    expect(detail).toHaveTextContent('Tài liệu đính kèm (3)');
    expect(detail).toHaveTextContent('SHB-HN-260718-001_giay-to-dinh-danh.pdf');
    expect(screen.queryByRole('button', { name: 'Tài liệu hồ sơ' })).not.toBeInTheDocument();
  });

  it('admin có thể tạo bản dự thảo cấu hình nhưng không làm đổi bản đang áp dụng', async () => {
    vi.spyOn(conversationApi, 'me').mockResolvedValue({
      user: { username: 'admin', role: 'admin' },
    });
    vi.spyOn(conversationApi, 'listApprovals').mockResolvedValue([]);
    render(<App />);

    await screen.findByText('Cổng quản lý hồ sơ vay');
    fireEvent.click(screen.getByRole('button', { name: 'Chính sách phê duyệt' }));
    fireEvent.click(screen.getByRole('button', { name: /Tạo bản dự thảo/i }));

    expect(screen.getByRole('dialog', { name: 'Điều chỉnh cấu hình' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu bản dự thảo' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Cấu hình đang áp dụng chưa thay đổi');
    expect(screen.getByText('QCK-UNS-2026.07-01')).toBeInTheDocument();
  });

  it('theme toggle áp dụng chung qua data-theme', async () => {
    render(<App />);
    const toggle = await screen.findByTestId('theme-toggle');

    expect(document.documentElement.dataset.theme).toBe('light');
    fireEvent.click(toggle);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
  });

  it('UI mới không còn copy dữ liệu/giai đoạn cũ hoặc thuật ngữ kỹ thuật', async () => {
    vi.spyOn(conversationApi, 'me').mockResolvedValue({
      user: { username: 'admin', role: 'admin' },
    });
    vi.spyOn(conversationApi, 'listApprovals').mockResolvedValue([]);
    render(<App />);

    await screen.findByText('Cổng quản lý hồ sơ vay');
    expect(document.body).not.toHaveTextContent(
      /Thông tin đã thu thập|C06|BHXH|Giai đoạn|MOCK API|Agent HUD|Risk Engine|human-in-the-loop|Pipeline|Mock Adapter|Schema/,
    );
    expect(await screen.findByRole('columnheader', { name: 'Ngày tiếp nhận' })).toBeInTheDocument();
  });
});
