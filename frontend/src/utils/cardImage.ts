/**
 * カードIDから画像URLを取得するユーティリティ
 */

const CARD_IMAGE_BASE = 'https://www.onepiece-cardgame.com/images/cardlist/card/'

/**
 * カードIDから画像URLを生成
 * 例: OP01-001 -> https://www.onepiece-cardgame.com/images/cardlist/card/OP01-001.png
 */
export function getCardImageUrl(cardId: string): string {
  if (!cardId) return ''
  return `${CARD_IMAGE_BASE}${cardId}.png`
}

/**
 * 画像URLを取得（存在しない場合はカードIDから生成）
 */
export function resolveCardImage(image: string | undefined, cardId: string): string {
  if (image && image.startsWith('http')) {
    return image
  }
  return getCardImageUrl(cardId)
}
