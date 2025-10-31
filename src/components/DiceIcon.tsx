import type { ReactNode } from 'react'
import './DiceIcon.css'

interface DiceIconProps {
  value: number
  isSelected?: boolean
  isBanked?: boolean
  isSelectable?: boolean
  onClick?: () => void
  className?: string
}

export function DiceIcon({ 
  value, 
  isSelected = false, 
  isBanked = false, 
  isSelectable = false,
  onClick,
  className = ''
}: DiceIconProps) {
  const renderDots = () => {
    const dots: ReactNode[] = []
    
    // Define dot positions for each face
    const dotPositions: Record<number, string[]> = {
      1: ['center'],
      2: ['top-left', 'bottom-right'],
      3: ['top-left', 'center', 'bottom-right'],
      4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
      6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right']
    }

    const positions = dotPositions[value] || []
    
    positions.forEach((position, index) => {
      dots.push(<div key={index} className={`dice-dot ${position}`} />)
    })

    return dots
  }

  return (
    <div 
      className={`dice-icon 
        ${isSelected ? 'dice-selected' : ''} 
        ${isBanked ? 'dice-banked' : ''} 
        ${isSelectable ? 'dice-selectable' : ''}
        ${className}`
      }
      onClick={isSelectable && !isBanked ? onClick : undefined}
    >
      <div className="dice-face">
        {renderDots()}
      </div>
      {isBanked && <span className="banked-indicator">✓</span>}
    </div>
  )
}
