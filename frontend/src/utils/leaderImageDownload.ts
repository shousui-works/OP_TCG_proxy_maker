/**
 * リーダーカード画像をダウンロードする機能
 */

import { getCardImageUrl } from './cardImage'

interface LeaderInfo {
  id: string
  name: string
  image?: string
}

/**
 * パラレル版のサフィックスを除去してベースIDを取得
 */
function getBaseCardId(cardId: string): string {
  return cardId.replace(/_p\d+$/, '')
}

/**
 * リーダー画像をダウンロード
 */
export async function downloadLeaderImage(leader: LeaderInfo): Promise<boolean> {
  try {
    // cardImage.tsと同じURLを使用（開発環境はViteプロキシ経由）
    const imageUrl = getCardImageUrl(leader.id)

    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`)
    }
    const blob = await response.blob()

    // ダウンロードリンクを作成
    const baseId = getBaseCardId(leader.id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${baseId}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    return true
  } catch (error) {
    console.error('Failed to download leader image:', error)
    return false
  }
}
