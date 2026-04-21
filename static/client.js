/**
 * Cachitos Game Client
 */

// Connect to server
const socket = io();

// State
let gameState = null;
let myPlayerId = null;
let selectedBetValue = 6;
let selectedEmoji = '😀';
let probabilityData = null;
let currentProbTab = 'unknown';
let selectedPaintDice = [];

// DOM Elements
const screens = {
  join: document.getElementById('joinScreen'),
  lobby: document.getElementById('lobbyScreen'),
  game: document.getElementById('gameScreen'),
  gameOver: document.getElementById('gameOverScreen')
};

const elements = {
  // Join screen
  playerName: document.getElementById('playerName'),
  joinBtn: document.getElementById('joinBtn'),
  joinError: document.getElementById('joinError'),
  emojiGrid: document.getElementById('emojiGrid'),
  
  // Lobby screen
  playerCount: document.getElementById('playerCount'),
  lobbyPlayerList: document.getElementById('lobbyPlayerList'),
  hostControls: document.getElementById('hostControls'),
  startGameBtn: document.getElementById('startGameBtn'),
  addBotBtn: document.getElementById('addBotBtn'),
  waitingMessage: document.getElementById('waitingMessage'),
  
  // Game screen
  roundNumber: document.getElementById('roundNumber'),
  totalDice: document.getElementById('totalDice'),
  playersDisplay: document.getElementById('playersDisplay'),
  currentBetValue: document.getElementById('currentBetValue'),
  currentBettor: document.getElementById('currentBettor'),
  betProbability: document.getElementById('betProbability'),
  probUnknown: document.getElementById('probUnknown'),
  probKnown: document.getElementById('probKnown'),
  turnIndicator: document.getElementById('turnIndicator'),
  turnText: document.getElementById('turnText'),
  myDice: document.getElementById('myDice'),
  actionArea: document.getElementById('actionArea'),
  waitingTurn: document.getElementById('waitingTurn'),
  waitingForPlayer: document.getElementById('waitingForPlayer'),
  betCount: document.getElementById('betCount'),
  betValue: document.getElementById('betValue'),
  placeBetBtn: document.getElementById('placeBetBtn'),
  doubtBtn: document.getElementById('doubtBtn'),
  calzoBtn: document.getElementById('calzoBtn'),
  resolutionDisplay: document.getElementById('resolutionDisplay'),
  resolutionContent: document.getElementById('resolutionContent'),
  allDiceReveal: document.getElementById('allDiceReveal'),
  nextRoundBtn: document.getElementById('nextRoundBtn'),
  probChartBtn: document.getElementById('probChartBtn'),
  stopGameBtn: document.getElementById('stopGameBtn'),
  logBtn: document.getElementById('logBtn'),
  valueInputGroup: document.getElementById('valueInputGroup'),
  diceSelector: document.getElementById('diceSelector'),
  paintControls: document.getElementById('paintControls'),
  paintDiceSelector: document.getElementById('paintDiceSelector'),
  paloFijoBanner: document.getElementById('paloFijoBanner'),
  paloFijoPlayer: document.getElementById('paloFijoPlayer'),
  paloFijoValueDisplay: document.getElementById('paloFijoValueDisplay'),
  
  // Probability modal
  probModal: document.getElementById('probModal'),
  closeProbModal: document.getElementById('closeProbModal'),
  probDescription: document.getElementById('probDescription'),
  probTableBody: document.getElementById('probTableBody'),
  
  // Log modal
  logModal: document.getElementById('logModal'),
  closeLogModal: document.getElementById('closeLogModal'),
  logContent: document.getElementById('logContent'),
  
  // Game over screen
  winnerDisplay: document.getElementById('winnerDisplay'),
  playAgainBtn: document.getElementById('playAgainBtn'),
  
  // Error toast
  errorToast: document.getElementById('errorToast')
};

// ============================================
// Dice Rendering (CSS dots)
// ============================================

function createDieElement(value, options = {}) {
  const { isWild = false, isPainted = false, small = false } = options;
  
  const die = document.createElement('div');
  die.className = 'die';
  if (value === 1 && isWild) die.classList.add('wild');
  if (isPainted) die.classList.add('painted');
  
  // Create dots based on value
  const dotPatterns = {
    1: ['center'],
    2: ['top-right', 'bottom-left'],
    3: ['top-right', 'center', 'bottom-left'],
    4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
    6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right']
  };
  
  const dots = dotPatterns[value] || [];
  dots.forEach(pos => {
    const dot = document.createElement('div');
    dot.className = `dot ${pos}`;
    die.appendChild(dot);
  });
  
  return die;
}

