/** Marca do FalaCMG: balão de fala verde-limão (mesmo desenho do ícone do app). */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--panel-3)" />
      <path d="M16 7c-5.5 0-10 3.4-10 7.6 0 2.4 1.5 4.6 3.8 6l-1.3 4.2 4.6-2.8c.9.2 1.9.3 2.9.3 5.5 0 10-3.4 10-7.7S21.5 7 16 7z" fill="var(--accent)" />
      <circle cx="11.6" cy="14.6" r="1.4" fill="var(--panel-3)" />
      <circle cx="16" cy="14.6" r="1.4" fill="var(--panel-3)" />
      <circle cx="20.4" cy="14.6" r="1.4" fill="var(--panel-3)" />
    </svg>
  )
}
