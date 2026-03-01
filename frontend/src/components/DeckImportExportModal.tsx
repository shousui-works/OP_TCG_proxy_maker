import { useState, useMemo, useCallback } from 'react'
import type { Card, DeckCard } from '../types'
import { exportDeckToJson, copyDeckToClipboard, downloadDeckAsJson } from '../utils/deckJsonExport'
import { resolveDeckCards } from '../utils/deckJsonImport'
import type { ImportValidationResult } from '../utils/deckJsonImport'

interface DeckImportExportModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'import' | 'export'
  // Export mode props
  deck?: DeckCard[]
  leader?: Card | null
  deckName?: string | null
  // Import mode props
  availableCards?: Card[]
  onImport?: (deck: DeckCard[], leader: Card | null) => void
}

export default function DeckImportExportModal({
  isOpen,
  onClose,
  mode,
  deck = [],
  leader = null,
  deckName = null,
  availableCards = [],
  onImport,
}: DeckImportExportModalProps) {
  // Export state
  const [copySuccess, setCopySuccess] = useState(false)

  // Import state
  const [importText, setImportText] = useState('')

  // Generate export JSON using useMemo (no setState needed)
  const exportJson = useMemo(() => {
    if (mode === 'export') {
      const result = exportDeckToJson(deck, leader, deckName)
      if (result.success && result.data) {
        return result.data
      }
    }
    return ''
  }, [mode, deck, leader, deckName])

  // Validate import text using useMemo (no setState needed)
  const validationResult: ImportValidationResult | null = useMemo(() => {
    if (mode === 'import' && importText.trim()) {
      return resolveDeckCards(importText, availableCards)
    }
    return null
  }, [importText, mode, availableCards])

  // Handle close with state reset
  const handleClose = useCallback(() => {
    setImportText('')
    setCopySuccess(false)
    onClose()
  }, [onClose])

  const handleCopy = async () => {
    const success = await copyDeckToClipboard(exportJson)
    setCopySuccess(success)
    if (success) {
      setTimeout(() => setCopySuccess(false), 2000)
    }
  }

  const handleDownload = () => {
    downloadDeckAsJson(exportJson, deckName)
  }

  const handleImport = () => {
    if (validationResult?.valid && validationResult.parsedDeck && onImport) {
      onImport(validationResult.parsedDeck.cards, validationResult.parsedDeck.leader)
      handleClose()
    }
  }

  if (!isOpen) return null

  const totalCards = deck.reduce((sum, card) => sum + card.count, 0)

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal import-export-modal" onClick={e => e.stopPropagation()}>
        {mode === 'export' ? (
          <>
            <div className="modal-header">
              <h3>Export</h3>
              <button className="modal-close-btn" onClick={handleClose}>x</button>
            </div>
            <div className="export-summary">
              <span>Deck: {deckName || '(unnamed)'}</span>
              <span>Cards: {totalCards} | Leader: {leader?.name || 'none'}</span>
            </div>
            <div className="export-preview">
              <textarea
                value={exportJson}
                readOnly
                className="export-textarea"
              />
            </div>
            <div className="modal-actions">
              <button onClick={handleCopy} className={copySuccess ? 'success' : ''}>
                {copySuccess ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={handleDownload} className="primary">
                Download
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="modal-header">
              <h3>Import</h3>
              <button className="modal-close-btn" onClick={handleClose}>x</button>
            </div>
            <p className="modal-desc">
              Paste your deck JSON below:
            </p>
            <div className="import-input">
              <textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder='{"version": "1.0", "cards": [...]}'
                className="import-textarea"
              />
            </div>
            {validationResult && (
              <div className={`validation-result ${validationResult.valid ? 'valid' : 'invalid'}`}>
                {validationResult.valid ? (
                  <>
                    <div className="validation-success">
                      Valid deck found
                    </div>
                    {validationResult.parsedDeck && (
                      <div className="validation-details">
                        <span>Leader: {validationResult.parsedDeck.leader?.name || 'none'}</span>
                        <span>Cards: {validationResult.parsedDeck.cards.reduce((sum, c) => sum + c.count, 0)} ({validationResult.parsedDeck.cards.length} unique)</span>
                      </div>
                    )}
                    {validationResult.warnings.length > 0 && (
                      <div className="validation-warnings">
                        {validationResult.warnings.map((warning, i) => (
                          <div key={i} className="warning-item">{warning}</div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="validation-errors">
                    {validationResult.errors.map((error, i) => (
                      <div key={i} className="error-item">{error}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="modal-actions">
              <button onClick={handleClose}>Cancel</button>
              <button
                onClick={handleImport}
                className="primary"
                disabled={!validationResult?.valid}
              >
                Import
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
