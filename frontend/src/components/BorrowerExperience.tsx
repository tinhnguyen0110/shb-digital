import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  ExternalLink,
  Landmark,
  LockKeyhole,
  Shield,
  ShieldCheck,
  Sparkles,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import type { ThemeMode } from '../hooks/useTheme';
import {
  createMockCicEvidence,
  recommendProduct,
  REGION_SERVICE_CONFIGS,
  runPreliminaryCheck,
  SHB_LOAN_PRODUCTS,
  SMALL_UNSECURED_POLICY,
  type LoanProduct,
  type LoanProductId,
  type LoanPurpose,
  type PreliminaryCheckInput,
  type PreliminaryCheckResult,
  type RegionCode,
} from '../data/loanProducts';
import { ThemeToggle } from './ThemeToggle';
import './BorrowerExperience.css';

interface Props {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onStaffLogin: () => void;
}

const PURPOSES: Array<{ id: LoanPurpose; label: string; helper: string; icon: LucideIcon }> = [
  { id: 'everyday', label: 'Chi tiêu cá nhân', helper: 'Mua sắm, học tập hoặc chi phí gia đình', icon: WalletCards },
  { id: 'urgent', label: 'Khoản chi đột xuất', helper: 'Cần hạn mức linh hoạt khi tiền chưa về', icon: CircleDollarSign },
  { id: 'public_service', label: 'Tôi làm việc trong khu vực công', helper: 'Cán bộ, công chức, viên chức hoặc lực lượng vũ trang', icon: Shield },
];

const CATALOG_CHECKED_AT = SHB_LOAN_PRODUCTS.reduce(
  (latest, product) => product.sourceCheckedAt > latest ? product.sourceCheckedAt : latest,
  SHB_LOAN_PRODUCTS[0].sourceCheckedAt,
);

const OUTCOME_COPY: Record<
  PreliminaryCheckResult['outcome'],
  { title: string; description: string; tone: 'pass' | 'warn' | 'fail' }
> = {
  PRELIMINARY_ELIGIBLE: {
    title: 'Bạn có thể tiếp tục với gói vay này',
    description: 'Thông tin bạn cung cấp đang phù hợp với điều kiện kiểm tra nhanh.',
    tone: 'pass',
  },
  PRELIMINARY_INELIGIBLE: {
    title: 'Khoản vay hiện chưa phù hợp',
    description: 'Một số thông tin chưa đáp ứng điều kiện sơ bộ của gói vay.',
    tone: 'fail',
  },
  NEEDS_INFORMATION: {
    title: 'Cần bổ sung một số thông tin',
    description: 'Trợ lý chưa có đủ dữ liệu để đưa ra kết quả sơ bộ.',
    tone: 'warn',
  },
  MANUAL_REVIEW: {
    title: 'Nhu cầu này cần được xem xét thêm',
    description: 'Gói vay đã chọn không thuộc phạm vi kiểm tra nhanh tự động.',
    tone: 'warn',
  },
  OUT_OF_SCOPE: {
    title: 'Khoản vay cần chuyên viên xem xét',
    description: 'Kiểm tra nhanh hiện chỉ áp dụng cho khoản tín chấp dưới 10 triệu đồng.',
    tone: 'warn',
  },
};

