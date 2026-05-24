import type { Card } from '../types'

// 色のソート順
const COLOR_ORDER: Record<string, number> = {
  '赤': 1,
  '緑': 2,
  '青': 3,
  '紫': 4,
  '黒': 5,
  '黄': 6,
}

/**
 * カードソート関数: 色→コスト→名前→ID
 */
export function sortCards(a: Card, b: Card): number {
  // 色でソート（複数色の場合は最初の色、単色優先）
  const colorsA = (a.color || '').split('/')
  const colorsB = (b.color || '').split('/')
  const colorOrderA = COLOR_ORDER[colorsA[0]] ?? 99
  const colorOrderB = COLOR_ORDER[colorsB[0]] ?? 99
  if (colorOrderA !== colorOrderB) return colorOrderA - colorOrderB
  // 単色を複数色より優先
  if (colorsA.length !== colorsB.length) return colorsA.length - colorsB.length

  // コストでソート（リーダーはコストがないので0扱い）
  const costA = a.card_type === 'LEADER' ? 0 : parseInt(a.cost ?? '0', 10)
  const costB = b.card_type === 'LEADER' ? 0 : parseInt(b.cost ?? '0', 10)
  if (costA !== costB) return costA - costB

  // 名前でソート
  const nameA = a.name || ''
  const nameB = b.name || ''
  if (nameA !== nameB) return nameA.localeCompare(nameB, 'ja')

  // IDでソート
  return a.id.localeCompare(b.id)
}

/**
 * デッキ用ソート関数: コスト→名前→ID（色ソートなし）
 */
export function sortDeckCards(a: Card, b: Card): number {
  // コストでソート（リーダーはコストがないので0扱い）
  const costA = a.card_type === 'LEADER' ? 0 : parseInt(a.cost ?? '0', 10)
  const costB = b.card_type === 'LEADER' ? 0 : parseInt(b.cost ?? '0', 10)
  if (costA !== costB) return costA - costB

  // 名前でソート
  const nameA = a.name || ''
  const nameB = b.name || ''
  if (nameA !== nameB) return nameA.localeCompare(nameB, 'ja')

  // IDでソート
  return a.id.localeCompare(b.id)
}
