import type { TournamentWithMatches, Match } from '../types'
import { TOURNAMENT_TYPE_LABELS } from '../types'

const TWITTER_CHAR_LIMIT = 280
const HASHTAGS = '\n\n#ワンピカード #OPTCG'

/**
 * 日付を「M/D」形式でフォーマット
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
  }).format(date)
}

/**
 * 試合結果を絵文字に変換
 */
function resultToEmoji(result: Match['result']): string {
  switch (result) {
    case 'win':
      return '⭕'
    case 'loss':
      return '❌'
    case 'draw':
      return '△'
  }
}

/**
 * 対戦詳細のテキストを生成
 */
function generateMatchDetails(matches: Match[]): string {
  if (matches.length === 0) return ''

  const sortedMatches = [...matches].sort((a, b) => a.order - b.order)
  const lines = sortedMatches.map((match) => {
    const emoji = resultToEmoji(match.result)
    const opponent = match.opponentLeader?.name ?? '不明'
    return `R${match.order}: ${emoji} vs ${opponent}`
  })

  return '\n\n▼ 対戦詳細\n' + lines.join('\n')
}

/**
 * 大会結果のツイートテキストを生成
 */
export function generateTweetText(tournament: TournamentWithMatches): string {
  const typeLabel =
    tournament.type === 'other' && tournament.customTypeName
      ? tournament.customTypeName
      : TOURNAMENT_TYPE_LABELS[tournament.type]

  // 戦績テキスト
  const recordParts = [`${tournament.wins}勝`, `${tournament.losses}敗`]
  if (tournament.draws > 0) {
    recordParts.push(`${tournament.draws}分`)
  }
  const recordText = recordParts.join('')

  // 基本情報
  const header = `【${typeLabel}】${tournament.name}`
  const dateLine = `📅 ${formatDate(tournament.date)}`
  const leaderLine = tournament.myLeader
    ? `🎴 ${tournament.myLeader.name}`
    : ''
  const recordLine = `📊 ${recordText} (勝率${tournament.winRate.toFixed(0)}%)`

  // 基本部分を組み立て
  const basicParts = [header, dateLine]
  if (leaderLine) basicParts.push(leaderLine)
  basicParts.push(recordLine)
  const basicText = basicParts.join('\n')

  // 対戦詳細
  const matchDetails = generateMatchDetails(tournament.matches)

  // 全体を組み立て
  const fullText = basicText + matchDetails + HASHTAGS

  // 文字数制限チェック
  if (fullText.length <= TWITTER_CHAR_LIMIT) {
    return fullText
  }

  // 対戦詳細なしで試す
  const withoutDetails = basicText + HASHTAGS
  if (withoutDetails.length <= TWITTER_CHAR_LIMIT) {
    return withoutDetails
  }

  // それでも超える場合は基本情報のみ（大会名を切り詰め）
  const minHeader = `【${typeLabel}】`
  const minContent = [dateLine]
  if (leaderLine) minContent.push(leaderLine)
  minContent.push(recordLine)
  const minText = minContent.join('\n') + HASHTAGS

  const availableForName = TWITTER_CHAR_LIMIT - minHeader.length - minText.length - 1 // -1 for newline
  const truncatedName =
    tournament.name.length > availableForName
      ? tournament.name.slice(0, availableForName - 1) + '…'
      : tournament.name

  return minHeader + truncatedName + '\n' + minContent.join('\n') + HASHTAGS
}

/**
 * Twitter Intent URLを開く
 */
export function openTweetIntent(text: string): void {
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
  window.open(url, '_blank', 'width=550,height=420')
}

/**
 * 大会結果をツイートする
 */
export function shareTournamentResult(tournament: TournamentWithMatches): void {
  const text = generateTweetText(tournament)
  openTweetIntent(text)
}