export function BorrowerExperience({ theme, onToggleTheme, onStaffLogin }: Props) {
  const [purpose, setPurpose] = useState<LoanPurpose>('everyday');
  const recommended = useMemo(() => recommendProduct(purpose), [purpose]);
  const [selectedProductId, setSelectedProductId] = useState<LoanProductId>('unsecured-consumer');
  const [result, setResult] = useState<PreliminaryCheckResult | null>(null);
  const resultRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  const selectPurpose = (nextPurpose: LoanPurpose) => {
    setPurpose(nextPurpose);
    setSelectedProductId(recommendProduct(nextPurpose).id);
    setResult(null);
  };

  const submitCheck = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const paymentHistory = String(form.get('paymentHistory'));
    const cicStatus = paymentHistory === 'on_time' || paymentHistory === 'late'
      ? paymentHistory
      : 'unavailable';
    const input: PreliminaryCheckInput = {
      productId: selectedProductId,
      amountVnd: Number(form.get('amountMillion')) * 1_000_000,
      termMonths: Number(form.get('termMonths')),
      age: Number(form.get('age')),
      monthlyIncomeVnd: Number(form.get('incomeMillion')) * 1_000_000,
      monthlyDebtVnd: Number(form.get('debtMillion')) * 1_000_000,
      cicEvidence: createMockCicEvidence(cicStatus),
      employmentStable: form.get('employmentStable') === 'yes',
      region: String(form.get('region')) as RegionCode,
    };
    setResult(runPreliminaryCheck(input));
  };

  return (
    <div className="borrower">
      <header className="borrower__header">
        <a className="borrower__brand" href="#top" aria-label="SHB - Tư vấn khoản vay">
          <span><Landmark size={23} /></span>
          <div><strong>SHB</strong><small>Tư vấn khoản vay</small></div>
        </a>
        <nav className="borrower__nav" aria-label="Điều hướng">
          <a href="#products">Sản phẩm vay</a>
          <a href="#quick-check">Kiểm tra điều kiện</a>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} className="borrower__icon-button" />
          <button type="button" className="borrower__staff-login" onClick={onStaffLogin}>
            <LockKeyhole size={16} /> Dành cho nhân viên
          </button>
        </nav>
      </header>

      <main id="top">
        <section className="borrower__hero">
          <div className="borrower__hero-copy">
            <span className="borrower__eyebrow"><Sparkles size={14} /> Trợ lý tư vấn khoản vay</span>
            <h1>Tìm gói vay tín chấp phù hợp với bạn</h1>
            <p>Chọn nhu cầu và trả lời vài câu hỏi. Bạn không cần đăng nhập và chưa cần cam kết đăng ký.</p>
            <a href="#quick-check" className="borrower__hero-action">
              Bắt đầu tư vấn <ArrowRight size={17} />
            </a>
            <div className="borrower__trust">
            <span><ShieldCheck size={16} /> Chỉ tư vấn gói không cần tài sản bảo đảm</span>
              <span><Bot size={16} /> AI hỗ trợ hỏi đúng thông tin</span>
              <span><Landmark size={16} /> Điều kiện do SHB cấu hình</span>
            </div>
          </div>
          <div className="borrower__assistant-card" aria-label="Gợi ý từ trợ lý tư vấn">
            <div className="borrower__assistant-head">
              <span><Bot size={21} /></span>
              <div><strong>Trợ lý SHB</strong><small>Sẵn sàng tư vấn</small></div>
            </div>
            <div className="borrower__assistant-bubble">
              Chào bạn, khoản vay này dự định dùng cho mục đích gì?
            </div>
            <div className="borrower__purpose-grid">
              {PURPOSES.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    type="button"
                    className={purpose === item.id ? 'is-selected' : ''}
                    key={item.id}
                    onClick={() => selectPurpose(item.id)}
                    aria-pressed={purpose === item.id}
                  >
                    <Icon size={18} />
                    <span><strong>{item.label}</strong><small>{item.helper}</small></span>
                    <ChevronRight size={16} />
                  </button>
                );
              })}
            </div>
            <p className="borrower__assistant-note">
              Gợi ý theo mục đích đã chọn: <strong>{recommended.name}</strong>
            </p>
          </div>
        </section>

        <section className="borrower__section" id="products">
          <div className="borrower__section-heading">
            <div>
              <span className="borrower__eyebrow">Thông tin từ SHB</span>
              <h2>Các lựa chọn vay phổ biến</h2>
              <p>Trợ lý sẽ ưu tiên sản phẩm phù hợp với mục đích bạn đã chọn.</p>
            </div>
            <span className="borrower__source-date">
              Kiểm tra nguồn: {new Intl.DateTimeFormat('vi-VN').format(new Date(CATALOG_CHECKED_AT))}
            </span>
          </div>
          <div className="borrower__products">
            {SHB_LOAN_PRODUCTS.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                selected={selectedProductId === product.id}
                recommended={recommended.id === product.id}
                onSelect={() => {
                  setSelectedProductId(product.id);
                  setPurpose(product.purpose);
                  setResult(null);
                }}
              />
            ))}
          </div>
        </section>

        <section className="borrower__section borrower__check-section" id="quick-check">
          <div className="borrower__section-heading">
            <div>
              <span className="borrower__eyebrow">Kiểm tra nhanh · dữ liệu minh họa</span>
              <h2>Xem khả năng phù hợp sơ bộ</h2>
              <p>Trợ lý giúp bạn chọn gói và hoàn thiện thông tin. Kết quả được tính bằng bộ điều kiện cố định, không do AI tự quyết định.</p>
            </div>
          </div>
          <div className="borrower__check-layout">
            <form className="borrower__form" onSubmit={submitCheck}>
              <div className="borrower__form-head">
                <span><Sparkles size={18} /></span>
                <div>
                  <strong>Thông tin cần để kiểm tra</strong>
                  <small>Không tạo tài khoản, không lưu dữ liệu thật trong bản demo.</small>
                </div>
              </div>
              <label>
                <span>Gói vay đang xem</span>
                <select name="productId" value={selectedProductId} onChange={(event) => { setSelectedProductId(event.target.value as LoanProductId); setResult(null); }}>
                  {SHB_LOAN_PRODUCTS.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
              </label>
              <div className="borrower__form-grid">
                <label>
                  <span>Số tiền muốn vay (triệu đồng)</span>
                  <input name="amountMillion" type="number" min="1" step="1" defaultValue="8" required />
                </label>
                <label>
                  <span>Thời hạn mong muốn</span>
                  <select name="termMonths" defaultValue="12">
                    <option value="6">6 tháng</option>
                    <option value="12">12 tháng</option>
                    <option value="24">24 tháng</option>
                    <option value="36">36 tháng</option>
                  </select>
                </label>
                <label>
                  <span>Tuổi của bạn</span>
                  <input name="age" type="number" min="18" max="70" defaultValue="30" required />
                </label>
                <label>
                  <span>Khu vực cần hỗ trợ</span>
                  <select name="region" defaultValue="north">
                    {Object.entries(REGION_SERVICE_CONFIGS).map(([id, config]) => (
                      <option key={id} value={id}>{config.label.replace('SHB Bán lẻ · ', '')}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Thu nhập mỗi tháng (triệu đồng)</span>
                  <input name="incomeMillion" type="number" min="1" step="0.5" defaultValue="15" required />
                </label>
                <label>
                  <span>Khoản đang trả mỗi tháng (triệu đồng)</span>
                  <input name="debtMillion" type="number" min="0" step="0.5" defaultValue="2" required />
                </label>
                <label>
                  <span>Nguồn thu nhập hiện tại</span>
                  <select name="employmentStable" defaultValue="yes">
                    <option value="yes">Ổn định từ 6 tháng trở lên</option>
                    <option value="no">Mới thay đổi hoặc chưa ổn định</option>
                  </select>
                </label>
                <label>
                  <span>Lịch sử thanh toán (kịch bản minh họa)</span>
                  <select name="paymentHistory" defaultValue="on_time">
                    <option value="on_time">Không có kỳ chậm thanh toán</option>
                    <option value="late">Có kỳ cần xem xét</option>
                    <option value="unavailable">Chưa có thông tin</option>
                  </select>
                </label>
              </div>
              <label className="borrower__consent">
                <input type="checkbox" required defaultChecked />
                <span>Tôi đồng ý dùng thông tin vừa nhập để nhận kết quả minh họa trong phiên này.</span>
              </label>
              <button className="borrower__check-button" type="submit">
                <Sparkles size={17} /> Kiểm tra điều kiện vay
              </button>
            </form>

            <aside
              id="borrower-result"
              ref={resultRef}
              className={`borrower__result${result ? ` borrower__result--${OUTCOME_COPY[result.outcome].tone}` : ''}`}
              tabIndex={-1}
              aria-live="polite"
            >
              {!result ? (
                <div className="borrower__result-empty">
                  <span><ShieldCheck size={30} /></span>
                  <h3>Kết quả sẽ xuất hiện tại đây</h3>
                  <p>Kiểm tra nhanh áp dụng cho khoản vay tín chấp dưới {formatCompactAmount(SMALL_UNSECURED_POLICY.quickCheckLimitVnd)}. Các nhu cầu khác sẽ được chuyển để chuyên viên xem xét.</p>
                </div>
              ) : (
                <ResultView result={result} onReset={() => setResult(null)} />
              )}
            </aside>
          </div>
        </section>
      </main>

      <footer className="borrower__footer">
        <div><strong>SHB · Tư vấn khoản vay</strong><span>Kết quả kiểm tra và dữ liệu đối chiếu trong bản thử nghiệm đều là dữ liệu mô phỏng.</span></div>
        <p>Thông tin sản phẩm được tham khảo từ website SHB và có thể thay đổi theo từng thời kỳ.</p>
      </footer>
    </div>
  );
}

function ProductCard({
  product,
  selected,
  recommended,
  onSelect,
}: {
  product: LoanProduct;
  selected: boolean;
  recommended: boolean;
  onSelect: () => void;
}) {
  return (
    <article className={`borrower__product${selected ? ' is-selected' : ''}`}>
      <div className="borrower__product-top">
        {recommended ? <span className="borrower__recommended"><Sparkles size={12} /> Trợ lý gợi ý</span> : <span />}
        <Landmark size={19} />
      </div>
      <h3>{product.name}</h3>
      <p>{product.summary}</p>
      <dl>
        <div><dt>Hạn mức</dt><dd>{product.limitLabel}</dd></div>
        <div><dt>Thời hạn</dt><dd>{product.termLabel}</dd></div>
        <div><dt>Tài sản bảo đảm</dt><dd>{product.collateralLabel}</dd></div>
      </dl>
      <ul>{product.highlights.slice(0, 2).map((highlight) => <li key={highlight}><Check size={14} /> {highlight}</li>)}</ul>
      <div className="borrower__product-actions">
        <button type="button" onClick={onSelect}>{selected ? 'Đã chọn' : 'Chọn gói này'}</button>
        <a href={product.sourceUrl} target="_blank" rel="noreferrer">Nguồn SHB <ExternalLink size={13} /></a>
      </div>
    </article>
  );
}

function ResultView({ result, onReset }: { result: PreliminaryCheckResult; onReset: () => void }) {
  const copy = OUTCOME_COPY[result.outcome];
  const Icon = copy.tone === 'pass' ? ShieldCheck : CircleAlert;
  return (
    <div className="borrower__result-content">
      <span className="borrower__result-icon"><Icon size={28} /></span>
      <small>Kết quả sơ bộ</small>
      <h3>{copy.title}</h3>
      <p>{copy.description}</p>
      <ul>{result.reasons.map((reason) => <li key={reason}><Check size={15} /> {reason}</li>)}</ul>
      <div className="borrower__result-policy">
        <span>Phạm vi kiểm tra</span>
        <strong>Khoản vay tín chấp dưới {formatCompactAmount(SMALL_UNSECURED_POLICY.quickCheckLimitVnd)}</strong>
        <small>Đơn vị hỗ trợ: {result.servicing?.label.replace('SHB Bán lẻ · ', '') ?? 'Sẽ được xác định sau'}</small>
      </div>
      <div className="borrower__result-disclaimer">
        Đây là kết quả minh họa, chưa phải quyết định hoặc cam kết cấp tín dụng. Không có dữ liệu tín dụng hoặc dữ liệu bên thứ ba thật được tra cứu.
      </div>
      <button type="button" className="borrower__reset" onClick={onReset}>Điều chỉnh thông tin</button>
    </div>
  );
}

function formatCompactAmount(value: number) {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value / 1_000_000)} triệu đồng`;
}