// ============================================
// Screen Management
// ============================================

function showScreen(screenName) {
  Object.values(screens).forEach(screen => {
    screen.classList.add('hidden');
  });
  if (screens[screenName]) {
    screens[screenName].classList.remove('hidden');
  }
}

// ============================================
// UI Update Functions
// ============================================

function updateLobby(state) {
  elements.playerCount.textContent = state.players.length;
  elements.lobbyPlayerList.innerHTML = '';
  
  state.players.forEach((player, index) => {
    const li = document.createElement('li');
    
    // Add classes
    const isFirstHuman = state.players.findIndex(p => !p.isBot) === index;
    if (isFirstHuman) {
      li.classList.add('host');
    }
    if (player.isBot) {
      li.classList.add('bot');
    }
    
    // Player info span
    const playerInfo = document.createElement('span');
    playerInfo.className = 'player-info';
    
    const emoji = document.createElement('span');
    emoji.className = 'player-emoji';
    emoji.textContent = player.emoji || '🎲';
    
    const name = document.createElement('span');
    name.className = 'player-name';
    name.textContent = player.name;
    if (player.id === myPlayerId) {
      name.textContent += ' (You)';
    }
    
    playerInfo.appendChild(emoji);
    playerInfo.appendChild(name);
    li.appendChild(playerInfo);
    
    // Remove bot button (only for host, only for bots)
    if (state.isHost && player.isBot) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-bot-btn';
      removeBtn.textContent = '✕';
      removeBtn.onclick = () => removeBot(player.id);
      li.appendChild(removeBtn);
    }
    
    elements.lobbyPlayerList.appendChild(li);
  });
  
  // Show/hide host controls
  if (state.isHost) {
    elements.hostControls.classList.remove('hidden');
    elements.waitingMessage.classList.add('hidden');
    elements.startGameBtn.disabled = state.players.length < 2;
    elements.addBotBtn.disabled = state.players.length >= 8;
  } else {
    elements.hostControls.classList.add('hidden');
    elements.waitingMessage.classList.remove('hidden');
  }
}

function updateGameScreen(state) {
  // Update header
  elements.roundNumber.textContent = state.roundNumber;
  elements.totalDice.textContent = state.totalDice;
  
  // Show/hide stop button for host
  if (state.canStop) {
    elements.stopGameBtn.classList.remove('hidden');
  } else {
    elements.stopGameBtn.classList.add('hidden');
  }
  
  // Update Palo Fijo banner
  if (state.isPaloFijo) {
    elements.paloFijoBanner.classList.remove('hidden');
    elements.paloFijoPlayer.textContent = state.paloFijoPlayer;
    elements.paloFijoValueDisplay.textContent = state.paloFijoValue ? `${state.paloFijoValue}s` : '(first bet sets value)';
    
    // Lock dice selector to palo fijo value
    updateDiceSelectorForPaloFijo(state.paloFijoValue);
  } else {
    elements.paloFijoBanner.classList.add('hidden');
    resetDiceSelector();
  }
  
  // Update players display
  updatePlayersDisplay(state);
  
  // Update current bet
  if (state.currentBet) {
    elements.currentBetValue.textContent = `${state.currentBet.count} × ${state.currentBet.value}s`;
    elements.currentBettor.textContent = `by ${state.currentBet.playerName}`;
    
    // Show probability for current bet
    updateBetProbability(state);
  } else {
    elements.currentBetValue.textContent = 'None';
    elements.currentBettor.textContent = 'First bet of the round';
    elements.betProbability.classList.add('hidden');
  }
  
  // Update turn indicator
  if (state.isMyTurn) {
    elements.turnIndicator.classList.add('my-turn');
    elements.turnIndicator.classList.remove('bot-turn');
    elements.turnText.textContent = '🎲 Your Turn!';
  } else if (state.isCurrentPlayerBot) {
    elements.turnIndicator.classList.remove('my-turn');
    elements.turnIndicator.classList.add('bot-turn');
    elements.turnText.textContent = `🤖 ${state.currentPlayerName} is thinking...`;
  } else {
    elements.turnIndicator.classList.remove('my-turn');
    elements.turnIndicator.classList.remove('bot-turn');
    elements.turnText.textContent = `Waiting for ${state.currentPlayerName}...`;
  }
  
  // Update my dice
  updateMyDice(state.myDice);
  
  // Show/hide action area
  if (state.state === 'betting') {
    if (state.isMyTurn) {
      elements.actionArea.classList.remove('hidden');
      elements.waitingTurn.classList.add('hidden');
      elements.resolutionDisplay.classList.add('hidden');
      
      // Enable/disable doubt and calzo based on whether there's a bet
      elements.doubtBtn.disabled = !state.currentBet;
      elements.calzoBtn.disabled = !state.currentBet;
      
      // Set reasonable default bet
      if (state.currentBet) {
        elements.betCount.value = state.currentBet.count;
        if (selectedBetValue === state.currentBet.value) {
          elements.betCount.value = state.currentBet.count + 1;
        }
      } else {
        elements.betCount.value = 1;
      }
      
      // Update paint controls
      updatePaintControls(state);
    } else {
      elements.actionArea.classList.add('hidden');
      elements.waitingTurn.classList.remove('hidden');
      elements.waitingForPlayer.textContent = state.currentPlayerName;
      elements.resolutionDisplay.classList.add('hidden');
    }
  } else if (state.state === 'resolving') {
    elements.actionArea.classList.add('hidden');
    elements.waitingTurn.classList.add('hidden');
    elements.resolutionDisplay.classList.remove('hidden');
    
    updateResolutionDisplay(state);
  }
}

