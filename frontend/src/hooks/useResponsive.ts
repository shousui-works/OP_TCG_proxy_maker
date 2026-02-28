import { useState, useEffect, useCallback } from 'react'

export type Breakpoint = 'mobile' | 'mobileLg' | 'tablet' | 'desktop' | 'desktopLg'

interface ResponsiveState {
  breakpoint: Breakpoint
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  cardsPerRow: number
  width: number
}

const BREAKPOINTS = {
  mobileLg: 480,
  tablet: 768,
  desktop: 1024,
  desktopLg: 1280,
}

const CARDS_PER_ROW: Record<Breakpoint, number> = {
  mobile: 2,
  mobileLg: 3,
  tablet: 4,
  desktop: 5,
  desktopLg: 6,
}

function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS.desktopLg) return 'desktopLg'
  if (width >= BREAKPOINTS.desktop) return 'desktop'
  if (width >= BREAKPOINTS.tablet) return 'tablet'
  if (width >= BREAKPOINTS.mobileLg) return 'mobileLg'
  return 'mobile'
}

export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1280
    const breakpoint = getBreakpoint(width)
    return {
      breakpoint,
      isMobile: width < BREAKPOINTS.tablet,
      isTablet: width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop,
      isDesktop: width >= BREAKPOINTS.desktop,
      cardsPerRow: CARDS_PER_ROW[breakpoint],
      width,
    }
  })

  const handleResize = useCallback(() => {
    const width = window.innerWidth
    const breakpoint = getBreakpoint(width)
    setState({
      breakpoint,
      isMobile: width < BREAKPOINTS.tablet,
      isTablet: width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop,
      isDesktop: width >= BREAKPOINTS.desktop,
      cardsPerRow: CARDS_PER_ROW[breakpoint],
      width,
    })
  }, [])

  useEffect(() => {
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [handleResize])

  return state
}
