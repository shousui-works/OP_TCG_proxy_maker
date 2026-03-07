/**
 * 日本語テキスト正規化ユーティリティ
 * カタカナ/ひらがな、全角/半角の統一、記号除去を行う
 */

/**
 * ひらがなをカタカナに変換
 * Unicode範囲: ぁ-ん (0x3041-0x3096) → ァ-ン (0x30A1-0x30F6)
 */
function hiraganaToKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 0x60)
  )
}

/**
 * 全角英数字を半角に変換
 * Ａ-Ｚ (0xFF21-0xFF3A) → A-Z
 * ａ-ｚ (0xFF41-0xFF5A) → a-z
 * ０-９ (0xFF10-0xFF19) → 0-9
 */
function fullwidthToHalfwidth(str: string): string {
  return str.replace(/[\uFF21-\uFF3A\uFF41-\uFF5A\uFF10-\uFF19]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  )
}

/**
 * 半角カタカナを全角カタカナに変換
 */
const HALFWIDTH_KATAKANA_MAP: Record<string, string> = {
  ｱ: 'ア',
  ｲ: 'イ',
  ｳ: 'ウ',
  ｴ: 'エ',
  ｵ: 'オ',
  ｶ: 'カ',
  ｷ: 'キ',
  ｸ: 'ク',
  ｹ: 'ケ',
  ｺ: 'コ',
  ｻ: 'サ',
  ｼ: 'シ',
  ｽ: 'ス',
  ｾ: 'セ',
  ｿ: 'ソ',
  ﾀ: 'タ',
  ﾁ: 'チ',
  ﾂ: 'ツ',
  ﾃ: 'テ',
  ﾄ: 'ト',
  ﾅ: 'ナ',
  ﾆ: 'ニ',
  ﾇ: 'ヌ',
  ﾈ: 'ネ',
  ﾉ: 'ノ',
  ﾊ: 'ハ',
  ﾋ: 'ヒ',
  ﾌ: 'フ',
  ﾍ: 'ヘ',
  ﾎ: 'ホ',
  ﾏ: 'マ',
  ﾐ: 'ミ',
  ﾑ: 'ム',
  ﾒ: 'メ',
  ﾓ: 'モ',
  ﾔ: 'ヤ',
  ﾕ: 'ユ',
  ﾖ: 'ヨ',
  ﾗ: 'ラ',
  ﾘ: 'リ',
  ﾙ: 'ル',
  ﾚ: 'レ',
  ﾛ: 'ロ',
  ﾜ: 'ワ',
  ｦ: 'ヲ',
  ﾝ: 'ン',
  ｧ: 'ァ',
  ｨ: 'ィ',
  ｩ: 'ゥ',
  ｪ: 'ェ',
  ｫ: 'ォ',
  ｬ: 'ャ',
  ｭ: 'ュ',
  ｮ: 'ョ',
  ｯ: 'ッ',
  ｰ: 'ー',
}

function halfwidthKatakanaToFullwidth(str: string): string {
  return str.replace(/[\uFF65-\uFF9F]/g, (char) => HALFWIDTH_KATAKANA_MAP[char] || char)
}

/**
 * 無視する記号パターン
 * ・（中黒）、ー（長音）、空白、ハイフン系など
 */
// eslint-disable-next-line no-irregular-whitespace
const IGNORE_SYMBOLS_PATTERN = /[・\-－ー\s　·!！?？。、,，.．:：;；'"'""[\]【】()（）{}「」『』《》〈〉]/g

/**
 * 小書きカタカナを通常サイズに変換
 * ァ→ア、ィ→イ、ゥ→ウ、ェ→エ、ォ→オ、ッ→ツ、ャ→ヤ、ュ→ユ、ョ→ヨ、ヮ→ワ
 */
const SMALL_KATAKANA_MAP: Record<string, string> = {
  ァ: 'ア',
  ィ: 'イ',
  ゥ: 'ウ',
  ェ: 'エ',
  ォ: 'オ',
  ッ: 'ツ',
  ャ: 'ヤ',
  ュ: 'ユ',
  ョ: 'ヨ',
  ヮ: 'ワ',
}

function smallKatakanaToNormal(str: string): string {
  return str.replace(/[ァィゥェォッャュョヮ]/g, (char) => SMALL_KATAKANA_MAP[char] || char)
}

/**
 * テキストを正規化（検索用）
 * 1. 小文字化
 * 2. 全角英数字 → 半角
 * 3. 半角カタカナ → 全角カタカナ
 * 4. ひらがな → カタカナ
 * 5. 小書きカタカナ → 通常サイズ（ティ→テイ、ディ→デイ等）
 * 6. 記号除去
 */
export function normalizeForSearch(text: string): string {
  if (!text) return ''

  let result = text.toLowerCase()
  result = fullwidthToHalfwidth(result)
  result = halfwidthKatakanaToFullwidth(result)
  result = hiraganaToKatakana(result)
  result = smallKatakanaToNormal(result)
  result = result.replace(IGNORE_SYMBOLS_PATTERN, '')

  return result
}

/**
 * Levenshtein距離（編集距離）の計算
 * スペース最適化版（1行のみ保持）
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length

  if (m === 0) return n
  if (n === 0) return m

  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  let curr = new Array<number>(n + 1)

  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j] + 1, // 削除
        curr[j - 1] + 1, // 挿入
        prev[j - 1] + cost // 置換
      )
    }
    ;[prev, curr] = [curr, prev]
  }

  return prev[n]
}

/**
 * あいまい検索
 * 正規化後の部分一致 + 許容編集距離でのマッチ
 *
 * @param target 検索対象テキスト
 * @param query 検索クエリ
 * @param maxDistance 許容する最大編集距離（デフォルト: 1）
 * @returns マッチしたかどうか
 */
export function fuzzyMatch(target: string, query: string, maxDistance: number = 1): boolean {
  const normalizedTarget = normalizeForSearch(target)
  const normalizedQuery = normalizeForSearch(query)

  // 完全一致チェック（高速）
  if (normalizedTarget.includes(normalizedQuery)) {
    return true
  }

  // クエリが短すぎる場合はあいまい検索しない（誤マッチ防止）
  if (normalizedQuery.length < 3) {
    return false
  }

  // ターゲットが短すぎる場合
  if (normalizedTarget.length < normalizedQuery.length - maxDistance) {
    return false
  }

  // スライディングウィンドウで部分マッチを探す
  const queryLen = normalizedQuery.length
  const windowSize = queryLen + maxDistance

  for (let i = 0; i <= normalizedTarget.length - queryLen + maxDistance; i++) {
    const windowEnd = Math.min(i + windowSize, normalizedTarget.length)
    const window = normalizedTarget.slice(i, windowEnd)

    // ウィンドウ内でクエリとの距離を計算
    for (let j = Math.max(1, queryLen - maxDistance); j <= Math.min(window.length, queryLen + maxDistance); j++) {
      const substring = window.slice(0, j)
      const distance = levenshteinDistance(substring, normalizedQuery)
      if (distance <= maxDistance) {
        return true
      }
    }
  }

  return false
}
