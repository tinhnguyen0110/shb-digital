// ModelPicker.tsx — chọn provider + model cho ca MỚI (D-45b). GET /api/models → dropdown.
// provider has_key=false → disable (không đủ điều kiện chạy). default (từ response) chọn sẵn.
// Controlled: value provider/model do Workspace giữ → truyền vào createConversation khi tạo ca.
// Vỏ-mù (N3): response thiếu field → bỏ qua nhánh đó, không crash; providers rỗng → ẩn picker.
import { useEffect, useState } from 'react';
import { conversationApi } from '../api';
import type { Provider } from '../types';
import { modelLabel, providerLabel } from '../uiCopy';
import './ModelPicker.css';

interface Props {
  provider: string;
  model: string;
  onChange: (provider: string, model: string) => void;
  disabled?: boolean;
}

export function ModelPicker({ provider, model, onChange, disabled }: Props) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    conversationApi
      .getModels()
      .then((res) => {
        if (!alive) return;
        const list = Array.isArray(res.providers) ? res.providers : [];
        setProviders(list);
        setError(null);
        // chọn sẵn: default response (nếu có + đủ key) → nếu chưa chọn provider nào.
        if (!provider && list.length > 0) {
          const def = list.find((p) => p.name === res.default && p.has_key)
            ?? list.find((p) => p.has_key)
            ?? list[0];
          onChange(def.name, def.models?.[0] ?? '');
        }
      })
      .catch(() => {
        if (alive) setError('Chưa tải được cấu hình xử lý. Hệ thống sẽ áp dụng cấu hình mặc định.');
      });
    return () => { alive = false; };
    // chạy 1 lần lúc mount — provider/model/onChange KHÔNG vào deps để tránh refetch vòng lặp.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <div className="mp__note" title={error}>Áp dụng cấu hình xử lý mặc định</div>;
  if (providers.length === 0) return null; // chưa tải xong / rỗng → không chiếm chỗ

  const current = providers.find((p) => p.name === provider);
  const models = current?.models ?? [];

  return (
    <div className="mp">
      <label className="mp__row">
        <span className="mp__label">Phương án xử lý</span>
        <select
          className="mp__select"
          value={provider}
          disabled={disabled}
          aria-label="Chọn phương án xử lý"
          onChange={(e) => {
            const next = providers.find((p) => p.name === e.target.value);
            onChange(e.target.value, next?.models?.[0] ?? '');
          }}
        >
          {providers.map((p) => (
            <option key={p.name} value={p.name} disabled={!p.has_key}>
              {providerLabel(p.name)}{p.has_key ? '' : ' (chưa sẵn sàng)'}{p.default ? ' · Mặc định' : ''}
            </option>
          ))}
        </select>
      </label>
      {models.length > 0 && (
        <label className="mp__row">
          <span className="mp__label">Mức độ hỗ trợ</span>
          <select
            className="mp__select"
            value={model}
            disabled={disabled}
            aria-label="Chọn mức độ hỗ trợ"
            onChange={(e) => onChange(provider, e.target.value)}
          >
            {models.map((m) => (
              <option key={m} value={m}>{modelLabel(m)}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