function updateDiceSelectorForPaloFijo(lockedValue) {
  document.querySelectorAll('.dice-btn').forEach(btn => {
    const value = parseInt(btn.dataset.value);
    if (lockedValue) {
      if (value === lockedValue) {
        btn.classList.add('locked', 'selected');
        selectedBetValue = value;
        elements.betValue.value = value;
      } else {
        btn.classList.remove('selected');
        btn.classList.add('locked');
        btn.style.opacity = '0.3';
      }
    }
  });
}

function resetDiceSelector() {
  document.querySelectorAll('.dice-btn').forEach(btn => {
    btn.classList.remove('locked');
    btn.style.opacity = '1';
  });
}

function updatePaintControls(state) {
  // Hide paint controls during Palo Fijo or if already painted
  if (state.isPaloFijo || state.hasPaintedThisRound || !state.canPaint) {
    elements.paintControls.classList.add('hidden');
    selectedPaintDice = [];
    return;
  }
  
  elements.paintControls.classList.remove('hidden');
  elements.paintDiceSelector.innerHTML = '';
  selectedPaintDice = [];
  
  const myDice = state.myDice || [];
  myDice.forEach((value, index) => {
    const dieOption = createDieElement(value, { isWild: value === 1 });
    dieOption.classList.add('paint-die-option');
    dieOption.dataset.index = index;
    dieOption.dataset.value = value;
    
    dieOption.onclick = () => togglePaintDie(index, value, dieOption);
    
    elements.paintDiceSelector.appendChild(dieOption);
  });
}

function togglePaintDie(index, value, element) {
  // Can only paint dice matching the bet value or 1s
  if (value !== selectedBetValue && value !== 1) {
    showError(`Can only paint ${selectedBetValue}s or 1s (wilds)`);
    return;
  }
  
  const idx = selectedPaintDice.indexOf(index);
  if (idx >= 0) {
    selectedPaintDice.splice(idx, 1);
    element.classList.remove('selected');
  } else {
    selectedPaintDice.push(index);
    element.classList.add('selected');
  }
}

