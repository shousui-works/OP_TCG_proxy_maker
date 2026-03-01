import { useReducer, useCallback } from 'react'
import type { TabType } from '../components/BottomNavigation'

// UI State
interface UIState {
  activeTab: TabType
  isFilterPanelOpen: boolean
  isMobileMenuOpen: boolean
  enableHoverZoom: boolean
}

// Modal State
interface ModalState {
  showSaveAsModal: boolean
  showPdfModal: boolean
  showImageModal: boolean
  showImportExportModal: boolean
  importExportMode: 'import' | 'export'
}

// Processing State
interface ProcessingState {
  isGeneratingPDF: boolean
  isGeneratingImage: boolean
  pdfProgress: number
  pdfLoadedCount: number
  pdfTotalCount: number
  imageProgress: number
}

// Combined App State
export interface AppState {
  ui: UIState
  modals: ModalState
  processing: ProcessingState
}

// Action Types
type AppAction =
  // UI Actions
  | { type: 'SET_ACTIVE_TAB'; payload: TabType }
  | { type: 'TOGGLE_FILTER_PANEL' }
  | { type: 'SET_FILTER_PANEL_OPEN'; payload: boolean }
  | { type: 'SET_MOBILE_MENU_OPEN'; payload: boolean }
  | { type: 'SET_HOVER_ZOOM'; payload: boolean }
  // Modal Actions
  | { type: 'OPEN_SAVE_AS_MODAL' }
  | { type: 'CLOSE_SAVE_AS_MODAL' }
  | { type: 'OPEN_PDF_MODAL' }
  | { type: 'CLOSE_PDF_MODAL' }
  | { type: 'OPEN_IMAGE_MODAL' }
  | { type: 'CLOSE_IMAGE_MODAL' }
  | { type: 'OPEN_IMPORT_MODAL' }
  | { type: 'OPEN_EXPORT_MODAL' }
  | { type: 'CLOSE_IMPORT_EXPORT_MODAL' }
  // Processing Actions
  | { type: 'START_PDF_GENERATION' }
  | { type: 'END_PDF_GENERATION' }
  | { type: 'SET_PDF_PROGRESS'; payload: { progress: number; loaded: number; total: number } }
  | { type: 'START_IMAGE_GENERATION' }
  | { type: 'END_IMAGE_GENERATION' }
  | { type: 'SET_IMAGE_PROGRESS'; payload: number }

// Initial State
const initialState: AppState = {
  ui: {
    activeTab: 'cards',
    isFilterPanelOpen: false,
    isMobileMenuOpen: false,
    enableHoverZoom: false,
  },
  modals: {
    showSaveAsModal: false,
    showPdfModal: false,
    showImageModal: false,
    showImportExportModal: false,
    importExportMode: 'export',
  },
  processing: {
    isGeneratingPDF: false,
    isGeneratingImage: false,
    pdfProgress: 0,
    pdfLoadedCount: 0,
    pdfTotalCount: 0,
    imageProgress: 0,
  },
}

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // UI Actions
    case 'SET_ACTIVE_TAB':
      return { ...state, ui: { ...state.ui, activeTab: action.payload } }
    case 'TOGGLE_FILTER_PANEL':
      return { ...state, ui: { ...state.ui, isFilterPanelOpen: !state.ui.isFilterPanelOpen } }
    case 'SET_FILTER_PANEL_OPEN':
      return { ...state, ui: { ...state.ui, isFilterPanelOpen: action.payload } }
    case 'SET_MOBILE_MENU_OPEN':
      return { ...state, ui: { ...state.ui, isMobileMenuOpen: action.payload } }
    case 'SET_HOVER_ZOOM':
      return { ...state, ui: { ...state.ui, enableHoverZoom: action.payload } }

    // Modal Actions
    case 'OPEN_SAVE_AS_MODAL':
      return { ...state, modals: { ...state.modals, showSaveAsModal: true } }
    case 'CLOSE_SAVE_AS_MODAL':
      return { ...state, modals: { ...state.modals, showSaveAsModal: false } }
    case 'OPEN_PDF_MODAL':
      return { ...state, modals: { ...state.modals, showPdfModal: true } }
    case 'CLOSE_PDF_MODAL':
      return { ...state, modals: { ...state.modals, showPdfModal: false } }
    case 'OPEN_IMAGE_MODAL':
      return { ...state, modals: { ...state.modals, showImageModal: true } }
    case 'CLOSE_IMAGE_MODAL':
      return { ...state, modals: { ...state.modals, showImageModal: false } }
    case 'OPEN_IMPORT_MODAL':
      return { ...state, modals: { ...state.modals, showImportExportModal: true, importExportMode: 'import' } }
    case 'OPEN_EXPORT_MODAL':
      return { ...state, modals: { ...state.modals, showImportExportModal: true, importExportMode: 'export' } }
    case 'CLOSE_IMPORT_EXPORT_MODAL':
      return { ...state, modals: { ...state.modals, showImportExportModal: false } }

    // Processing Actions
    case 'START_PDF_GENERATION':
      return { ...state, processing: { ...state.processing, isGeneratingPDF: true, pdfProgress: 0 } }
    case 'END_PDF_GENERATION':
      return { ...state, processing: { ...state.processing, isGeneratingPDF: false } }
    case 'SET_PDF_PROGRESS':
      return {
        ...state,
        processing: {
          ...state.processing,
          pdfProgress: action.payload.progress,
          pdfLoadedCount: action.payload.loaded,
          pdfTotalCount: action.payload.total,
        },
      }
    case 'START_IMAGE_GENERATION':
      return { ...state, processing: { ...state.processing, isGeneratingImage: true, imageProgress: 0 } }
    case 'END_IMAGE_GENERATION':
      return { ...state, processing: { ...state.processing, isGeneratingImage: false } }
    case 'SET_IMAGE_PROGRESS':
      return { ...state, processing: { ...state.processing, imageProgress: action.payload } }

    default:
      return state
  }
}

