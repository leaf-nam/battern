export function BrandMark(props) {
  return (
    <svg viewBox="0 0 40 40" className="brand-mark" aria-hidden="true" {...props}>
      <circle cx="20" cy="20" r="19" fill="#0b0b0c" stroke="#e3b23c" strokeWidth="1.4" />
      <path
        d="M9 24c4-6 9-10 11-10s2 2-1 5-9 8-8 10 6-1 10-5 4-8 3-9"
        fill="none"
        stroke="#e3b23c"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="12" cy="26" r="1.3" fill="#e3b23c" />
      <circle cx="28" cy="14" r="1.3" fill="#e3b23c" />
    </svg>
  )
}

export const ICONS = {
  select: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M5 3l5.5 15 2-6.5L19 9.5 5 3z" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  line: (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="5" cy="19" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="5" r="1.6" fill="currentColor" stroke="none" />
      <path d="M5 19L19 5" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  arc: (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="4" cy="18" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="20" cy="18" r="1.6" fill="currentColor" stroke="none" />
      <path d="M4 18A10 10 0 0 1 20 18" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  curve: (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="4" cy="19" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="20" cy="6" r="1.6" fill="currentColor" stroke="none" />
      <path d="M4 19C10 19 8 6 20 6" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  seam: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M4 18L20 6" strokeWidth="1.4" strokeDasharray="2 2" />
      <path d="M4 21L20 9" strokeWidth="1.4" />
    </svg>
  ),
  fillet: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M6 20L6 10C6 6.7 8.7 4 12 4L18 4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="20" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18" cy="4" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  ),
  background: (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="1.5" strokeWidth="1.6" />
      <circle cx="8.5" cy="10.5" r="2" strokeWidth="1.4" />
      <path d="M2 17l5-5 3 3 4-4 8 8" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
}