function updatePlayersDisplay(state) {
  elements.playersDisplay.innerHTML = '';
  
  state.players.forEach(player => {
    const card = document.createElement('div');
    card.className = 'player-card';
    
    if (player.id === state.currentPlayerId) {
      card.classList.add('current-turn');
    }
    if (!player.isAlive) {
      card.classList.add('eliminated');
    }
    if (player.isBot) {
      card.classList.add('bot');
    }
    
    // Header with emoji and name
    const header = document.createElement('div');
    header.className = 'player-header';
    
    const emoji = document.createElement('span');
    emoji.className = 'emoji';
    emoji.textContent = player.emoji || '🎲';
    
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = player.name + (player.id === myPlayerId ? '*' : '');
    
    header.appendChild(emoji);
    header.appendChild(name);
    
    // Dice count
    const diceCount = document.createElement('div');
    diceCount.className = 'dice-count';
    diceCount.innerHTML = `Dice: <span>${player.diceCount}</span>`;
    
    card.appendChild(header);
    card.appendChild(diceCount);
    
    // Last bet (if any)
    if (player.lastBet) {
      const lastBet = document.createElement('div');
      lastBet.className = 'last-bet';
      lastBet.textContent = `${player.lastBet.count}×${player.lastBet.value}s`;
      card.appendChild(lastBet);
    }
    
    // Painted dice (if any)
    if (player.paintedDice && player.paintedDice.length > 0) {
      const paintedDiv = document.createElement('div');
      paintedDiv.className = 'painted-dice';
      player.paintedDice.forEach(value => {
        const pDie = document.createElement('div');
        pDie.className = 'painted-die';
        pDie.textContent = value;
        paintedDiv.appendChild(pDie);
      });
      card.appendChild(paintedDiv);
    }
    
    elements.playersDisplay.appendChild(card);
  });
}

function updateMyDice(dice) {
  elements.myDice.innerHTML = '';
  
  if (!dice || dice.length === 0) {
    const noDice = document.createElement('div');
    noDice.style.color = '#6b7280';
    noDice.textContent = 'No dice (spectating)';
    elements.myDice.appendChild(noDice);
    return;
  }
  
  dice.forEach(value => {
    const die = createDieElement(value, { isWild: value === 1 });
    elements.myDice.appendChild(die);
  });
}

function updateBetProbability(state) {
  if (!state.currentBet || !state.myDice) {
    elements.betProbability.classList.add('hidden');
    return;
  }
  
  socket.emit('getProbabilities', {
    count: state.currentBet.count,
    value: state.currentBet.value
  });
}

function updateResolutionDisplay(state) {
  const lastAction = state.lastAction;
  if (!lastAction) return;
  
  let html = '';
  const isPaloFijo = lastAction.isPaloFijo;
  const paloFijoNote = isPaloFijo ? '<div class="resolution-detail" style="color: #dc2626;">🔒 Palo Fijo round (1s were NOT wild)</div>' : '';
  
  if (lastAction.type === 'doubt') {
    const doubterWon = !lastAction.betMet;
    html = `
      <div class="resolution-title ${doubterWon ? 'doubt-win' : 'doubt-lose'}">
        ${doubterWon ? '✅ Doubt Successful!' : '❌ Doubt Failed!'}
      </div>
      <div class="resolution-detail">
        <strong>${lastAction.doubter}</strong> doubted <strong>${lastAction.bettor}</strong>'s bet
      </div>
      <div class="resolution-detail">
        Bet: ${lastAction.bet.count} × ${lastAction.bet.value}s
      </div>
      <div class="resolution-detail">
        Actual count: <strong>${lastAction.actualCount}</strong>
        ${!isPaloFijo && lastAction.bet.value !== 1 ? '(including wild 1s)' : ''}
      </div>
      ${paloFijoNote}
      <div class="resolution-loser">
        ${lastAction.loser} loses a die! (${lastAction.loserDiceRemaining} remaining)
      </div>
    `;
  } else if (lastAction.type === 'calzo') {
    const calzoWon = lastAction.isExact;
    html = `
      <div class="resolution-title ${calzoWon ? 'calzo-win' : 'calzo-lose'}">
        ${calzoWon ? '🎯 Calzo Successful!' : '❌ Calzo Failed!'}
      </div>
      <div class="resolution-detail">
        <strong>${lastAction.caller}</strong> called Calzo on ${lastAction.bet.count} × ${lastAction.bet.value}s
      </div>
      <div class="resolution-detail">
        Actual count: <strong>${lastAction.actualCount}</strong>
        ${!isPaloFijo && lastAction.bet.value !== 1 ? '(including wild 1s)' : ''}
      </div>
      ${paloFijoNote}
      <div class="resolution-loser">
        ${lastAction.caller} ${calzoWon ? 'gains' : 'loses'} a die! (${lastAction.callerDiceRemaining} remaining)
      </div>
    `;
  }
  
  elements.resolutionContent.innerHTML = html;
  
  // Show all dice
  if (state.revealedDice) {
    let diceHtml = '<h4>All Dice Revealed:</h4>';
    state.revealedDice.forEach(playerDice => {
      const diceElements = playerDice.dice.map((d, idx) => {
        const isPainted = playerDice.paintedIndices && playerDice.paintedIndices.includes(idx);
        return `<div class="die ${d === 1 ? 'wild' : ''} ${isPainted ? 'painted' : ''}">
          ${getDotPatternHTML(d)}
        </div>`;
      }).join('');
      
      diceHtml += `
        <div class="player-dice-row">
          <span class="player-name">${playerDice.emoji || ''} ${playerDice.playerName}:</span>
          <div class="dice-list">${diceElements}</div>
        </div>
      `;
    });
    elements.allDiceReveal.innerHTML = diceHtml;
  }
}

