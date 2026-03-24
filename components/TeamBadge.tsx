import Image from 'next/image'

type Props = {
  shortName: string
  primaryColor: string
  logoUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
}

export function TeamBadge({ shortName, primaryColor, logoUrl, size = 'md' }: Props) {
  const dims = { sm: 32, md: 44, lg: 56 }[size]
  const font = { sm: 9, md: 11, lg: 14 }[size]

  if (logoUrl) {
    return (
      <div
        style={{ width: dims, height: dims, flexShrink: 0 }}
        className="relative rounded-full overflow-hidden"
      >
        <Image
          src={logoUrl}
          alt={shortName}
          width={dims}
          height={dims}
          className="object-contain w-full h-full"
        />
      </div>
    )
  }

  // Fallback: colored circle with abbreviation
  return (
    <div
      style={{
        width: dims,
        height: dims,
        backgroundColor: primaryColor,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
      }}
    >
      <span
        style={{
          color: '#fff',
          fontWeight: 700,
          fontSize: font,
          letterSpacing: '0.03em',
          lineHeight: 1,
        }}
      >
        {shortName}
      </span>
    </div>
  )
}
