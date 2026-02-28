import jsPDF from 'jspdf'

// Types
interface Card {
  id: string
  name: string
  image: string
}

interface DeckCard extends Card {
  count: number
}

interface PDFExportOptions {
  deck: DeckCard[]
  leader: Card | null
  apiBase: string
  onProgress?: (progress: number, loaded: number, total: number) => void
}

interface PDFExportResult {
  success: boolean
  filename?: string
  error?: string
  failedImages?: string[]
}

// Constants (all in mm)
const A4_WIDTH = 210
const A4_HEIGHT = 297
const CARD_WIDTH = 63
const CARD_HEIGHT = 88
const COLS = 3
const ROWS = 3
const CARDS_PER_PAGE = COLS * ROWS
const LINE_WIDTH = 0.5 // Gap between cards for cut lines
const GRID_WIDTH = CARD_WIDTH * COLS + LINE_WIDTH * (COLS + 1)
const GRID_HEIGHT = CARD_HEIGHT * ROWS + LINE_WIDTH * (ROWS + 1)
const MARGIN_X = (A4_WIDTH - GRID_WIDTH) / 2
const MARGIN_Y = (A4_HEIGHT - GRID_HEIGHT) / 2

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
 * Expand deck cards based on their count
 * Leader (1) + Deck cards (count each) = up to 51 cards total
 */
function expandDeck(deck: DeckCard[], leader: Card | null): Card[] {
  const expanded: Card[] = []

  // Add leader first
  if (leader) {
    expanded.push(leader)
  }

  // Expand deck cards based on count
  deck.forEach(card => {
    for (let i = 0; i < card.count; i++) {
      expanded.push(card)
    }
  })

  return expanded
}

/**
 * Calculate card position on page (with gaps for cut lines)
 */
function getCardPosition(index: number): { x: number; y: number } {
  const col = index % COLS
  const row = Math.floor(index / COLS)
  return {
    x: MARGIN_X + LINE_WIDTH + col * (CARD_WIDTH + LINE_WIDTH),
    y: MARGIN_Y + LINE_WIDTH + row * (CARD_HEIGHT + LINE_WIDTH)
  }
}

/**
 * Draw cut lines (grid lines between cards)
 */
function drawCutLines(pdf: jsPDF): void {
  pdf.setDrawColor(0) // Black
  pdf.setLineWidth(LINE_WIDTH)

  // Vertical lines (between columns and at edges)
  for (let col = 0; col <= COLS; col++) {
    const x = MARGIN_X + LINE_WIDTH / 2 + col * (CARD_WIDTH + LINE_WIDTH)
    pdf.line(x, MARGIN_Y, x, MARGIN_Y + GRID_HEIGHT)
  }

  // Horizontal lines (between rows and at edges)
  for (let row = 0; row <= ROWS; row++) {
    const y = MARGIN_Y + LINE_WIDTH / 2 + row * (CARD_HEIGHT + LINE_WIDTH)
    pdf.line(MARGIN_X, y, MARGIN_X + GRID_WIDTH, y)
  }
}

/**
 * Load image from URL and convert to base64
 */
async function loadImage(url: string): Promise<string | null> {
  try {
    console.log('Fetching:', url)
    const response = await fetch(url)
    console.log('Response status:', response.status, 'ok:', response.ok)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const blob = await response.blob()
    console.log('Blob size:', blob.size, 'type:', blob.type)
    const base64 = await blobToBase64(blob)
    console.log('Base64 length:', base64.length)
    return base64
  } catch (error) {
    console.error(`Failed to load image: ${url}`, error)
    return null
  }
}

/**
 * Export deck to PDF with 3x3 card layout on A4 paper
 */
export async function exportDeckToPDF(
  options: PDFExportOptions
): Promise<PDFExportResult> {
  const { deck, leader, apiBase, onProgress } = options

  try {
    console.log('=== PDF Export Debug ===')
    console.log('Deck:', JSON.stringify(deck, null, 2))
    console.log('Leader:', JSON.stringify(leader, null, 2))

    // Expand deck to full card list
    const allCards = expandDeck(deck, leader)
    console.log('All cards count:', allCards.length)
    if (allCards.length === 0) {
      return { success: false, error: 'No cards to export' }
    }

    // Get unique cards for efficient image loading
    const uniqueCards = [...new Map(allCards.map(c => [c.id, c])).values()]
    const totalImages = uniqueCards.length
    console.log('Unique cards:', uniqueCards.map(c => ({ id: c.id, image: c.image })))

    // Load all unique images
    const imageMap = new Map<string, string>()
    const failedImages: string[] = []

    for (let i = 0; i < uniqueCards.length; i++) {
      const card = uniqueCards[i]
      console.log('Loading card:', card.id, 'image:', card.image)
      const imageUrl = `${apiBase}${card.image}`
      console.log('Full URL:', imageUrl)
      const base64 = await loadImage(imageUrl)

      if (base64) {
        imageMap.set(card.id, base64)
      } else {
        failedImages.push(card.name || card.id)
      }

      // Report progress
      const progress = Math.round(((i + 1) / totalImages) * 100)
      onProgress?.(progress, i + 1, totalImages)
    }

    // Create PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    // Draw cut lines on first page
    drawCutLines(pdf)

    // Add cards to PDF
    for (let i = 0; i < allCards.length; i++) {
      const card = allCards[i]
      const positionOnPage = i % CARDS_PER_PAGE

      // Add new page if needed (not for first card)
      if (positionOnPage === 0 && i > 0) {
        pdf.addPage()
        drawCutLines(pdf) // Draw cut lines on new page
      }

      // Get position
      const { x, y } = getCardPosition(positionOnPage)

      // Add image if available
      const base64 = imageMap.get(card.id)
      if (base64) {
        pdf.addImage(base64, 'PNG', x, y, CARD_WIDTH, CARD_HEIGHT)
      } else {
        // Draw placeholder rectangle with card name
        pdf.setDrawColor(200)
        pdf.setLineWidth(0.5)
        pdf.rect(x, y, CARD_WIDTH, CARD_HEIGHT)
        pdf.setFontSize(8)
        pdf.setTextColor(100)
        const name = card.name || card.id
        // Truncate long names
        const displayName = name.length > 15 ? name.slice(0, 15) + '...' : name
        pdf.text(displayName, x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2, {
          align: 'center'
        })
      }
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 10)
    const filename = `deck_proxy_${timestamp}.pdf`

    // Download PDF
    pdf.save(filename)

    return {
      success: true,
      filename,
      failedImages: failedImages.length > 0 ? failedImages : undefined
    }

  } catch (error) {
    console.error('PDF generation failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
