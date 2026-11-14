import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle({ className = '', label }) {
  const { theme, toggleTheme } = useTheme();
  const switchesTo = theme === 'dark' ? 'light' : 'dark';
  const Icon = theme === 'dark' ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${switchesTo} mode`}
      title={`Switch to ${switchesTo} mode`}
      aria-pressed={theme === 'dark'}
      className={`${label
        ? 'flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-sm font-semibold text-[#35433d] transition hover:bg-[#f5f8f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-medium'
        : 'grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/70 bg-white text-pine shadow-sm transition hover:bg-[#f2f7f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium focus-visible:ring-offset-2'} ${className}`}
    >
      {label ? (
        <>
          <span className="flex min-w-0 items-center gap-2.5">
            <Icon size={17} aria-hidden="true" />
            <span>{label}</span>
          </span>
          <span className="text-xs font-medium text-[#718077]">{theme === 'dark' ? 'Dark' : 'Light'}</span>
        </>
      ) : <Icon size={18} aria-hidden="true" />}
    </button>
  );
}
