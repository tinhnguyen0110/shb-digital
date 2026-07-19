import { Moon, Sun } from 'lucide-react';
import type { ThemeMode } from '../hooks/useTheme';

interface Props {
  theme: ThemeMode;
  onToggle: () => void;
  className?: string;
}

export function ThemeToggle({ theme, onToggle, className = '' }: Props) {
  const nextLabel = theme === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng';
  return (
    <button
      type="button"
      className={className}
      onClick={onToggle}
      aria-label={nextLabel}
      title={nextLabel}
      data-testid="theme-toggle"
    >
      {theme === 'light' ? <Moon aria-hidden="true" size={17} /> : <Sun aria-hidden="true" size={17} />}
    </button>
  );
}
