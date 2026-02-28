import html2canvas from 'html2canvas'

// Types
interface Card {
  id: string
  name: string
  image: string
}

interface DeckCard extends Card {
  count: number
}

interface DeckImageExportOptions {
  deck: DeckCard[]
  leader: Card | null
  apiBase: string
  onProgress?: (progress: number, loaded: number, total: number) => void
}

interface DeckImageExportResult {
  success: boolean
  filename?: string
  imageDataUrl?: string
  error?: string
}

// Constants
const COLS = 5  // 5列表示
const CARD_WIDTH = 180  // px
const CARD_HEIGHT = 250  // px
const GAP = 8  // px
const PADDING = 20  // px
const HEADER_HEIGHT = 40  // px
const CARD_ID_HEIGHT = 25  // px - カードID表示用の高さ

/**
 * Convert Blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Load image from URL and convert to base64
 */
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const blob = await response.blob()
    const base64 = await blobToBase64(blob)
    return base64
  } catch (error) {
    console.error(`Failed to load image: ${url}`, error)
    return null
  }
}

/**
 * Group deck cards by unique card and aggregate counts
 * Returns cards sorted by ID for display
 */
function groupDeckCards(deck: DeckCard[]): DeckCard[] {
  const grouped = new Map<string, DeckCard>()

  for (const card of deck) {
    const existing = grouped.get(card.id)
    if (existing) {
      existing.count += card.count
    } else {
      grouped.set(card.id, { ...card })
    }
  }

  return Array.from(grouped.values()).sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Export deck as image
 */
export async function exportDeckToImage(
  options: DeckImageExportOptions
): Promise<DeckImageExportResult> {
  const { deck, leader, apiBase, onProgress } = options

  // Container reference for cleanup in finally block
  let container: HTMLDivElement | null = null

  try {
    const groupedDeck = groupDeckCards(deck)
    const totalCards = groupedDeck.length + (leader ? 1 : 0)

    if (totalCards === 0) {
      return { success: false, error: 'No cards to export' }
    }

    // Pre-load all images as base64
    const imageMap = new Map<string, string>()
    const uniqueCards = [...new Map([...groupedDeck, ...(leader ? [leader] : [])].map(c => [c.id, c])).values()]

    let loadedCount = 0
    for (const card of uniqueCards) {
      const imageUrl = `${apiBase}${card.image}`
      const base64 = await loadImageAsBase64(imageUrl)
      if (base64) {
        imageMap.set(card.id, base64)
      }
      loadedCount++
      onProgress?.(Math.round((loadedCount / uniqueCards.length) * 80), loadedCount, uniqueCards.length)
    }

    // Calculate dimensions
    const deckRows = Math.ceil(groupedDeck.length / COLS)
    const deckSectionHeight = HEADER_HEIGHT + deckRows * (CARD_HEIGHT + CARD_ID_HEIGHT + GAP)
    const leaderSectionHeight = leader ? HEADER_HEIGHT + CARD_HEIGHT + CARD_ID_HEIGHT + GAP : 0
    const totalHeight = PADDING * 2 + deckSectionHeight + leaderSectionHeight + 20
    const totalWidth = PADDING * 2 + COLS * CARD_WIDTH + (COLS - 1) * GAP

    // Create container div
    container = document.createElement('div')
    container.style.cssText = `
      position: fixed;
      left: -9999px;
      top: 0;
      width: ${totalWidth}px;
      height: ${totalHeight}px;
      background: white;
      font-family: sans-serif;
      padding: ${PADDING}px;
      box-sizing: border-box;
    `
    document.body.appendChild(container)

    // Calculate total deck count
    const deckCount = deck.reduce((sum, card) => sum + card.count, 0)

    // Main deck header
    const deckHeader = document.createElement('div')
    deckHeader.style.cssText = `
      font-size: 18px;
      font-weight: bold;
      color: #333;
      margin-bottom: 10px;
      border-bottom: 2px solid #e74c3c;
      padding-bottom: 5px;
    `
    deckHeader.textContent = `メインデッキ ${deckCount}`
    container.appendChild(deckHeader)

    // Deck grid
    const deckGrid = document.createElement('div')
    deckGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(${COLS}, ${CARD_WIDTH}px);
      gap: ${GAP}px;
      margin-bottom: 20px;
    `
    container.appendChild(deckGrid)

    // Add deck cards
    for (const card of groupedDeck) {
      const cardWrapper = document.createElement('div')
      cardWrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
      `

      const cardDiv = document.createElement('div')
      cardDiv.style.cssText = `
        position: relative;
        width: ${CARD_WIDTH}px;
        height: ${CARD_HEIGHT}px;
      `

      // Get base64 image
      const base64 = imageMap.get(card.id)

      if (base64) {
        const imgEl = document.createElement('img')
        imgEl.src = base64
        imgEl.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        `
        cardDiv.appendChild(imgEl)
      } else {
        // Placeholder
        const placeholder = document.createElement('div')
        placeholder.style.cssText = `
          width: 100%;
          height: 100%;
          background: #ddd;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          color: #666;
        `
        placeholder.textContent = card.id
        cardDiv.appendChild(placeholder)
      }

      // Count badge (top-right)
      const countBadge = document.createElement('div')
      countBadge.style.cssText = `
        position: absolute;
        top: 5px;
        right: 5px;
        background: #e74c3c;
        color: white;
        font-size: 16px;
        font-weight: bold;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      `
      countBadge.textContent = String(card.count)
      cardDiv.appendChild(countBadge)

      cardWrapper.appendChild(cardDiv)

      // Card ID (below the card)
      const cardId = document.createElement('div')
      cardId.style.cssText = `
        text-align: center;
        font-size: 12px;
        color: #666;
        margin-top: 4px;
        height: ${CARD_ID_HEIGHT - 4}px;
      `
      cardId.textContent = card.id
      cardWrapper.appendChild(cardId)

      deckGrid.appendChild(cardWrapper)
    }

    // Leader section
    if (leader) {
      const leaderHeader = document.createElement('div')
      leaderHeader.style.cssText = `
        font-size: 18px;
        font-weight: bold;
        color: #333;
        margin-top: 20px;
        margin-bottom: 10px;
        border-bottom: 2px solid #9b59b6;
        padding-bottom: 5px;
      `
      leaderHeader.textContent = 'リーダー 1'
      container.appendChild(leaderHeader)

      const leaderWrapper = document.createElement('div')
      leaderWrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: flex-start;
      `

      const leaderDiv = document.createElement('div')
      leaderDiv.style.cssText = `
        position: relative;
        width: ${CARD_WIDTH}px;
        height: ${CARD_HEIGHT}px;
      `

      const base64 = imageMap.get(leader.id)

      if (base64) {
        const imgEl = document.createElement('img')
        imgEl.src = base64
        imgEl.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        `
        leaderDiv.appendChild(imgEl)
      } else {
        const placeholder = document.createElement('div')
        placeholder.style.cssText = `
          width: 100%;
          height: 100%;
          background: #ddd;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          color: #666;
        `
        placeholder.textContent = leader.id
        leaderDiv.appendChild(placeholder)
      }

      leaderWrapper.appendChild(leaderDiv)

      // Leader ID
      const leaderId = document.createElement('div')
      leaderId.style.cssText = `
        text-align: center;
        font-size: 12px;
        color: #666;
        margin-top: 4px;
        width: ${CARD_WIDTH}px;
      `
      leaderId.textContent = leader.id
      leaderWrapper.appendChild(leaderId)

      container.appendChild(leaderWrapper)
    }

    onProgress?.(90, totalCards, totalCards)

    // Wait for DOM to settle
    await new Promise(resolve => setTimeout(resolve, 100))

    // Convert to canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
    })

    onProgress?.(100, totalCards, totalCards)

    // Generate image data URL
    const timestamp = new Date().toISOString().slice(0, 10)
    const filename = `deck_image_${timestamp}.png`
    const imageDataUrl = canvas.toDataURL('image/png')

    return { success: true, filename, imageDataUrl }

  } catch (error) {
    console.error('Deck image generation failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  } finally {
    // Always cleanup container from DOM to prevent memory leaks
    if (container && container.parentNode) {
      container.parentNode.removeChild(container)
    }
  }
}
