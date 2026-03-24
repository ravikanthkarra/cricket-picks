export type MarginRule = { correct: number; wrong: number }
export type MarginConfig = Record<string, MarginRule>

export const DEFAULT_MARGIN_CONFIG: MarginConfig = {
  BLOWOUT:    { correct: 4,  wrong: -3 },
  NAIL_BITER: { correct: 3,  wrong: -2 },
  EASY:       { correct: 2,  wrong: -1 },
  NO_MARGIN:  { correct: 0,  wrong:  0 },
}

export function parseMarginConfig(raw: string | null | undefined): MarginConfig {
  if (!raw) return DEFAULT_MARGIN_CONFIG
  try {
    const parsed = JSON.parse(raw)
    // Fill in any missing keys with defaults
    return { ...DEFAULT_MARGIN_CONFIG, ...parsed }
  } catch {
    return DEFAULT_MARGIN_CONFIG
  }
}

/**
 * Scoring rules:
 *  - Wrong team pick                  → 0 (margin ignored entirely)
 *  - Correct team + no margin pick    → 0 margin points
 *  - Correct team + correct margin    → rule.correct  (bonus)
 *  - Correct team + wrong margin      → rule.wrong    (penalty, from the type they predicted)
 */
export function calcMarginPoints(
  marginPick: string | null,
  matchMargin: string | null,
  isCorrect: boolean,
  config: MarginConfig
): number {
  // Rule 4: wrong team pick → margin ignored
  if (!isCorrect) return 0
  // Rule 3: no margin predicted (or NO_MARGIN selected) → no effect
  if (!marginPick || marginPick === 'NO_MARGIN') return 0
  // No margin set on the match yet → no scoring
  if (!matchMargin || matchMargin === 'NO_MARGIN') return 0

  const rule = config[marginPick]
  if (!rule) return 0

  // Rule 1: correct margin → bonus; Rule 2: wrong margin → penalty
  return marginPick === matchMargin ? rule.correct : rule.wrong
}
