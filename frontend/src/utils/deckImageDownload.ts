/**
 * デッキ画像をダウンロードする機能
 * バージョンデータからデッキを復元して画像を生成
 */

import type { DeckVersionRef } from '../types'
import { exportDeckToImage } from './deckImageExport'
import { getCardImageUrl } from './cardImage'

interface DeckData {
  deck: { id: string; name: string; image: string; count: number }[]
  leader: { id: string; name: string; image: string } | null
}

interface DownloadDeckImageOptions {
  branchName: string
  versionRef?: DeckVersionRef | null
  getVersion?: (branchName: string, versionId: string) => Promise<DeckData | null>
  getDeck?: (branchName: string) => Promise<DeckData>
  onProgress?: (progress: number) => void
}

/**
 * パラレル版のサフィックスを除去してベースIDを取得
 */
function getBaseCardId(cardId: string): string {
  return cardId.replace(/_p\d+$/, '')
}

/**
 * デッキ画像をダウンロード
 */
export async function downloadDeckImage(options: DownloadDeckImageOptions): Promise<boolean> {
  const { branchName, versionRef, getVersion, getDeck, onProgress } = options

  try {
    onProgress?.(10)

    // デッキデータを取得（バージョン指定があればバージョンから、なければ現在のデッキから）
    let deckData: DeckData | null = null

    if (versionRef && getVersion) {
      // バージョンからデッキデータを取得
      deckData = await getVersion(branchName, versionRef.versionId)
    } else if (getDeck) {
      // 現在のデッキデータを取得
      deckData = await getDeck(branchName)
    }

    if (!deckData) {
      console.error('Failed to get deck data')
      return false
    }

    onProgress?.(20)

    // 画像URLをViteプロキシ経由のURLに変換
    const deckWithProxyUrls = deckData.deck.map(card => ({
      ...card,
      image: getCardImageUrl(card.id),
    }))

    const leaderWithProxyUrl = deckData.leader
      ? {
          ...deckData.leader,
          image: getCardImageUrl(deckData.leader.id),
        }
      : null

    // デッキ名を生成（バージョン名またはリーダー名）
    const deckName = versionRef?.versionName || leaderWithProxyUrl?.name || 'deck'

    // apiBaseは空文字（getCardImageUrlで完全なURLを生成済み）
    const result = await exportDeckToImage({
      deck: deckWithProxyUrls,
      leader: leaderWithProxyUrl,
      apiBase: '',
      deckName,
      onProgress: (progress) => {
        // 20-100の範囲にマッピング
        onProgress?.(20 + Math.round(progress * 0.8))
      },
    })

    if (!result.success || !result.imageDataUrl) {
      console.error('Failed to generate deck image:', result.error)
      return false
    }

    // 画像をダウンロード
    const baseLeaderId = leaderWithProxyUrl ? getBaseCardId(leaderWithProxyUrl.id) : 'deck'
    const a = document.createElement('a')
    a.href = result.imageDataUrl
    a.download = result.filename || `${baseLeaderId}_deck.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    onProgress?.(100)
    return true
  } catch (error) {
    console.error('Failed to download deck image:', error)
    return false
  }
}
