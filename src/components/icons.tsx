type IconProps = {
  className?: string
  title?: string
}

function baseProps(props: IconProps) {
  return {
    className: props.className,
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': props.title ? undefined : true,
    role: props.title ? ('img' as const) : undefined,
  }
}

export function IconCamera(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M4.5 8.5h2.1l1.2-2h8.4l1.2 2H19.5A1.5 1.5 0 0 1 21 10v8.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5V10a1.5 1.5 0 0 1 1.5-1.5Z" />
      <circle cx="12" cy="14" r="3.2" />
    </svg>
  )
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.9 6.4l1.6 1.6M17.5 16l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 17.6l1.6-1.6M17.5 8l1.6-1.6" />
    </svg>
  )
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  )
}

export function IconHeartOutline(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M12 19s-6.5-4.1-6.5-8.2A3.7 3.7 0 0 1 9.2 7c1.2 0 2 .6 2.8 1.5C12.8 7.6 13.6 7 14.8 7a3.7 3.7 0 0 1 3.7 3.8C18.5 14.9 12 19 12 19Z" />
    </svg>
  )
}