// Hook
export function useAppState() {
  const [state, dispatch] = useReducer(appReducer, initialState)

  // UI Actions
  const setActiveTab = useCallback((tab: TabType) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tab })
  }, [])

  const toggleFilterPanel = useCallback(() => {
    dispatch({ type: 'TOGGLE_FILTER_PANEL' })
  }, [])

  const setFilterPanelOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_FILTER_PANEL_OPEN', payload: open })
  }, [])

  const setMobileMenuOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_MOBILE_MENU_OPEN', payload: open })
  }, [])

  const setHoverZoom = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_HOVER_ZOOM', payload: enabled })
  }, [])

  // Modal Actions
  const openSaveAsModal = useCallback(() => dispatch({ type: 'OPEN_SAVE_AS_MODAL' }), [])
  const closeSaveAsModal = useCallback(() => dispatch({ type: 'CLOSE_SAVE_AS_MODAL' }), [])
  const openPdfModal = useCallback(() => dispatch({ type: 'OPEN_PDF_MODAL' }), [])
  const closePdfModal = useCallback(() => dispatch({ type: 'CLOSE_PDF_MODAL' }), [])
  const openImageModal = useCallback(() => dispatch({ type: 'OPEN_IMAGE_MODAL' }), [])
  const closeImageModal = useCallback(() => dispatch({ type: 'CLOSE_IMAGE_MODAL' }), [])
  const openImportModal = useCallback(() => dispatch({ type: 'OPEN_IMPORT_MODAL' }), [])
  const openExportModal = useCallback(() => dispatch({ type: 'OPEN_EXPORT_MODAL' }), [])
  const closeImportExportModal = useCallback(() => dispatch({ type: 'CLOSE_IMPORT_EXPORT_MODAL' }), [])

  // Processing Actions
  const startPdfGeneration = useCallback(() => dispatch({ type: 'START_PDF_GENERATION' }), [])
  const endPdfGeneration = useCallback(() => dispatch({ type: 'END_PDF_GENERATION' }), [])
  const setPdfProgress = useCallback((progress: number, loaded: number, total: number) => {
    dispatch({ type: 'SET_PDF_PROGRESS', payload: { progress, loaded, total } })
  }, [])
  const startImageGeneration = useCallback(() => dispatch({ type: 'START_IMAGE_GENERATION' }), [])
  const endImageGeneration = useCallback(() => dispatch({ type: 'END_IMAGE_GENERATION' }), [])
  const setImageProgress = useCallback((progress: number) => {
    dispatch({ type: 'SET_IMAGE_PROGRESS', payload: progress })
  }, [])

  return {
    state,
    // UI
    setActiveTab,
    toggleFilterPanel,
    setFilterPanelOpen,
    setMobileMenuOpen,
    setHoverZoom,
    // Modals
    openSaveAsModal,
    closeSaveAsModal,
    openPdfModal,
    closePdfModal,
    openImageModal,
    closeImageModal,
    openImportModal,
    openExportModal,
    closeImportExportModal,
    // Processing
    startPdfGeneration,
    endPdfGeneration,
    setPdfProgress,
    startImageGeneration,
    endImageGeneration,
    setImageProgress,
  }
}