function getDotPatternHTML(value) {
  const dotPatterns = {
    1: ['center'],
    2: ['top-right', 'bottom-left'],
    3: ['top-right', 'center', 'bottom-left'],
    4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
    6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right']
  };
  
  const dots = dotPatterns[value] || [];
  return dots.map(pos => `<div class="dot ${pos}"></div>`).join('');
}

function updateGameOver(state) {
  if (state.winner) {
    elements.winnerDisplay.innerHTML = `
      🏆 Winner!
      <span class="winner-name">${state.winner.emoji || '🎲'} ${state.winner.name}</span>
    `;
  }
}

// ============================================
// Action Log
// ============================================

function openActionLog() {
  if (!gameState || !gameState.actionLog) return;
  
  const log = gameState.actionLog;
  
  // Group by round
  const byRound = {};
  log.forEach(entry => {
    const round = entry.round || entry.timestamp || 0;
    if (!byRound[round]) byRound[round] = [];
    byRound[round].push(entry);
  });
  
  let html = '';
  Object.keys(byRound).sort((a, b) => b - a).forEach(round => {
    html += `<div class="log-round">
      <div class="log-round-header">Round ${round}</div>`;
    
    byRound[round].forEach(entry => {
      let entryHtml = '';
      let entryClass = entry.type;
      
      if (entry.type === 'bet') {
        const painted = entry.painted && entry.painted.length > 0 
          ? ` 🎨[${entry.painted.join(',')}]` : '';
        entryHtml = `${entry.emoji || ''} <strong>${entry.player}</strong> bet ${entry.bet.count}×${entry.bet.value}s${painted}`;
      } else if (entry.type === 'doubt') {
        const resultClass = entry.success ? 'result' : 'result fail';
        entryHtml = `<strong>${entry.doubter}</strong> doubted ${entry.bettor}'s ${entry.bet.count}×${entry.bet.value}s 
          → Actual: ${entry.actualCount} <span class="${resultClass}">${entry.success ? '✓ Success' : '✗ Failed'}</span>`;
      } else if (entry.type === 'calzo') {
        const resultClass = entry.success ? 'result' : 'result fail';
        entryHtml = `<strong>${entry.caller}</strong> called Calzo on ${entry.bet.count}×${entry.bet.value}s 
          → Actual: ${entry.actualCount} <span class="${resultClass}">${entry.success ? '✓ Exact!' : '✗ Wrong'}</span>`;
      } else if (entry.type === 'palo_fijo_start') {
        entryClass = 'palo-fijo';
        entryHtml = `🔒 <strong>${entry.player}</strong> triggered PALO FIJO`;
      } else if (entry.type === 'game_over') {
        entryHtml = `🏆 <strong>${entry.winner}</strong> wins the game!`;
      }
      
      html += `<div class="log-entry ${entryClass}">${entryHtml}</div>`;
    });
    
    html += '</div>';
  });
  
  if (!html) {
    html = '<p style="color: #6b7280;">No actions yet</p>';
  }
  
  elements.logContent.innerHTML = html;
  elements.logModal.classList.remove('hidden');
}

function closeActionLog() {
  elements.logModal.classList.add('hidden');
}

// ============================================
// Probability Chart
// ============================================

