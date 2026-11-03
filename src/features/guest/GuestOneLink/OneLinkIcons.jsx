const PATHS = {
  phone: <path d="M6.6 3.5h3l1.4 4-2 1.3a11 11 0 0 0 5.2 5.2l1.3-2 4 1.4v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.6 5.7 2 2 0 0 1 6.6 3.5Z" />,
  whatsapp: (
    <path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.3-1.1A8.5 8.5 0 1 0 12 3.5Zm4.2 11.7c-.2.5-1.1 1-1.6 1-.4.1-1 .1-3.2-.8-2.6-1.1-4.2-3.7-4.4-3.9-.1-.2-1-1.3-1-2.5 0-1.2.6-1.8.9-2 .2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.1.1.3 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6.2.3.7 1.2 1.6 1.9 1.1 1 2 1.3 2.3 1.4.3.1.4.1.6-.1l.7-.9c.2-.3.4-.2.6-.1l1.8.9c.3.1.4.2.5.3.1.2.1.8-.2 1.5Z" />
  ),
  pin: <path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15.4 12 21 12 21Zm0-8.3a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Z" />,
  mail: <path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm1.5 2 6.5 4.8L18.5 8" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  qr: <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-4 4h2v2h-2v-2Zm4 0h2v2h-2v-2Z" />,
  user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0H5Z" />,
  copy: <path d="M9 9h10v11H9V9Zm-4 6V4h10v2H7v9H5Z" />,
  share: <path d="M18 8a3 3 0 1 0-2.8-4L8.9 7.4a3 3 0 1 0 0 5.2l6.3 3.4A3 3 0 1 0 16 14l-6.3-3.4c.1-.5.1-.7 0-1.2L16 6.1c.5.9 1.1 1.9 2 1.9Z" />,
  download: <path d="M11 4h2v8l3-3 1.4 1.4L12 15.8 6.6 10.4 8 9l3 3V4ZM5 18h14v2H5v-2Z" />,
  facebook: <path d="M13.5 21v-8h2.7l.4-3.2h-3.1V7.9c0-.9.3-1.5 1.6-1.5h1.7V3.5c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2v2.2H7.5V13h2.8v8h3.2Z" />,
  instagram: (
    <path d="M8 3.5h8A4.5 4.5 0 0 1 20.5 8v8a4.5 4.5 0 0 1-4.5 4.5H8A4.5 4.5 0 0 1 3.5 16V8A4.5 4.5 0 0 1 8 3.5Zm0 1.8A2.7 2.7 0 0 0 5.3 8v8A2.7 2.7 0 0 0 8 18.7h8a2.7 2.7 0 0 0 2.7-2.7V8A2.7 2.7 0 0 0 16 5.3H8Zm4 2.4a4.3 4.3 0 1 1 0 8.6 4.3 4.3 0 0 1 0-8.6Zm0 1.8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm4.6-2.6a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
  ),
  globe: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="8.5" />
      <ellipse cx="12" cy="12" rx="3.8" ry="8.5" />
      <path d="M3.5 12h17" />
    </g>
  ),
}

export function Icon({ name, size = 18 }) {
  return (
    <svg className="gol-icon" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0" aria-hidden="true" focusable="false">
      {PATHS[name] || null}
    </svg>
  )
}
