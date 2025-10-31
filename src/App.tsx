import { useReducer, useState, useEffect } from 'react'
import './App.css'
import { gameReducer, initialState } from './game/gameState'
import type { Combo } from './game/scoring'
import { scoreRoll } from './game/scoring'

function App() {
  const [gameState, dispatch] = useReducer(gameReducer, initialState)
  
  // Local state for tracking dice selection
  const [selectedDice, setSelectedDice] = useState<number[]>([])
  
  const { 
    players,
    currentPlayerId,
    turnDice, 
    currentScore, 
    turnScore,
    remainingDiceIndices,
    bankedDiceIndices,
    selectedCombos,
    gameStarted,
    gameOver,
    winnerId,
    message,
    turnHistory
  } = gameState
  
  // Debug: Log when player changes
  useEffect(() => {
    console.log('Current player changed to:', currentPlayerId);
    console.log('Current game state:', gameState);
  }, [currentPlayerId, gameState])
  
  // State to track potential score from current selection
  const [potentialScore, setPotentialScore] = useState<number>(0)
  const [validCombos, setValidCombos] = useState<Combo[]>([])
  const [isSelectionValid, setIsSelectionValid] = useState<boolean>(false)
  const [showRules, setShowRules] = useState<boolean>(false)
  const [showLeftPanel, setShowLeftPanel] = useState<boolean>(true)
  const [showRightPanel, setShowRightPanel] = useState<boolean>(true)
  
  // Layout: requested percentages
  // 1) both show: 20 / 60 / 20
  // 2) left hide: 0 / 70 / 30
  // 3) right hide: 30 / 70 / 0
  // 4) both hide: 0 / 100 / 0
  let leftCol = '20%';
  let centerCol = '60%';
  let rightCol = '20%';
  if (!showLeftPanel && showRightPanel) {
    leftCol = '0'; centerCol = '70%'; rightCol = '30%';
  } else if (showLeftPanel && !showRightPanel) {
    leftCol = '30%'; centerCol = '70%'; rightCol = '0';
  } else if (!showLeftPanel && !showRightPanel) {
    leftCol = '0'; centerCol = '100%'; rightCol = '0';
  }
  const gridGap = '0'; // No gap for flush layout
  
  // Calculate potential score from selected dice
  const calculatePotentialScore = (indices: number[]) => {
    if (!currentScore || indices.length === 0) {
      setPotentialScore(0)
      setValidCombos([])
      setIsSelectionValid(false)
      return
    }

    // Ensure selected dice are currently available (not banked)
    const allSelectable = indices.every(i => remainingDiceIndices.includes(i))
    if (!allSelectable) {
      setPotentialScore(0)
      setValidCombos([])
      setIsSelectionValid(false)
      return
    }

    // Score only the selected dice
    const selectedValues = indices.map(i => turnDice[i])
    const result = scoreRoll(selectedValues)

    // Translate combo indices back to original dice indices
    const translated: Combo[] = result.combos.map(c => ({
      ...c,
      indices: c.indices.map(j => indices[j])
    }))

    // Valid only if all selected dice contribute to score
    if (result.total > 0 && result.unusedIndices.length === 0) {
      setPotentialScore(result.total)
      setValidCombos(translated)
      setIsSelectionValid(true)
      return
    }

    // Fallback for single-die selection: suggest the best available combo containing this die
    if (indices.length === 1) {
      const selectedIndex = indices[0]
      const dieValue = turnDice[selectedIndex]

      // Singles 1 and 5 are valid on their own
      if (dieValue === 1 || dieValue === 5) {
        const singleScore = dieValue === 1 ? 100 : 50
        const combo: Combo = {
          type: 'single',
          label: dieValue === 1 ? 'Single 1' : 'Single 5',
          score: singleScore,
          indices: [selectedIndex]
        }
        setPotentialScore(combo.score)
        setValidCombos([combo])
        setIsSelectionValid(true)
        return
      }

      // No fallback for multi-die combos: selecting a single non-scoring die should not enable banking
    }

    // Otherwise invalid
    setPotentialScore(0)
    setValidCombos([])
    setIsSelectionValid(false)
  }
  
  // Handle dice click for selection
  const handleDiceClick = (index: number) => {
    console.log(`Clicked die ${index} (value: ${turnDice[index]})`);
    console.log('Current banked dice indices:', bankedDiceIndices);
    console.log('Is die banked:', bankedDiceIndices.includes(index));
    
    // Only allow selection if we have a current score, the game isn't over,
    // and the die is in remainingDiceIndices (which means it's not banked)
    if (!currentScore) {
      console.log('Cannot select: No current score');
      return;
    }
    
    if (gameOver) {
      console.log('Cannot select: Game is over');
      return;
    }
    
    // Check if the die is in the remaining dice indices
    // This is the key check - only dice in remainingDiceIndices are available
    if (!remainingDiceIndices.includes(index)) {
      console.log('Cannot select: Die is not in remaining dice indices (it may be banked)');
      return;
    }
    
    // Allow selection of any non-banked die, regardless of whether it's part of a valid combo
    
    // Toggle selection
    let newSelection: number[]
    if (selectedDice.includes(index)) {
      console.log('Removing die from selection');
      newSelection = selectedDice.filter(i => i !== index)
    } else {
      console.log('Adding die to selection');
      newSelection = [...selectedDice, index]
    }
    
    console.log('New selection:', newSelection);
    setSelectedDice(newSelection)
    calculatePotentialScore(newSelection)
  }
  
  // Helper function to filter combos to only include available dice
  const getAvailableCombos = (allCombos: Combo[]): Combo[] => {
    if (!allCombos) return [];
    
    // Filter combos to only include those where all dice are available (in remainingDiceIndices)
    const availableCombos = allCombos.filter(combo => 
      combo.indices.every(index => remainingDiceIndices.includes(index))
    );
    
    console.log('All combos:', allCombos);
    console.log('Available combos (only using non-banked dice):', availableCombos);
    
    return availableCombos;
  }
  
  // Effect to reset selection state when dice change or remaining dice indices change
  useEffect(() => {
    // When dice change or available dice change (after banking, rolling, or passing), reset selection
    console.log('Dice or available dice changed, resetting selection state');
    console.log('Current dice:', turnDice);
    console.log('Current remaining dice indices:', remainingDiceIndices);
    console.log('Current banked dice indices:', bankedDiceIndices);
    
    // Reset selection state
    setSelectedDice([]);
    setPotentialScore(0);
    setValidCombos([]);
    setIsSelectionValid(false);
    
    // If we have current score, log available combos for debugging
    if (currentScore) {
      const availableCombos = getAvailableCombos(currentScore.combos);
      console.log('Available combos after dice change (filtered):', availableCombos);
    }
  }, [turnDice, remainingDiceIndices, bankedDiceIndices, currentScore]); // This will run whenever dice values or available dice change
  
  // Effect to log the state of each die when the dice state changes
  useEffect(() => {
    if (!turnDice.length) return;
    
    console.log('\n--- DICE STATE SUMMARY ---');
    turnDice.forEach((value, index) => {
      const isInRemaining = remainingDiceIndices.includes(index);
      const isBanked = !isInRemaining; // If not in remaining indices, it's banked
      const isPartOfCombo = currentScore ? currentScore.combos.some(combo => combo.indices.includes(index)) : false;
      const isSelectable = isInRemaining && isPartOfCombo;
      
      console.log(`Die ${index} (value: ${value}) - In remaining: ${isInRemaining}, Banked: ${isBanked}, Part of combo: ${isPartOfCombo}, Selectable: ${isSelectable}`);
    });
    console.log('------------------------\n');
  }, [turnDice, remainingDiceIndices, currentScore]);

  // Dispatch actions
  const onStartGame = () => {
    dispatch({ type: 'START_GAME' })
    // Selection state will be reset by the useEffect above
  }

  const onBankSelected = () => {
    if (selectedDice.length === 0) {
      console.log('Cannot bank: No dice selected');
      return;
    }
    
    // Check if the current selection forms a valid scoring combination
    if (!isSelectionValid) {
      console.log('Cannot bank: Selected dice do not form a valid scoring combination');
      return;
    }
    
    console.log('Banking selected dice:', selectedDice);
    console.log('Valid combos for banking:', validCombos);
    
    // If we're selecting a single die that's part of a larger combo,
    // we need to select all dice in that combo
    if (selectedDice.length === 1 && validCombos.length === 1) {
      const combo = validCombos[0];
      // Check if this combo includes more dice than just the selected one
      if (combo.indices.length > 1) {
        console.log('Selected a single die that is part of a larger combo:', combo);
        console.log('Selecting all dice in the combo:', combo.indices);
        
        // Select all dice in the combo instead of just the one die
        dispatch({ type: 'SELECT_DICE', indices: combo.indices });
      } else {
        // Just select the single die
        dispatch({ type: 'SELECT_DICE', indices: selectedDice });
      }
    } else {
      // Normal case - select the dice as chosen by the player
      dispatch({ type: 'SELECT_DICE', indices: selectedDice });
    }
    
    // The BANK_SELECTED action will handle the following cases:
    // 1. If all dice are used, it will roll all dice
    // 2. If only some dice are used, it will roll the remaining dice
    // 3. If the new roll busts, it will automatically switch to the next player
    dispatch({ type: 'BANK_SELECTED' });
    
    // Selection state will be reset by the useEffect above
  }
  
  const onScoreAndPass = () => {
    if (selectedDice.length === 0) {
      console.log('Cannot score and pass: No dice selected');
      return;
    }
    
    // Check if the current selection forms a valid scoring combination
    if (!isSelectionValid) {
      console.log('Cannot score and pass: Selected dice do not form a valid scoring combination');
      return;
    }
    
    console.log('Scoring and passing with dice:', selectedDice);
    console.log('Valid combos for scoring:', validCombos);
    
    // If we're selecting a single die that's part of a larger combo,
    // we need to select all dice in that combo
    if (selectedDice.length === 1 && validCombos.length === 1) {
      const combo = validCombos[0];
      // Check if this combo includes more dice than just the selected one
      if (combo.indices.length > 1) {
        console.log('Selected a single die that is part of a larger combo:', combo);
        console.log('Selecting all dice in the combo:', combo.indices);
        
        // Select all dice in the combo instead of just the one die
        dispatch({ type: 'SELECT_DICE', indices: combo.indices });
      } else {
        // Just select the single die
        dispatch({ type: 'SELECT_DICE', indices: selectedDice });
      }
    } else {
      // Normal case - select the dice as chosen by the player
      dispatch({ type: 'SELECT_DICE', indices: selectedDice });
    }
    
    dispatch({ type: 'SCORE_AND_PASS' });
    
    // Selection state will be reset by the useEffect above
  }

  const onNewGame = () => {
    dispatch({ type: 'NEW_GAME' })
    setSelectedDice([]) // Clear selection for new game
  }

  // Determine if a die is selectable (must only be in remainingDiceIndices, i.e., not banked)
  const isDieSelectable = (index: number): boolean => {
    if (!currentScore) return false
    
    // Die must be in the remaining dice indices (not banked)
    // This is the only check - any non-banked die can be selected
    const isInRemaining = remainingDiceIndices.includes(index)
    
    console.log(`Die ${index} (value: ${turnDice[index]}) - In remaining: ${isInRemaining}`)
    
    // Die must be in remaining dice (not banked)
    return isInRemaining
  }

  // Determine if a die is part of the current selection
  const isDieSelected = (index: number): boolean => {
    return selectedDice.includes(index)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <h1>Dice Game</h1>
        </div>
      </header>
      
      {/* Main content layout */}
      <div className="content-grid" style={{ ['--left' as any]: leftCol, ['--center' as any]: centerCol, ['--right' as any]: rightCol, gap: gridGap }}>
        <div className={`left-col ${showLeftPanel ? '' : 'collapsed'}`}>
          <button 
            className="toggle-left-btn" 
            onClick={() => setShowLeftPanel(prev => !prev)}
            aria-label={showLeftPanel ? 'Collapse left panel' : 'Expand left panel'}
            aria-expanded={showLeftPanel}
            title={showLeftPanel ? 'Collapse left panel' : 'Expand left panel'}
          >
            {showLeftPanel ? '◀' : '▶'}
          </button>
          <div className="sidebar-panel">
            <h3>Controls</h3>
            <div className="sidebar-buttons">
              <button 
                onClick={onNewGame} 
                className="new-game-btn"
                disabled={!gameStarted && !gameOver}
              >
                New Game
              </button>
              <button 
                onClick={() => setShowRules(true)} 
                className="help-btn"
              >
                Help
              </button>
            </div>
          </div>
        </div>
        <div className="center-col">
          {/* Edge tabs to expand panels when hidden */}
          {!showLeftPanel && (
            <button 
              className="edge-tab edge-tab-left"
              onClick={() => setShowLeftPanel(true)}
              aria-label="Expand left panel"
              title="Expand left panel"
            >
              Controls
            </button>
          )}
          {!showRightPanel && (
            <button 
              className="edge-tab edge-tab-right"
              onClick={() => setShowRightPanel(true)}
              aria-label="Expand right panel"
              title="Expand right panel"
            >
              History
            </button>
          )}
          {/* Player scores */}
          <div className="players-container">
          {players.map(player => (
            <div 
              key={player.id} 
              className={`player-box ${player.id === currentPlayerId ? 'player-active' : ''}`}
            >
              <div className="player-name">{player.name}</div>
              <div className="player-score">{player.totalScore}</div>
              {player.id === currentPlayerId && (
                <div className="turn-score">Turn: {turnScore}</div>
              )}
            </div>
          ))}
          </div>

          {/* Game status message */}
          <div className="message">{message}</div>
          {/* Game not started overlay */}
          {!gameStarted && !gameOver && (
            <div className="game-start">
              <h2>Dice Game</h2>
              <p>First player to reach 5000 points wins!</p>
              <button onClick={onStartGame} className="start-game-btn">Start Game</button>
            </div>
          )}
      
      {/* Game over overlay */}
      {gameOver && (
        <div className="game-over">
          <h2>{players.find(p => p.id === winnerId)?.name} Wins!</h2>
          <button onClick={onNewGame} className="new-game-btn">New Game</button>
        </div>
      )}
      
          {/* Main game area */}
          <div className="card">
        {/* Dice display */}
        <div className="dice-row">
          {turnDice.map((value, index) => {
            // Determine the classes for this die
            const isSelected = isDieSelected(index);
            const isInRemaining = remainingDiceIndices.includes(index);
            const isBanked = !isInRemaining; // If it's not in remaining indices, it's banked
            const isSelectable = isDieSelectable(index);
            
            // Get available combos for debugging
            const availableCombos = currentScore ? getAvailableCombos(currentScore.combos) : [];
            const isPartOfAvailableCombo = availableCombos.some(combo => combo.indices.includes(index));
            
            // Log the status of each die for debugging
            console.log(`Die ${index} (value: ${value}) - Selected: ${isSelected}, In Remaining: ${isInRemaining}, Banked: ${isBanked}, Part of available combo: ${isPartOfAvailableCombo}, Selectable: ${isSelectable}`);
            
            return (
              <div 
                key={index} 
                className={`die 
                  ${isSelected ? 'die-selected' : ''} 
                  ${isBanked ? 'die-banked' : ''} 
                  ${!isBanked ? 'die-selectable' : ''}`
                }
                onClick={() => !isBanked ? handleDiceClick(index) : null}
              >
                {value}
                {isBanked && <span className="banked-indicator">✓</span>}
                {isInRemaining && <span className="die-index">{index}</span>}
              </div>
            );
          })}
        </div>
        
        {/* Action buttons */}
        <div className="button-row">
          {/* Bank button - bank selected dice and continue turn */}
          <button 
            onClick={onBankSelected} 
            className="bank-btn"
            disabled={!isSelectionValid || gameOver || !gameStarted}
          >
            Bank & Continue {potentialScore > 0 ? `(+${potentialScore})` : ''}
          </button>
          
          {/* Score & Pass button - bank points and end turn */}
          <button 
            onClick={onScoreAndPass} 
            className="pass-btn"
            disabled={!isSelectionValid || gameOver || !gameStarted}
          >
            Score & Pass {potentialScore > 0 ? `(+${potentialScore})` : ''}
          </button>
          </div>
          </div>

          {/* Score breakdown - Show either potential score from selection or confirmed selection */}
          {potentialScore > 0 && validCombos.length > 0 ? (
            <div className="score-panel potential-score">
              <h2>Potential Score: +{potentialScore} points</h2>
              <ul>
                {validCombos.map((c, idx) => (
                  <li key={idx}>
                    {c.label} (+{c.score}) {" "}
                    <span className="indices">[dice {c.indices.map(i => i + 1).join(', ')}]</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : selectedCombos.length > 0 && (
            <div className="score-panel">
              <h2>Selected Combos: +{selectedCombos.reduce((sum, c) => sum + c.score, 0)} points</h2>
              <ul>
                {selectedCombos.map((c, idx) => (
                  <li key={idx}>
                    {c.label} (+{c.score}) {" "}
                    <span className="indices">[dice {c.indices.map(i => i + 1).join(', ')}]</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className={`right-col ${showRightPanel ? '' : 'collapsed'}`}>
          <button 
            className="toggle-right-btn" 
            onClick={() => setShowRightPanel(prev => !prev)}
            aria-label={showRightPanel ? 'Collapse right panel' : 'Expand right panel'}
            aria-expanded={showRightPanel}
            title={showRightPanel ? 'Collapse right panel' : 'Expand right panel'}
          >
            {showRightPanel ? '▶' : '◀'}
          </button>
          {/* Turn history */}
          {turnHistory.length > 0 && (
            <div className="history-panel">
              <h3>Turn History</h3>
              <div className="history-list">
                {turnHistory.slice(-5).map((entry, idx) => (
                  <div key={idx} className={`history-item history-${entry.action}`}>
                    <div className="history-player">
                      {players.find(p => p.id === entry.playerId)?.name}
                    </div>
                    <div className="history-dice">
                      {entry.dice.map((d, i) => (
                        <span key={i} className="history-die">{d}</span>
                      ))}
                    </div>
                    <div className="history-action">
                      {entry.action === 'roll' && `Roll`}
                      {entry.action === 'bank' && `Bank +${entry.score}`}
                      {entry.action === 'pass' && `Pass +${entry.score}`}
                      {entry.action === 'bust' && 'Bust!'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <footer className="app-footer">
        <div className="footer-inner">© 2025 Dice Game</div>
      </footer>

      {showRules && (
        <div className="rules-modal" onClick={() => setShowRules(false)}>
          <div className="rules-content" onClick={(e) => e.stopPropagation()}>
            <h2>How to Play</h2>
            <ul>
              <li>First to reach 5000 points wins.</li>
              <li>Singles: 1 = 100, 5 = 50.</li>
              <li>Runs: 1-5 = 500, 2-6 = 750, 1-6 = 1500.</li>
              <li>Sets: three or more of a kind. Three 1s = 1000; three X (2-6) = X×100; each extra die doubles the set value.</li>
              <li>Dice cannot be reused across combos in a single score.</li>
              <li>Bust: If a roll has no scoring combos, you lose your turn and score 0 for the turn.</li>
              <li>Bank to keep rolling this turn. Score & Pass to add your turn score to your total and end your turn.</li>
            </ul>
            <button className="close-btn" onClick={() => setShowRules(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
