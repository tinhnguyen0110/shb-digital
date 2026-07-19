// ModelPicker.test.tsx — dropdown provider/model (D-45b): render list, default chọn sẵn, has_key disable,
// đổi provider → reset model đầu, lỗi getModels → note mặc-định (không crash).
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelPicker } from './ModelPicker';
import { conversationApi } from '../api';
import type { ModelsResponse } from '../types';

const models: ModelsResponse = {
  providers: [
    { name: 'claude-cli', kind: 'subscription', base_url: null, models: ['haiku', 'sonnet', 'opus'], default: true, has_key: true },
    { name: 'zai', kind: 'api', base_url: 'https://api.z.ai', models: ['glm-4.6', 'glm-4.5'], default: false, has_key: true },
    { name: 'openai', kind: 'api', base_url: null, models: ['gpt-4'], default: false, has_key: false },
  ],
  default: 'claude-cli',
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(conversationApi, 'getModels').mockResolvedValue(models);
});

describe('ModelPicker', () => {
  it('tải providers → default (claude-cli) chọn sẵn qua onChange', async () => {
    const onChange = vi.fn();
    render(<ModelPicker provider="" model="" onChange={onChange} />);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('claude-cli', 'haiku'));
  });

  it('render 2 select provider + model khi đã chọn provider', async () => {
    render(<ModelPicker provider="claude-cli" model="sonnet" onChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('Chọn phương án xử lý')).toBeInTheDocument());
    expect(screen.getByLabelText('Chọn mức độ hỗ trợ')).toBeInTheDocument();
    // model đang chọn = sonnet
    expect((screen.getByLabelText('Chọn mức độ hỗ trợ') as HTMLSelectElement).value).toBe('sonnet');
  });

  it('provider has_key=false → option disabled (không chọn được)', async () => {
    render(<ModelPicker provider="claude-cli" model="haiku" onChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('Chọn phương án xử lý')).toBeInTheDocument());
    const opt = screen.getByRole('option', { name: /Phương án mở rộng \(chưa sẵn sàng\)/ }) as HTMLOptionElement;
    expect(opt.disabled).toBe(true);
  });

  it('đổi provider → onChange với model đầu của provider mới', async () => {
    const onChange = vi.fn();
    render(<ModelPicker provider="claude-cli" model="haiku" onChange={onChange} />);
    await waitFor(() => expect(screen.getByLabelText('Chọn phương án xử lý')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Chọn phương án xử lý'), { target: { value: 'zai' } });
    expect(onChange).toHaveBeenCalledWith('zai', 'glm-4.6');
  });

  it('getModels lỗi → note cấu hình mặc định, không crash', async () => {
    vi.spyOn(conversationApi, 'getModels').mockRejectedValue(new Error('down'));
    render(<ModelPicker provider="" model="" onChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/cấu hình xử lý mặc định/)).toBeInTheDocument());
  });
});
