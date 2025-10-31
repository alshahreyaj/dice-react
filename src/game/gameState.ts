import { scoreRoll } from './scoring';
import type { Combo, ScoreResult } from './scoring';

// Constants
const DICE_COUNT = 6;
const WIN_THRESHOLD = 5000; // Configurable win threshold

export type Player = {
  id: number;
  name: string;
  totalScore: number;
};

export type GameState = {
  // Players
  players: Player[];
  currentPlayerId: number;
  
  // Current turn state
  turnScore: number;
  turnDice: number[];
  remainingDiceIndices: number[];
  selectedDiceIndices: number[];
  
  // Track which dice have been banked in this turn
  bankedDiceIndices: number[];
  
  // Current roll state
  currentScore: ScoreResult | null;
  selectedCombos: Combo[];
  
  // Game state
  gameStarted: boolean;
  turnNumber: number;
  gameOver: boolean;
  winnerId: number | null;
  message: string;
  
  // History
  turnHistory: {
    playerId: number;
    action: 'roll' | 'bank' | 'pass' | 'bust';
    dice: number[];
    score: number;
  }[];
};

export type GameAction = 
  | { type: 'START_GAME' }
  | { type: 'ROLL' }
  | { type: 'SELECT_DICE'; indices: number[] }
  | { type: 'BANK_SELECTED' }
  | { type: 'SCORE_AND_PASS' }
  | { type: 'NEW_GAME' };

export const initialState: GameState = {
  players: [
    { id: 1, name: 'You', totalScore: 0 },
    { id: 2, name: 'AI Opponent', totalScore: 0 }
  ],
  currentPlayerId: 1,
  turnScore: 0,
  turnDice: [],
  remainingDiceIndices: [],
  selectedDiceIndices: [],
  bankedDiceIndices: [], // Track which dice have been banked in the current turn
  currentScore: null,
  selectedCombos: [],
  gameStarted: false,
  turnNumber: 1,
  gameOver: false,
  winnerId: null,
  message: 'Press Start Game to begin!',
  turnHistory: [],
};

function rollDie(sides = 6) {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0] % sides) + 1;
}

function rollDice(count = DICE_COUNT): number[] {
  return Array.from({ length: count }, () => rollDie(6));
}

// Helper to get valid combos from selected dice indices
function getValidCombosFromSelection(state: GameState, indices: number[]): Combo[] {
  if (!state.currentScore) return [];

  // Ensure all selected dice are currently selectable (i.e., not banked)
  const allSelectable = indices.every(i => state.remainingDiceIndices.includes(i));
  if (!allSelectable) return [];

  // Score only the selected dice values
  const values = indices.map(i => state.turnDice[i]);
  const result = scoreRoll(values);

  // Valid only if all selected dice contribute to the score
  if (result.total === 0 || result.unusedIndices.length > 0) return [];

  // Map combos' local indices back to original dice indices
  const translated: Combo[] = result.combos.map(c => ({
    ...c,
    indices: c.indices.map(j => indices[j])
  }));

  return translated;
}

// Calculate score from selected combos
function calculateScoreFromCombos(combos: Combo[]): number {
  return combos.reduce((sum, combo) => sum + combo.score, 0);
}

// Check if a player has won
function checkWinCondition(score: number): boolean {
  return score >= WIN_THRESHOLD;
}

// Get the next player ID
function getNextPlayerId(currentId: number): number {
  return currentId === 1 ? 2 : 1;
}

