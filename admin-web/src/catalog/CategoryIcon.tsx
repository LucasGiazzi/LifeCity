import {
  CATEGORY_ICON_PATHS,
  resolveCategoryIconKey,
} from './categoryIconPaths'

type CategoryIconProps = {
  iconKey: string | null | undefined
  size?: number
  color?: string
  className?: string
}

export function CategoryIcon({
  iconKey,
  size = 20,
  color = 'currentColor',
  className,
}: CategoryIconProps) {
  const key = resolveCategoryIconKey(iconKey)

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden
      focusable="false"
    >
      <path d={CATEGORY_ICON_PATHS[key]} />
    </svg>
  )
}
