import { themeQuartz } from 'ag-grid-community'

/**
 * One dense theme for every grid: spreadsheet-height rows, small type, hairline rules.
 * Colours come from the app's CSS tokens, so light and dark mode follow the toggle.
 */
export const gridTheme = themeQuartz.withParams({
  fontFamily: 'inherit',
  fontSize: 12,
  headerFontSize: 11,
  headerFontWeight: 600,
  rowHeight: 24,
  headerHeight: 26,
  spacing: 4,
  cellHorizontalPadding: 8,
  iconSize: 12,

  backgroundColor: 'var(--color-surface)',
  foregroundColor: 'var(--color-text)',
  headerBackgroundColor: 'var(--color-surface-muted)',
  headerTextColor: 'var(--color-text-muted)',
  borderColor: 'var(--color-border)',
  accentColor: 'var(--color-accent)',
  oddRowBackgroundColor: 'var(--color-surface)',
  headerColumnResizeHandleColor: 'var(--color-border)',
  valueChangeValueHighlightBackgroundColor: 'var(--color-flash)',

  wrapperBorder: false,
  wrapperBorderRadius: 0,
  columnBorder: false,
  rowBorder: true,
})
