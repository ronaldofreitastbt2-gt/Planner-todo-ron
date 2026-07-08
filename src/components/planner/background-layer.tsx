import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/hooks/use-auth'
import { SVG_PRESETS } from '@/lib/settings-defaults'

export function BackgroundLayer() {
  const { user } = useAuth()
  const uid = user?.id?.toString() ?? ''
  const settings = useLiveQuery(() => uid ? db.settings.where('userId').equals(uid).first() : undefined, [uid])

  if (!settings) return null

  const { bgType, bgColor, bgSvgPreset, bgImageDataUrl, bgOverlayOpacity, bgOverlayBlur } =
    settings

  const hasBg =
    (bgType === 'color' && bgColor) ||
    (bgType === 'svg' && bgSvgPreset && bgSvgPreset !== 'none') ||
    ((bgType === 'image' || bgType === 'gif') && bgImageDataUrl)

  const hasOverlay = bgOverlayOpacity !== 0 || bgOverlayBlur > 0

  const overlayColor = bgOverlayOpacity > 0
    ? `rgba(0,0,0,${bgOverlayOpacity / 100})`
    : bgOverlayOpacity < 0
      ? `rgba(255,255,255,${Math.abs(bgOverlayOpacity) / 100})`
      : undefined

  return (
    <>
      {/* Background layer */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: -2 }}>
        {bgType === 'color' && bgColor && (
          <div className="absolute inset-0" style={{ backgroundColor: bgColor }} />
        )}

        {bgType === 'svg' && bgSvgPreset && bgSvgPreset !== 'none' && (
          <div
            className="absolute inset-0 [&>svg]:w-full [&>svg]:h-full"
            style={{ '--tw-bg-start': 'var(--primary)', '--tw-bg-end': 'var(--background)' } as React.CSSProperties}
            dangerouslySetInnerHTML={{ __html: SVG_PRESETS[bgSvgPreset]?.render() ?? '' }}
          />
        )}

        {(bgType === 'image' || bgType === 'gif') && bgImageDataUrl && (
          <img
            src={bgImageDataUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
      </div>

      {/* Overlay */}
      {hasBg && hasOverlay && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: -1,
            backgroundColor: overlayColor,
            backdropFilter: bgOverlayBlur > 0 ? `blur(${bgOverlayBlur}px)` : undefined,
          }}
        />
      )}
    </>
  )
}