// Helper: determine if a score result is a bust (no scoring combos)
function isBust(score: ScoreResult): boolean {
  return score.total === 0 || score.combos.length === 0;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      // Start the game and roll dice for Player 1
      const rolledDice = rollDice(DICE_COUNT);
      const score = scoreRoll(rolledDice);
      
      // Create an array of indices for all dice
      const allDiceIndices = Array.from({ length: DICE_COUNT }, (_, i) => i);
      
      console.log('START_GAME - Setting all dice indices available:', allDiceIndices);

      // If initial roll is a bust, auto-advance to next player until a non-bust roll occurs
      if (isBust(score)) {
        console.log('START_GAME - Initial roll is a BUST. Auto-advancing to next player.');
        const history: { playerId: number; action: 'roll' | 'bank' | 'pass' | 'bust'; dice: number[]; score: number; }[] = [
          {
            playerId: state.currentPlayerId,
            dice: rolledDice,
            score: 0,
            action: 'bust',
          },
        ];

        let nextPlayerId = getNextPlayerId(state.currentPlayerId);
        let attempts = 0;
        let nextDice = rollDice(DICE_COUNT);
        let nextScore = scoreRoll(nextDice);
        
        // Skip busts for subsequent players as well (safety cap to avoid infinite loop)
        while (isBust(nextScore) && attempts < 10) {
          history.push({ playerId: nextPlayerId, dice: nextDice, score: 0, action: 'bust' });
          nextPlayerId = getNextPlayerId(nextPlayerId);
          nextDice = rollDice(DICE_COUNT);
          nextScore = scoreRoll(nextDice);
          attempts++;
        }
        
        history.push({ playerId: nextPlayerId, dice: nextDice, score: nextScore.total, action: 'roll' });

        const currentPlayerName = state.players.find(p => p.id === state.currentPlayerId)?.name;
        const nextPlayerName = state.players.find(p => p.id === nextPlayerId)?.name;

        return {
          ...state,
          gameStarted: true,
          currentPlayerId: nextPlayerId,
          turnDice: nextDice,
          currentScore: nextScore,
          remainingDiceIndices: allDiceIndices,
          bankedDiceIndices: [],
          message: `BUST! No scoring combinations. ${currentPlayerName} loses their turn. ${nextPlayerName}'s turn now.`,
          turnHistory: [...state.turnHistory, ...history],
        };
      }

      // Normal non-bust start
      return {
        ...state,
        gameStarted: true,
        turnDice: rolledDice,
        currentScore: score,
        remainingDiceIndices: allDiceIndices, // All dice available initially
        bankedDiceIndices: [], // No dice banked initially
        message: `Game started! ${state.players[0].name}'s turn. Select dice to score.`,
        turnHistory: [
          { 
            playerId: state.currentPlayerId,
            dice: rolledDice, 
            score: score.total, 
            action: 'roll' 
          }
        ]
      };
    }
    
    case 'ROLL': {
      // If this is the first roll or all dice have been banked, roll all dice
      
      const newDice = [...state.turnDice];
      
      // Roll only the remaining dice
      if (state.remainingDiceIndices.length === 0) {
        // First roll of the turn
        const rolledDice = rollDice(DICE_COUNT);
        for (let i = 0; i < DICE_COUNT; i++) {
          newDice[i] = rolledDice[i];
        }
      } else {
        // Rolling remaining dice
        const rolledDice = rollDice(state.remainingDiceIndices.length);
        state.remainingDiceIndices.forEach((dieIndex, i) => {
          newDice[dieIndex] = rolledDice[i];
        });
      }
      
      const score = scoreRoll(newDice);
      
      // Debug: Log the dice values and score for ROLL action
      console.log('ROLL action - Dice:', newDice);
      console.log('ROLL action - Score result:', score);
      console.log('ROLL action - Total score:', score.total);
      console.log('ROLL action - Has combos:', score.combos.length > 0);
      
      // Check if the roll busted (no scoring combinations)
      console.log('ROLL - Checking for bust - Score total:', score.total, 'Combos length:', score.combos.length);
      if (isBust(score)) {
        console.log('ROLL action - BUST DETECTED! Switching to next player...');
        let nextPlayerId = getNextPlayerId(state.currentPlayerId);

        const history: { playerId: number; action: 'roll' | 'bank' | 'pass' | 'bust'; dice: number[]; score: number; }[] = [
          { playerId: state.currentPlayerId, dice: newDice, score: 0, action: 'bust' },
        ];

        // Auto-roll for next player, and skip busts until a non-bust roll
        let attempts = 0;
        let nextPlayerDice = rollDice(DICE_COUNT);
        let nextPlayerScore = scoreRoll(nextPlayerDice);
        while (isBust(nextPlayerScore) && attempts < 10) {
          history.push({ playerId: nextPlayerId, dice: nextPlayerDice, score: 0, action: 'bust' });
          nextPlayerId = getNextPlayerId(nextPlayerId);
          nextPlayerDice = rollDice(DICE_COUNT);
          nextPlayerScore = scoreRoll(nextPlayerDice);
          attempts++;
        }

        history.push({ playerId: nextPlayerId, dice: nextPlayerDice, score: nextPlayerScore.total, action: 'roll' });
        
        // Get player names for the message
        const currentPlayerName = state.players.find(p => p.id === state.currentPlayerId)?.name;
        const nextPlayerName = state.players.find(p => p.id === nextPlayerId)?.name;
        
        return {
          ...state,
          turnDice: nextPlayerDice,
          currentScore: nextPlayerScore,
          turnScore: 0,
          currentPlayerId: nextPlayerId,
          selectedDiceIndices: [],
          selectedCombos: [],
          remainingDiceIndices: Array.from({ length: DICE_COUNT }, (_, i) => i),
          bankedDiceIndices: [], // Reset banked dice for the next player
          message: `BUST! No scoring combinations. ${currentPlayerName} loses their turn. ${nextPlayerName}'s turn now.`,
          turnHistory: [
            ...state.turnHistory,
            ...history,
          ]
        };
      }
      
      // Successful roll with scoring combinations
      return {
        ...state,
        turnDice: newDice,
        currentScore: score,
        selectedDiceIndices: [],
        selectedCombos: [],
        remainingDiceIndices: Array.from({ length: DICE_COUNT }, (_, i) => i),
        bankedDiceIndices: [], // Reset banked dice on a new roll
        message: `Roll scored! Select dice to bank.`,
        turnHistory: [
          ...state.turnHistory,
          { 
            playerId: state.currentPlayerId,
            dice: newDice, 
            score: score.total, 
            action: 'roll' 
          }
        ]
      };
    }
    
    case 'SELECT_DICE': {
      const indices = action.indices;
      
      // Validate that these dice form valid scoring combinations
      const validCombos = getValidCombosFromSelection(state, indices);
      const selectionScore = calculateScoreFromCombos(validCombos);
      
      if (validCombos.length === 0) {
        return {
          ...state,
          message: 'Invalid selection. These dice don\'t form a scoring combination.'
        };
      }
      
      return {
        ...state,
        selectedDiceIndices: indices,
        selectedCombos: validCombos,
        message: `Selected dice worth ${selectionScore} points. Bank or Score & Pass?`
      };
    }
    
    case 'BANK_SELECTED': {
      if (state.selectedDiceIndices.length === 0) {
        return {
          ...state,
          message: 'Select dice to bank first!'
        };
      }
      
      const selectionScore = calculateScoreFromCombos(state.selectedCombos);
      const newTurnScore = state.turnScore + selectionScore;
      
      // Create a copy of the current dice array
      const newDice = [...state.turnDice];
      
      // Update the list of banked dice by adding the newly selected dice
      const newBankedDiceIndices = [...state.bankedDiceIndices, ...state.selectedDiceIndices];
      
      // Calculate which dice indices remain after banking the selected ones
      // We need to filter the current remainingDiceIndices to remove the selected ones
      const newRemainingDiceIndices = state.remainingDiceIndices.filter(
        index => !state.selectedDiceIndices.includes(index)
      );
      
      console.log('Original remainingDiceIndices:', state.remainingDiceIndices);
      console.log('Selected dice indices:', state.selectedDiceIndices);
      console.log('Previously banked dice indices:', state.bankedDiceIndices);
      console.log('New banked dice indices:', newBankedDiceIndices);
      console.log('New remaining dice indices:', newRemainingDiceIndices);
      
      // If all dice are used, player gets to roll all dice again
      const allDiceUsed = newRemainingDiceIndices.length === 0;
      
      if (allDiceUsed) {
        // Roll all dice
        const rolledDice = rollDice(DICE_COUNT);
        for (let i = 0; i < DICE_COUNT; i++) {
          newDice[i] = rolledDice[i];
        }
      } else {
        // Roll only the remaining dice
        const remainingCount = newRemainingDiceIndices.length;
        const rolledDice = rollDice(remainingCount);
        
        // Update only the remaining dice positions
        for (let i = 0; i < remainingCount; i++) {
          const dieIndex = newRemainingDiceIndices[i];
          newDice[dieIndex] = rolledDice[i];
        }
      }
      
      // Score the new roll
      const newScore = scoreRoll(newDice);
      
      // Debug: Log the dice values and score
      console.log('After banking - New dice:', newDice);
      console.log('After banking - Score result:', newScore);
      console.log('After banking - Total score:', newScore.total);
      console.log('After banking - Has combos:', newScore.combos.length > 0);
      
      // IMPORTANT: We need to check if there are any scoring combinations in the NEWLY ROLLED DICE
      // Extract just the newly rolled dice values
      const newlyRolledDice = allDiceUsed ? 
        newDice : // If all dice were used, all dice are newly rolled
        newRemainingDiceIndices.map(index => newDice[index]); // Otherwise, just the remaining dice
      
      // Score just the newly rolled dice
      const newlyRolledScore = scoreRoll(newlyRolledDice);
      console.log('Newly rolled dice:', newlyRolledDice);
      console.log('Newly rolled score:', newlyRolledScore);
      
      // Check if the newly rolled dice busted (no scoring combinations)
      const busted = newlyRolledScore.total === 0 || newlyRolledScore.combos.length === 0;
      console.log('Busted?', busted);
      
      if (busted) {
        console.log('BUST DETECTED! Switching to next player...');
        // On bust, player loses all accumulated points for the turn and turn passes to next player
        let nextPlayerId = getNextPlayerId(state.currentPlayerId);

        // Prepare history entries: include bank and current player's bust below in return
        const nextHistory: { playerId: number; action: 'roll' | 'bank' | 'pass' | 'bust'; dice: number[]; score: number; }[] = [];

        // Auto-roll for next player, and skip busts until a non-bust roll
        let attempts = 0;
        let nextPlayerDice = rollDice(DICE_COUNT);
        let nextPlayerScore = scoreRoll(nextPlayerDice);
        while ((nextPlayerScore.total === 0 || nextPlayerScore.combos.length === 0) && attempts < 10) {
          nextHistory.push({ playerId: nextPlayerId, dice: nextPlayerDice, score: 0, action: 'bust' });
          nextPlayerId = getNextPlayerId(nextPlayerId);
          nextPlayerDice = rollDice(DICE_COUNT);
          nextPlayerScore = scoreRoll(nextPlayerDice);
          attempts++;
        }

        nextHistory.push({ playerId: nextPlayerId, dice: nextPlayerDice, score: nextPlayerScore.total, action: 'roll' });
        
        // Get player names for the message
        const currentPlayerName = state.players.find(p => p.id === state.currentPlayerId)?.name;
        const nextPlayerName = state.players.find(p => p.id === nextPlayerId)?.name;
        
        // Important: Player loses all accumulated points for the turn (including previously banked points)
        // We reset to a new turn with all dice available for the next player
        return {
          ...state,
          turnDice: nextPlayerDice,
          currentScore: nextPlayerScore,
          turnScore: 0, // Reset turn score to 0 (lose all accumulated points)
          currentPlayerId: nextPlayerId, // Change turn to next player
          selectedDiceIndices: [],
          selectedCombos: [],
          remainingDiceIndices: Array.from({ length: DICE_COUNT }, (_, i) => i), // All dice available
          bankedDiceIndices: [], // Reset banked dice for the next player
          message: `BUST! No scoring combinations. ${currentPlayerName} loses their turn. ${nextPlayerName}'s turn now.`,
          turnHistory: [
            ...state.turnHistory,
            // Record the banking action
            { 
              playerId: state.currentPlayerId,
              dice: state.turnDice, 
              score: selectionScore, 
              action: 'bank' 
            },
            // Record the bust
            { 
              playerId: state.currentPlayerId,
              dice: newDice, 
              score: 0, 
              action: 'bust' 
            },
            // Record next players' busts (if any) and final non-bust roll
            ...nextHistory
          ]
        };
      }
      
      // Successful roll with new dice
      // IMPORTANT: After banking and rolling, we need to determine which dice are available for selection
      // 1. If all dice were used (banked), then all indices are available in the new roll
      // 2. If only some dice were used, then only the non-banked dice are available
      
      // Create a fresh array of all dice indices
      const allDiceIndices = Array.from({ length: DICE_COUNT }, (_, i) => i);
      
      // If all dice were used, all dice are available in the new roll (reset banked dice)
      // Otherwise, only the newly rolled dice (which are the ones in newRemainingDiceIndices) are available
      const availableDiceIndices = allDiceUsed ?
        allDiceIndices : // All dice are available if all were previously used
        newRemainingDiceIndices; // Only the newly rolled dice are available otherwise
      
      console.log('After banking - All dice indices:', allDiceIndices);
      console.log('After banking - Banked dice indices:', newBankedDiceIndices);
      console.log('After banking - Available dice indices for selection:', availableDiceIndices);
      
      return {
        ...state,
        turnDice: newDice,
        currentScore: newScore,
        turnScore: newTurnScore,
        selectedDiceIndices: [],
        selectedCombos: [],
        remainingDiceIndices: availableDiceIndices,
        // If all dice were used, reset bankedDiceIndices since we're starting fresh
        // Otherwise, keep track of all banked dice for this turn
        bankedDiceIndices: allDiceUsed ? [] : newBankedDiceIndices,
        message: allDiceUsed ? 
          `All dice banked! +${selectionScore} points. New roll scored.` : 
          `Banked selected dice for ${selectionScore} points. ${newRemainingDiceIndices.length} remaining dice rolled.`,
        turnHistory: [
          ...state.turnHistory,
          // Record the banking action
          { 
            playerId: state.currentPlayerId,
            dice: state.turnDice, 
            score: selectionScore, 
            action: 'bank' 
          },
          // Record the new roll
          {
            playerId: state.currentPlayerId,
            dice: newDice,
            score: newScore.total,
            action: 'roll'
          }
        ]
      };
    }
    
    case 'SCORE_AND_PASS': {
      if (state.selectedDiceIndices.length === 0) {
        return {
          ...state,
          message: 'Select dice to score first!'
        };
      }
      
      const selectionScore = calculateScoreFromCombos(state.selectedCombos);
      const totalTurnScore = state.turnScore + selectionScore;
      
      // Update current player's score
      const updatedPlayers = state.players.map(player => {
        if (player.id === state.currentPlayerId) {
          const newTotalScore = player.totalScore + totalTurnScore;
          return { ...player, totalScore: newTotalScore };
        }
        return player;
      });
      
      // Check if the current player won
      const currentPlayer = updatedPlayers.find(p => p.id === state.currentPlayerId)!;
      const hasWon = checkWinCondition(currentPlayer.totalScore);
      
      if (hasWon) {
        return {
          ...state,
          players: updatedPlayers,
          gameOver: true,
          winnerId: state.currentPlayerId,
          message: `${currentPlayer.name} wins with ${currentPlayer.totalScore} points!`,
          turnHistory: [
            ...state.turnHistory,
            { 
              playerId: state.currentPlayerId,
              dice: state.turnDice, 
              score: totalTurnScore, 
              action: 'pass' 
            }
          ]
        };
      }
      
      // Switch to next player and automatically roll for them
      const nextPlayerIdInitial = getNextPlayerId(state.currentPlayerId);
      let nextPlayerId = nextPlayerIdInitial;
      let nextPlayerDice = rollDice(DICE_COUNT);
      let nextPlayerScore = scoreRoll(nextPlayerDice);

      const passHistory: { playerId: number; action: 'roll' | 'bank' | 'pass' | 'bust'; dice: number[]; score: number; }[] = [
        { 
          playerId: state.currentPlayerId,
          dice: state.turnDice, 
          score: totalTurnScore, 
          action: 'pass' 
        }
      ];

      // If the next player's first roll is a bust, advance until non-bust
      let attempts = 0;
      while (isBust(nextPlayerScore) && attempts < 10) {
        passHistory.push({ playerId: nextPlayerId, dice: nextPlayerDice, score: 0, action: 'bust' });
        nextPlayerId = getNextPlayerId(nextPlayerId);
        nextPlayerDice = rollDice(DICE_COUNT);
        nextPlayerScore = scoreRoll(nextPlayerDice);
        attempts++;
      }

      passHistory.push({ playerId: nextPlayerId, dice: nextPlayerDice, score: nextPlayerScore.total, action: 'roll' });
      
      // Compose message, showing bust info if it occurred
      const nextPlayerNameFinal = state.players.find(p => p.id === nextPlayerId)?.name;
      const nextPlayerNameInitial = state.players.find(p => p.id === nextPlayerIdInitial)?.name;
      const composedMessage = attempts > 0
        ? `${currentPlayer.name} scored ${totalTurnScore} points (total: ${currentPlayer.totalScore}). BUST! No scoring combinations. ${nextPlayerNameInitial} loses their turn. ${nextPlayerNameFinal}'s turn now.`
        : `${currentPlayer.name} scored ${totalTurnScore} points (total: ${currentPlayer.totalScore}). ${nextPlayerNameFinal}'s turn.`

      // When passing to next player, reset with all dice available
      return {
        ...state,
        players: updatedPlayers,
        currentPlayerId: nextPlayerId,
        turnScore: 0,
        turnDice: nextPlayerDice,
        currentScore: nextPlayerScore,
        selectedDiceIndices: [],
        selectedCombos: [],
        remainingDiceIndices: Array.from({ length: DICE_COUNT }, (_, i) => i), // All dice available
        bankedDiceIndices: [], // Reset banked dice for the next player
        message: composedMessage,
        turnHistory: [
          ...state.turnHistory,
          ...passHistory
        ]
      };
    }
    
    case 'NEW_GAME': {
      return {
        ...initialState,
        players: [
          { id: 1, name: 'Player 1', totalScore: 0 },
          { id: 2, name: 'Player 2', totalScore: 0 }
        ],
        bankedDiceIndices: [], // Ensure bankedDiceIndices is reset
      };
    }
    
    default:
      return state;
  }
}
