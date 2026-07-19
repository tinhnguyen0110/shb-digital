// roles.ts — nhãn Việt-hoá role (dùng chung TaskBadge + App reason). Role ĐỘNG (CONTRACT §3):
// role lạ → trả raw, KHÔNG hardcode enum cứng. S1 chỉ thấy `credit`.
const ROLE_LABEL: Record<string, string> = {
  credit: 'Thẩm định tín dụng',
  legal: 'Kiểm soát pháp lý',
  products: 'Chính sách sản phẩm',
  ops: 'Vận hành hồ sơ',
};

export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? 'Bộ phận nghiệp vụ';
}