function openProbabilityChart() {
  if (!gameState) return;
  
  const paintedStr = (gameState.allPaintedDice || []).join(',');
  const url = `/api/probability?total_dice=${gameState.totalDice}&my_dice=${(gameState.myDice || []).join(',')}&painted_dice=${paintedStr}`;
  
  fetch(url)
    .then(res => res.json())
    .then(data => {
      probabilityData = data;
      renderProbabilityTable();
      elements.probModal.classList.remove('hidden');
    })
    .catch(err => {
      console.error('Failed to load probability data:', err);
      showError('Failed to load probability chart');
    });
}

function closeProbabilityChart() {
  elements.probModal.classList.add('hidden');
}

function renderProbabilityTable() {
  if (!probabilityData) return;
  
  const data = currentProbTab === 'known' && probabilityData.known 
    ? probabilityData.known 
    : probabilityData.unknown;
  
  if (currentProbTab === 'known') {
    const knownDice = (gameState.myDice || []).concat(gameState.allPaintedDice || []);
    elements.probDescription.textContent = 
      `Probability knowing dice: ${knownDice.join(', ') || 'none'}`;
  } else {
    elements.probDescription.textContent = 
      'Probability that a bet is true (without knowing any dice)';
  }
  
  const maxRows = Math.min(probabilityData.total_dice, 12);
  let html = '';
  
  for (let count = 1; count <= maxRows; count++) {
    html += `<tr><td><strong>${count}</strong></td>`;
    
    for (let value = 1; value <= 6; value++) {
      const valueData = data.find(v => v.value === value);
      if (valueData && valueData.probabilities[count - 1]) {
        const prob = valueData.probabilities[count - 1].at_least;
        const probClass = prob > 50 ? 'prob-high' : (prob > 25 ? 'prob-medium' : 'prob-low');
        html += `<td class="${probClass}">${prob}%</td>`;
      } else {
        html += `<td>-</td>`;
      }
    }
    
    html += '</tr>';
  }
  
  elements.probTableBody.innerHTML = html;
}

function switchProbTab(tab) {
  currentProbTab = tab;
  document.querySelectorAll('.prob-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  renderProbabilityTable();
}

// ============================================
// Socket Event Handlers
// ============================================

socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  showError('Connection lost. Please refresh the page.');
});

socket.on('gameState', (state) => {
  console.log('Game state:', state);
  gameState = state;
  
  switch (state.state) {
    case 'waiting':
      if (myPlayerId) {
        showScreen('lobby');
        updateLobby(state);
      }
      break;
    case 'betting':
    case 'rolling':
    case 'resolving':
      showScreen('game');
      updateGameScreen(state);
      break;
    case 'game_over':
      showScreen('gameOver');
      updateGameOver(state);
      break;
  }
});

socket.on('joinResult', (result) => {
  if (result.success) {
    myPlayerId = result.playerId;
    elements.joinError.textContent = '';
    showScreen('lobby');
  } else {
    elements.joinError.textContent = result.error;
  }
});

socket.on('error', (data) => {
  showError(data.message);
});

socket.on('probabilities', (data) => {
  if (data && elements.betProbability) {
    elements.probUnknown.textContent = `Others: ${data.unknown.at_least}%`;
    elements.probKnown.textContent = `You: ${data.known.at_least}%`;
    elements.betProbability.classList.remove('hidden');
  }
});

socket.on('playerJoined', (data) => {
  console.log(`${data.player.name} joined`);
});

socket.on('playerLeft', (data) => {
  console.log(`${data.player.name} left`);
});

socket.on('botAdded', (data) => {
  console.log(`Bot added: ${data.player.name}`);
});

socket.on('botRemoved', (data) => {
  console.log(`Bot removed: ${data.player.name}`);
});

socket.on('gameStarted', (data) => {
  console.log('Game started!');
});

socket.on('gameStopped', () => {
  console.log('Game stopped');
  showScreen('lobby');
});

socket.on('roundResolved', (result) => {
  console.log('Round resolved:', result);
});

socket.on('newRound', (data) => {
  console.log('New round:', data.roundNumber);
  selectedPaintDice = [];
});

socket.on('gameReset', () => {
  console.log('Game reset');
  showScreen('lobby');
});

// ============================================
// User Actions
// ============================================

function joinGame() {
  const name = elements.playerName.value.trim();
  if (!name) {
    elements.joinError.textContent = 'Please enter your name';
    return;
  }
  socket.emit('join', { name, emoji: selectedEmoji });
}

