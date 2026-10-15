import { useEffect, type ReactNode } from 'react'

export function Modal({ onClose, children, className = '' }: { onClose: () => void; children: ReactNode; className?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={`backdrop ${className}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      {children}
    </div>
  )
}
