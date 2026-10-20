// Selo ✦ Premium — estrela dourada discreta ao lado do nome.
export function PremiumBadge({ label = false, className = '' }: { label?: boolean; className?: string }) {
  return (
    <span title="Premium" aria-label="Premium" className={`inline-flex shrink-0 items-center gap-1 align-middle ${className}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#E7B23A' }} aria-hidden>
        <path d="M12 2.4l2.63 5.56 6.07.86-4.4 4.2 1.06 6.04L12 16.9l-5.43 2.16 1.06-6.04-4.4-4.2 6.07-.86L12 2.4z" />
      </svg>
      {label && <span className="text-[11px] font-semibold" style={{ color: '#E7B23A' }}>Premium</span>}
    </span>
  )
}