function startGame() {
  socket.emit('startGame');
}

function stopGame() {
  if (confirm('Are you sure you want to stop the game? All progress will be lost.')) {
    socket.emit('stopGame');
  }
}

function addBot() {
  socket.emit('addBot');
}

function removeBot(botId) {
  socket.emit('removeBot', { botId });
}

function placeBet() {
  const count = parseInt(elements.betCount.value);
  const value = selectedBetValue;
  
  if (isNaN(count) || count < 1) {
    showError('Invalid bet count');
    return;
  }
  
  const paintIndices = selectedPaintDice.length > 0 ? selectedPaintDice : null;
  
  socket.emit('bet', { count, value, paintIndices });
  selectedPaintDice = [];
}

function callDoubt() {
  socket.emit('doubt');
}

function callCalzo() {
  socket.emit('calzo');
}

function nextRound() {
  socket.emit('nextRound');
}

function playAgain() {
  socket.emit('resetGame');
}

function adjustBetCount(delta) {
  const input = elements.betCount;
  let value = parseInt(input.value) || 1;
  value = Math.max(1, value + delta);
  if (gameState) {
    value = Math.min(value, gameState.totalDice);
  }
  input.value = value;
}

function selectDiceValue(value) {
  const btn = document.querySelector(`.dice-btn[data-value="${value}"]`);
  if (btn && btn.classList.contains('locked') && !btn.classList.contains('selected')) {
    return;
  }
  
  selectedBetValue = value;
  elements.betValue.value = value;
  
  document.querySelectorAll('.dice-btn').forEach(b => {
    b.classList.remove('selected');
    if (parseInt(b.dataset.value) === value) {
      b.classList.add('selected');
    }
  });
  
  if (gameState && gameState.canPaint) {
    updatePaintControls(gameState);
  }
}

function selectEmoji(emoji) {
  selectedEmoji = emoji;
  document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.classList.remove('selected');
    if (btn.dataset.emoji === emoji) {
      btn.classList.add('selected');
    }
  });
}

function showError(message) {
  elements.errorToast.textContent = message;
  elements.errorToast.classList.remove('hidden');
  setTimeout(() => {
    elements.errorToast.classList.add('hidden');
  }, 3000);
}

// Event Listeners
elements.joinBtn.addEventListener('click', joinGame);
elements.playerName.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') joinGame();
});

document.querySelectorAll('.emoji-btn').forEach(btn => {
  btn.addEventListener('click', () => selectEmoji(btn.dataset.emoji));
});

elements.startGameBtn.addEventListener('click', startGame);
elements.addBotBtn.addEventListener('click', addBot);
elements.placeBetBtn.addEventListener('click', placeBet);
elements.doubtBtn.addEventListener('click', callDoubt);
elements.calzoBtn.addEventListener('click', callCalzo);
elements.nextRoundBtn.addEventListener('click', nextRound);
elements.probChartBtn.addEventListener('click', openProbabilityChart);
elements.stopGameBtn.addEventListener('click', stopGame);
elements.logBtn.addEventListener('click', openActionLog);

elements.closeProbModal.addEventListener('click', closeProbabilityChart);
elements.probModal.addEventListener('click', (e) => {
  if (e.target === elements.probModal) closeProbabilityChart();
});

elements.closeLogModal.addEventListener('click', closeActionLog);
elements.logModal.addEventListener('click', (e) => {
  if (e.target === elements.logModal) closeActionLog();
});

document.querySelectorAll('.prob-tab').forEach(tab => {
  tab.addEventListener('click', () => switchProbTab(tab.dataset.tab));
});

document.querySelectorAll('.dice-btn').forEach(btn => {
  btn.addEventListener('click', () => selectDiceValue(parseInt(btn.dataset.value)));
});

elements.playAgainBtn.addEventListener('click', playAgain);

elements.betCount.addEventListener('input', () => {
  let value = parseInt(elements.betCount.value);
  if (isNaN(value) || value < 1) {
    elements.betCount.value = 1;
  } else if (gameState && value > gameState.totalDice) {
    elements.betCount.value = gameState.totalDice;
  }
});

// Initialize
showScreen('join');
elements.playerName.focus();
window.adjustBetCount = adjustBetCount;
