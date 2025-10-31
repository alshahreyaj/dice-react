import type { GameState } from './gameState'
import type { Combo } from './scoring'

/**
 * AI Player Logic
 * The AI makes decisions based on:
 * 1. Current turn score
 * 2. Total score vs player score
 * 3. Risk assessment
 */

export type AIDecision = 
  | { action: 'bank'; diceIndices: number[] }
  | { action: 'pass'; diceIndices: number[] }

export function makeAIDecision(state: GameState): AIDecision | null {
  const { currentScore, turnScore, players, currentPlayerId, remainingDiceIndices } = state
  
  if (!currentScore || currentScore.combos.length === 0) {
    return null // No valid moves
  }

  const aiPlayer = players.find(p => p.id === currentPlayerId)
  const humanPlayer = players.find(p => p.id !== currentPlayerId)
  
  if (!aiPlayer || !humanPlayer) return null

  // Filter combos to only include available dice
  const availableCombos = currentScore.combos.filter(combo => 
    combo.indices.every(index => remainingDiceIndices.includes(index))
  )

  if (availableCombos.length === 0) return null

  // Strategy parameters
  const SAFE_TURN_SCORE = 300 // Minimum score to consider passing
  const GREEDY_TURN_SCORE = 600 // Score at which AI becomes more cautious
  const WINNING_THRESHOLD = 5000
  const CATCH_UP_THRESHOLD = 1000 // If behind by this much, take more risks

  const scoreDifference = humanPlayer.totalScore - aiPlayer.totalScore
  const isWinning = scoreDifference < 0
  const isFarBehind = scoreDifference > CATCH_UP_THRESHOLD
  const canWinThisTurn = aiPlayer.totalScore + turnScore >= WINNING_THRESHOLD

  // Decision logic
  
  // 1. If AI can win this turn, always pass
  if (canWinThisTurn && turnScore >= SAFE_TURN_SCORE) {
    return selectBestCombo(availableCombos, 'pass')
  }

  // 2. If AI has accumulated a good score and is winning, play it safe
  if (isWinning && turnScore >= SAFE_TURN_SCORE) {
    // 70% chance to pass when winning with decent score
    if (Math.random() < 0.7) {
      return selectBestCombo(availableCombos, 'pass')
    }
  }

  // 3. If AI is far behind, take more risks
  if (isFarBehind) {
    // Only pass if score is really high
    if (turnScore >= GREEDY_TURN_SCORE) {
      // 50% chance to pass even when behind
      if (Math.random() < 0.5) {
        return selectBestCombo(availableCombos, 'pass')
      }
    }
    // Otherwise keep banking and rolling
    return selectBestCombo(availableCombos, 'bank')
  }

  // 4. Normal strategy - balance risk and reward
  if (turnScore < SAFE_TURN_SCORE) {
    // Low score, keep rolling
    return selectBestCombo(availableCombos, 'bank')
  } else if (turnScore >= GREEDY_TURN_SCORE) {
    // High score, probably pass
    // 80% chance to pass with high score
    if (Math.random() < 0.8) {
      return selectBestCombo(availableCombos, 'pass')
    }
    return selectBestCombo(availableCombos, 'bank')
  } else {
    // Medium score, 50/50 decision
    if (Math.random() < 0.5) {
      return selectBestCombo(availableCombos, 'pass')
    }
    return selectBestCombo(availableCombos, 'bank')
  }
}

/**
 * Select the best combo to bank or pass with
 * Prefers higher scoring combos
 */
function selectBestCombo(combos: Combo[], action: 'bank' | 'pass'): AIDecision {
  // Sort combos by score (highest first)
  const sortedCombos = [...combos].sort((a, b) => b.score - a.score)
  
  // For banking, prefer smaller combos to keep more dice in play
  // For passing, prefer larger combos to maximize score
  let selectedCombo: Combo
  
  if (action === 'bank') {
    // Find the smallest combo that still scores well
    // Prefer single 1s or 5s if available
    const singles = sortedCombos.filter(c => c.type === 'single')
    if (singles.length > 0) {
      selectedCombo = singles[0]
    } else {
      // Otherwise take the smallest combo by dice count
      selectedCombo = sortedCombos.reduce((min, combo) => 
        combo.indices.length < min.indices.length ? combo : min
      )
    }
  } else {
    // For passing, just take the highest scoring combo
    selectedCombo = sortedCombos[0]
  }

  return {
    action,
    diceIndices: selectedCombo.indices
  }
}

/**
 * Add a delay to make AI moves feel more natural
 */
export function getAIThinkingDelay(): number {
  // Random delay between 1500ms and 3000ms for more realistic gameplay
  return 1500 + Math.random() * 1500
}
