/**
 * Sanitize deck name for use in filename
 * Removes or replaces characters that are not safe for filenames
 */
export function sanitizeDeckName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, '_')  // Replace invalid filename chars
    .replace(/\s+/g, '_')            // Replace spaces with underscores
    .replace(/_+/g, '_')             // Collapse multiple underscores
    .replace(/^_|_$/g, '')           // Trim leading/trailing underscores
    .slice(0, 50)                    // Limit length
}

/**
 * Generate filename with format: デッキ名_日付_種類.拡張子
 * @param deckName - Name of the deck (optional)
 * @param type - Type of export (proxy, image, deck)
 * @param extension - File extension (pdf, png, json)
 */
export function generateFilename(
  deckName: string | null | undefined,
  type: 'proxy' | 'image' | 'deck',
  extension: 'pdf' | 'png' | 'json'
): string {
  const timestamp = new Date().toISOString().slice(0, 10)
  const sanitizedName = deckName ? sanitizeDeckName(deckName) : null

  if (sanitizedName) {
    return `${sanitizedName}_${timestamp}_${type}.${extension}`
  }
  return `deck_${timestamp}_${type}.${extension}`
}
