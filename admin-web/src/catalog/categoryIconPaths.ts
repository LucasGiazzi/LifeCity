export const CATEGORY_ICON_PATHS: Record<string, string> = {
  construction:
    'M18.17 4.91l-1.41 1.41 1.41 1.41-1.41 1.41 1.41 1.41-1.41 1.41-4.24-4.24-5.66 5.66 1.41 1.41-1.41 1.41 1.41 1.41-1.41 1.41 1.41 1.41 1.41-1.41 1.41 1.41 1.41-1.41-1.41-1.41 1.41-1.41-1.41-1.41 5.66-5.66 4.24 4.24 1.41-1.41-1.41-1.41 1.41-1.41-1.41-1.41 1.41-1.41-1.41-1.41zM2 20h9v-2H4V10H2v10z',
  security:
    'M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z',
  cleaning_services:
    'M16 11V3H8v6H6v2h1v8c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2v-8h1v-2h-2zm-2 0H10V5h4v6zM9 19v-6h6v6H9z',
  traffic:
    'M9.5 6.5v3h-3v-3h3M11 5H5v6h6V5zm-1.5 9.5v3h-3v-3h3M11 13H5v6h6v-6zm6.5-6.5v3h-3v-3h3M19 5h-6v6h6V5zm-6.5 9.5v3h-3v-3h3M19 13h-6v6h6v-6z',
  report_problem:
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
  help_outline:
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z',
  category:
    'M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.87L12 5.84zM17.5 13c-2.49 0-4.5 2.01-4.5 4.5s2.01 4.5 4.5 4.5 4.5-2.01 4.5-4.5-2.01-4.5-4.5-4.5zm-11 0C4.01 13 2 15.01 2 17.5S4.01 22 6.5 22 11 19.99 11 17.5 8.99 13 6.5 13z',
}

export function resolveCategoryIconKey(
  iconKey: string | null | undefined
): string {
  if (!iconKey) return 'category'
  if (CATEGORY_ICON_PATHS[iconKey]) return iconKey
  return 'category'
}

export function categoryIconSvgMarkup(
  iconKey: string | null | undefined,
  size: number,
  color: string
): string {
  const key = resolveCategoryIconKey(iconKey)
  const path = CATEGORY_ICON_PATHS[key]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`
}
