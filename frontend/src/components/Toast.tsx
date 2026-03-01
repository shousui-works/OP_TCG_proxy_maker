import { useEffect, useRef } from 'react'
import './Toast.css'

interface ToastProps {
  message: string
  isVisible: boolean
  onClose: () => void
  duration?: number
}

export default function Toast({ message, isVisible, onClose, duration = 2000 }: ToastProps) {
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isVisible) return

    const timer = setTimeout(() => {
      onCloseRef.current()
    }, duration)

    return () => clearTimeout(timer)
  }, [isVisible, duration, message])

  if (!isVisible) return null

  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="toast-message">{message}</span>
    </div>
  )
}
