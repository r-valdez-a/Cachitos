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
let paintMode = false; // Whether paint selection is visible
let sidebarMinimized = false;
let chatHistory = [];

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
  spectatorCount: document.getElementById('spectatorCount'),
  lobbySpectatorList: document.getElementById('lobbySpectatorList'),
  spectatorBench: document.getElementById('spectatorBench'),
  hostControls: document.getElementById('hostControls'),
  startGameBtn: document.getElementById('startGameBtn'),
  addBotBtn: document.getElementById('addBotBtn'),
  shuffleBtn: document.getElementById('shuffleBtn'),
  waitingMessage: document.getElementById('waitingMessage'),
  
  // Game screen
  roundNumber: document.getElementById('roundNumber'),
  totalDice: document.getElementById('totalDice'),
  playersDisplay: document.getElementById('playersDisplay'),
  currentBetValue: document.getElementById('currentBetValue'),
  currentBettor: document.getElementById('currentBettor'),
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
  chatBtn: document.getElementById('chatBtn'),
  valueInputGroup: document.getElementById('valueInputGroup'),
  diceSelector: document.getElementById('diceSelector'),
  paintControls: document.getElementById('paintControls'),
  paintDiceSelector: document.getElementById('paintDiceSelector'),
  paloFijoBanner: document.getElementById('paloFijoBanner'),
  paloFijoPlayer: document.getElementById('paloFijoPlayer'),
  paloFijoValueDisplay: document.getElementById('paloFijoValueDisplay'),
  
  // Sidebar log
  logSidebar: document.getElementById('logSidebar'),
  minimizeLogBtn: document.getElementById('minimizeLogBtn'),
  expandLogBtn: document.getElementById('expandLogBtn'),
  sidebarLogContent: document.getElementById('sidebarLogContent'),
  
  // Chat sidebar
  chatSidebar: document.getElementById('chatSidebar'),
  minimizeChatBtn: document.getElementById('minimizeChatBtn'),
  expandChatBtn: document.getElementById('expandChatBtn'),
  chatMessages: document.getElementById('chatMessages'),
  chatInput: document.getElementById('chatInput'),
  chatSendBtn: document.getElementById('chatSendBtn'),
  
  // Probability modal
  probModal: document.getElementById('probModal'),
  closeProbModal: document.getElementById('closeProbModal'),
  probDescription: document.getElementById('probDescription'),
  probTableBody: document.getElementById('probTableBody'),
  
  // Log modal (mobile)
  logModal: document.getElementById('logModal'),
  closeLogModal: document.getElementById('closeLogModal'),
  logContent: document.getElementById('logContent'),
  
  // Lobby chat
  lobbyChatMessages: document.getElementById('lobbyChatMessages'),
  lobbyChatInput: document.getElementById('lobbyChatInput'),
  lobbyChatSendBtn: document.getElementById('lobbyChatSendBtn'),
  
  // Chat modal (mobile)
  chatModal: document.getElementById('chatModal'),
  closeChatModal: document.getElementById('closeChatModal'),
  modalChatMessages: document.getElementById('modalChatMessages'),
  modalChatInput: document.getElementById('modalChatInput'),
  modalChatSendBtn: document.getElementById('modalChatSendBtn'),
  howToPlayBtn: document.getElementById('howToPlayBtn'),
  howToPlayModal: document.getElementById('howToPlayModal'),
  closeHowToPlayModal: document.getElementById('closeHowToPlayModal'),
  
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
  const { isWild = false, isPainted = false } = options;
  
  const die = document.createElement('div');
  die.className = 'die';
  if (value === 1 && isWild) die.classList.add('wild');
  if (isPainted) die.classList.add('painted');
  
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

/**
 * Get inline HTML for a mini die with pips (for use in text displays)
 * @param {number} value - Die face value 1-6
 * @param {string} size - CSS size (default '20px')
 * @returns {string} HTML string
 */
function dieIconHTML(value, size = '20px') {
  const dotPatterns = {
    1: ['center'], 2: ['top-right', 'bottom-left'],
    3: ['top-right', 'center', 'bottom-left'],
    4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
    6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right']
  };
  const dots = (dotPatterns[value] || []).map(pos => `<span class="mini-dot ${pos}"></span>`).join('');
  return `<span class="die-inline" style="width:${size};height:${size}">${dots}</span>`;
}

/**
 * Format a bet as HTML with inline die icon: "4 × [die]"
 */
function betHTML(count, value, size = '20px') {
  return `${count} × ${dieIconHTML(value, size)}`;
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
  
  // Re-populate chat containers when switching screens
  if (screenName === 'lobby') {
    renderChatHistory(elements.lobbyChatMessages);
  } else if (screenName === 'game') {
    renderChatHistory(elements.chatMessages);
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
    
    if (player.id === state.hostId) li.classList.add('host');
    if (player.isBot) li.classList.add('bot');
    
    // Reorder buttons (host only)
    if (state.isHost) {
      const reorderDiv = document.createElement('div');
      reorderDiv.className = 'reorder-btns';
      
      const upBtn = document.createElement('button');
      upBtn.className = 'reorder-btn';
      upBtn.textContent = '▲';
      upBtn.title = 'Move up';
      upBtn.onclick = () => movePlayer(player.id, 'up');
      
      const downBtn = document.createElement('button');
      downBtn.className = 'reorder-btn';
      downBtn.textContent = '▼';
      downBtn.title = 'Move down';
      downBtn.onclick = () => movePlayer(player.id, 'down');
      
      reorderDiv.appendChild(upBtn);
      reorderDiv.appendChild(downBtn);
      li.appendChild(reorderDiv);
    }
    
    // Order number
    const orderNum = document.createElement('span');
    orderNum.className = 'player-order-num';
    orderNum.textContent = `${index + 1}.`;
    li.appendChild(orderNum);
    
    // Player info span
    const playerInfo = document.createElement('span');
    playerInfo.className = 'player-info';
    
    const emoji = document.createElement('span');
    emoji.className = 'player-emoji';
    emoji.textContent = player.emoji || '🎲';
    
    const name = document.createElement('span');
    name.className = 'player-name';
    name.textContent = player.name;
    if (player.id === myPlayerId) name.textContent += ' (You)';
    
    playerInfo.appendChild(emoji);
    playerInfo.appendChild(name);
    li.appendChild(playerInfo);
    
    // Host action buttons
    if (state.isHost && player.id !== myPlayerId) {
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'lobby-player-actions';
      
      // Make host button (non-bot only)
      if (!player.isBot) {
        const hostBtn = document.createElement('button');
        hostBtn.className = 'lobby-action-btn host-btn';
        hostBtn.textContent = '👑';
        hostBtn.title = 'Make host';
        hostBtn.onclick = () => socket.emit('transferHost', { targetId: player.id });
        actionsDiv.appendChild(hostBtn);
      }
      
      // Move to spectators button
      if (!player.isBot) {
        const benchBtn = document.createElement('button');
        benchBtn.className = 'lobby-action-btn bench-btn';
        benchBtn.textContent = '👁️';
        benchBtn.title = 'Move to spectators';
        benchBtn.onclick = () => socket.emit('moveToSpectators', { targetId: player.id });
        actionsDiv.appendChild(benchBtn);
      }
      
      // Kick button
      const kickBtn = document.createElement('button');
      kickBtn.className = 'lobby-action-btn kick-btn';
      kickBtn.textContent = '✕';
      kickBtn.title = 'Kick';
      kickBtn.onclick = () => {
        if (player.isBot) {
          removeBot(player.id);
        } else {
          socket.emit('kickPlayer', { targetId: player.id });
        }
      };
      actionsDiv.appendChild(kickBtn);
      
      li.appendChild(actionsDiv);
    }
    
    elements.lobbyPlayerList.appendChild(li);
  });
  
  // Spectator bench
  const spectators = state.spectators || [];
  if (elements.spectatorCount) elements.spectatorCount.textContent = spectators.length;
  
  if (elements.spectatorBench) {
    if (spectators.length > 0 || state.isHost) {
      elements.spectatorBench.classList.remove('hidden');
    } else {
      elements.spectatorBench.classList.add('hidden');
    }
  }
  
  if (elements.lobbySpectatorList) {
    elements.lobbySpectatorList.innerHTML = '';
    spectators.forEach(spec => {
      const li = document.createElement('li');
      li.classList.add('spectator');
      
      const playerInfo = document.createElement('span');
      playerInfo.className = 'player-info';
      
      const emoji = document.createElement('span');
      emoji.className = 'player-emoji';
      emoji.textContent = spec.emoji || '👁️';
      
      const name = document.createElement('span');
      name.className = 'player-name';
      name.textContent = spec.name;
      if (spec.id === myPlayerId) name.textContent += ' (You)';
      
      playerInfo.appendChild(emoji);
      playerInfo.appendChild(name);
      li.appendChild(playerInfo);
      
      // Host actions for spectators
      if (state.isHost && spec.id !== myPlayerId) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'lobby-player-actions';
        
        // Move to game table
        const tableBtn = document.createElement('button');
        tableBtn.className = 'lobby-action-btn table-btn';
        tableBtn.textContent = '🎮';
        tableBtn.title = 'Move to game table';
        tableBtn.onclick = () => socket.emit('moveToPlayers', { targetId: spec.id });
        actionsDiv.appendChild(tableBtn);
        
        // Kick
        const kickBtn = document.createElement('button');
        kickBtn.className = 'lobby-action-btn kick-btn';
        kickBtn.textContent = '✕';
        kickBtn.title = 'Kick';
        kickBtn.onclick = () => socket.emit('kickPlayer', { targetId: spec.id });
        actionsDiv.appendChild(kickBtn);
        
        li.appendChild(actionsDiv);
      }
      
      elements.lobbySpectatorList.appendChild(li);
    });
  }
  
  // Show/hide host controls
  if (state.isHost) {
    elements.hostControls.classList.remove('hidden');
    elements.waitingMessage.classList.add('hidden');
    elements.startGameBtn.disabled = state.players.length < 2;
    elements.addBotBtn.disabled = state.players.length >= 8;
  } else if (state.isSpectator) {
    elements.hostControls.classList.add('hidden');
    elements.waitingMessage.textContent = '👁️ You are spectating';
    elements.waitingMessage.classList.remove('hidden');
  } else {
    elements.hostControls.classList.add('hidden');
    elements.waitingMessage.textContent = 'Waiting for host to start the game...';
    elements.waitingMessage.classList.remove('hidden');
  }
}

function updateGameScreen(state) {
  elements.roundNumber.textContent = state.roundNumber;
  elements.totalDice.textContent = state.totalDice;
  
  if (state.canStop) {
    elements.stopGameBtn.classList.remove('hidden');
  } else {
    elements.stopGameBtn.classList.add('hidden');
  }
  
  if (state.isPaloFijo) {
    elements.paloFijoBanner.classList.remove('hidden');
    elements.paloFijoPlayer.textContent = state.paloFijoPlayer;
    elements.paloFijoValueDisplay.textContent = state.paloFijoValue ? `${state.paloFijoValue}s` : '(first bet sets value)';
    updateDiceSelectorForPaloFijo(state.paloFijoValue);
  } else {
    elements.paloFijoBanner.classList.add('hidden');
    resetDiceSelector();
  }
  
  // 1v1 duel banner
  const duelBanner = document.getElementById('duelBanner');
  if (duelBanner) {
    if (state.is1v1) {
      duelBanner.classList.remove('hidden');
    } else {
      duelBanner.classList.add('hidden');
    }
  }
  
  updatePlayersDisplay(state);
  
  if (state.currentBet) {
    elements.currentBetValue.innerHTML = betHTML(state.currentBet.count, state.currentBet.value, '32px');
    elements.currentBettor.textContent = `by ${state.currentBet.playerName}`;
  } else {
    elements.currentBetValue.innerHTML = 'None';
    elements.currentBettor.textContent = 'First bet of the round';
  }
  
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
  
  updateMyDice(state.myDice, state.diceHidden, state.myDiceCount);
  
  // Spectators can't take actions
  if (state.isSpectator) {
    elements.actionArea.classList.add('hidden');
    elements.waitingTurn.classList.remove('hidden');
    elements.waitingForPlayer.textContent = (state.currentPlayerName || '...') + ' (you are spectating)';
    elements.resolutionDisplay.classList.add('hidden');
    
    if (state.state === 'resolving') {
      elements.waitingTurn.classList.add('hidden');
      elements.resolutionDisplay.classList.remove('hidden');
      updateResolutionDisplay(state);
    }
  } else if (state.state === 'betting') {
    if (state.isMyTurn) {
      elements.actionArea.classList.remove('hidden');
      elements.waitingTurn.classList.add('hidden');
      elements.resolutionDisplay.classList.add('hidden');
      
      elements.doubtBtn.disabled = !state.currentBet;
      elements.calzoBtn.disabled = !state.currentBet;
      
      // Paint button visibility
      const paintBtn = document.getElementById('paintBtn');
      if (paintBtn) {
        if (state.isPaloFijo || state.hasPaintedThisRound || !state.canPaint) {
          paintBtn.classList.add('hidden');
          paintMode = false;
          elements.paintControls.classList.add('hidden');
        } else {
          paintBtn.classList.remove('hidden');
        }
      }
      
      if (state.currentBet) {
        elements.betCount.value = state.currentBet.count;
        if (selectedBetValue === state.currentBet.value) {
          elements.betCount.value = state.currentBet.count + 1;
        }
      } else {
        elements.betCount.value = 1;
      }
      
      // Only show paint dice if paint mode is active
      if (paintMode) {
        updatePaintControls(state);
      } else {
        elements.paintControls.classList.add('hidden');
      }
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
  
  updateSidebarLog(state);
  
  // Show action cue visual feedback
  detectAndShowActionCue(state);
  
  if (!elements.probModal.classList.contains('hidden')) {
    refreshProbabilityChart();
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
    } else {
      btn.classList.remove('locked');
      btn.style.opacity = '1';
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
  if (!state || state.isPaloFijo || state.hasPaintedThisRound || !state.canPaint) {
    elements.paintControls.classList.add('hidden');
    selectedPaintDice = [];
    paintMode = false;
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

function togglePaintMode() {
  if (!gameState || !gameState.canPaint || gameState.hasPaintedThisRound || gameState.isPaloFijo) return;
  paintMode = !paintMode;
  if (paintMode) {
    updatePaintControls(gameState);
  } else {
    elements.paintControls.classList.add('hidden');
    selectedPaintDice = [];
  }
}

function togglePaintDie(index, value, element) {
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
    if (player.id === state.currentPlayerId) card.classList.add('current-turn');
    if (!player.isAlive) card.classList.add('eliminated');
    if (player.isBot) card.classList.add('bot');
    
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
    
    const diceCount = document.createElement('div');
    diceCount.className = 'dice-count';
    diceCount.innerHTML = `Dice: <span>${player.diceCount}</span>`;
    
    card.appendChild(header);
    card.appendChild(diceCount);
    
    if (player.lastBet) {
      const lastBet = document.createElement('div');
      lastBet.className = 'last-bet';
      lastBet.innerHTML = betHTML(player.lastBet.count, player.lastBet.value, '14px');
      card.appendChild(lastBet);
    }
    
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

function updateMyDice(dice, diceHidden, diceCount) {
  elements.myDice.innerHTML = '';
  
  if (diceHidden) {
    const hiddenMsg = document.createElement('div');
    hiddenMsg.className = 'dice-hidden-message';
    hiddenMsg.textContent = '🔒 Your dice are hidden during Palo Fijo';
    elements.myDice.appendChild(hiddenMsg);
    const container = document.createElement('div');
    container.className = 'dice-container';
    for (let i = 0; i < (diceCount || 0); i++) {
      const die = document.createElement('div');
      die.className = 'die die-hidden';
      const question = document.createElement('span');
      question.className = 'die-hidden-mark';
      question.textContent = '?';
      die.appendChild(question);
      container.appendChild(die);
    }
    elements.myDice.appendChild(container);
    return;
  }
  
  if (!dice || dice.length === 0) {
    const noDice = document.createElement('div');
    noDice.style.color = '#6b7280';
    noDice.textContent = gameState && gameState.isSpectator ? '👁️ Spectating' : 'No dice (spectating)';
    elements.myDice.appendChild(noDice);
    return;
  }
  
  dice.forEach(value => {
    const die = createDieElement(value, { isWild: value === 1 });
    elements.myDice.appendChild(die);
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
      <div class="resolution-detail"><strong>${lastAction.doubter}</strong> doubted <strong>${lastAction.bettor}</strong>'s bet</div>
      <div class="resolution-detail">Bet: ${betHTML(lastAction.bet.count, lastAction.bet.value, '22px')}</div>
      <div class="resolution-detail">Actual count: <strong>${lastAction.actualCount}</strong> ${!isPaloFijo && lastAction.bet.value !== 1 ? '(including wild 1s)' : ''}</div>
      ${paloFijoNote}
      <div class="resolution-loser">${lastAction.loser} loses a die! (${lastAction.loserDiceRemaining} remaining)</div>
    `;
  } else if (lastAction.type === 'calzo') {
    const calzoWon = lastAction.isExact;
    const is1v1 = lastAction.is1v1;
    let calzoOutcome;
    if (calzoWon && is1v1) {
      calzoOutcome = `${lastAction.caller} called it right! No die gained (1v1 duel). (${lastAction.callerDiceRemaining} remaining)`;
    } else if (calzoWon) {
      calzoOutcome = `${lastAction.caller} gains a die! (${lastAction.callerDiceRemaining} remaining)`;
    } else {
      calzoOutcome = `${lastAction.caller} loses a die! (${lastAction.callerDiceRemaining} remaining)`;
    }
    html = `
      <div class="resolution-title ${calzoWon ? 'calzo-win' : 'calzo-lose'}">
        ${calzoWon ? '🎯 Calzo Successful!' : '❌ Calzo Failed!'}
      </div>
      <div class="resolution-detail"><strong>${lastAction.caller}</strong> called Calzo on ${betHTML(lastAction.bet.count, lastAction.bet.value, '22px')}</div>
      <div class="resolution-detail">Actual count: <strong>${lastAction.actualCount}</strong> ${!isPaloFijo && lastAction.bet.value !== 1 ? '(including wild 1s)' : ''}</div>
      ${paloFijoNote}
      <div class="resolution-loser">${calzoOutcome}</div>
    `;
  }
  
  elements.resolutionContent.innerHTML = html;
  
  if (state.revealedDice) {
    let diceHtml = '<h4>All Dice Revealed:</h4>';
    state.revealedDice.forEach(playerDice => {
      const diceElements = playerDice.dice.map((d, idx) => {
        const isPainted = playerDice.paintedIndices && playerDice.paintedIndices.includes(idx);
        return `<div class="die ${d === 1 ? 'wild' : ''} ${isPainted ? 'painted' : ''}">${getDotPatternHTML(d)}</div>`;
      }).join('');
      diceHtml += `<div class="player-dice-row"><span class="player-name">${playerDice.emoji || ''} ${playerDice.playerName}:</span><div class="dice-list">${diceElements}</div></div>`;
    });
    elements.allDiceReveal.innerHTML = diceHtml;
  }
}

function getDotPatternHTML(value) {
  const dotPatterns = {
    1: ['center'], 2: ['top-right', 'bottom-left'],
    3: ['top-right', 'center', 'bottom-left'],
    4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
    6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right']
  };
  return (dotPatterns[value] || []).map(pos => `<div class="dot ${pos}"></div>`).join('');
}

function updateGameOver(state) {
  if (state.winner) {
    elements.winnerDisplay.innerHTML = `🏆 Winner!<span class="winner-name">${state.winner.emoji || '🎲'} ${state.winner.name}</span>`;
  }
}

// ============================================
// Sidebar Action Log
// ============================================

function updateSidebarLog(state) {
  if (!state || !state.actionLog) return;
  const html = renderLogHTML(state.actionLog);
  elements.sidebarLogContent.innerHTML = html || '<p style="color: #6b7280; font-size: 0.75rem;">No actions yet</p>';
  elements.sidebarLogContent.scrollTop = elements.sidebarLogContent.scrollHeight;
}

function toggleSidebar() {
  sidebarMinimized = !sidebarMinimized;
  if (sidebarMinimized) {
    elements.logSidebar.classList.add('minimized');
    elements.expandLogBtn.classList.add('visible');
  } else {
    elements.logSidebar.classList.remove('minimized');
    elements.expandLogBtn.classList.remove('visible');
  }
}

function renderLogHTML(log) {
  const byRound = {};
  log.forEach(entry => {
    const round = entry.round || entry.timestamp || 0;
    if (!byRound[round]) byRound[round] = [];
    byRound[round].push(entry);
  });
  
  let html = '';
  Object.keys(byRound).sort((a, b) => a - b).forEach(round => {
    html += `<div class="log-round"><div class="log-round-header">Round ${round}</div>`;
    byRound[round].forEach(entry => {
      let entryHtml = '';
      let entryClass = entry.type;
      if (entry.type === 'bet') {
        const painted = entry.painted && entry.painted.length > 0 ? ` 🎨[${entry.painted.join(',')}]` : '';
        entryHtml = `${entry.emoji || ''} <strong>${entry.player}</strong> bet ${betHTML(entry.bet.count, entry.bet.value, '14px')}${painted}`;
      } else if (entry.type === 'doubt') {
        const resultClass = entry.success ? 'result' : 'result fail';
        entryHtml = `<strong>${entry.doubter}</strong> doubted ${entry.bettor}'s ${betHTML(entry.bet.count, entry.bet.value, '14px')} → Actual: ${entry.actualCount} <span class="${resultClass}">${entry.success ? '✓ Success' : '✗ Failed'}</span>`;
      } else if (entry.type === 'calzo') {
        const resultClass = entry.success ? 'result' : 'result fail';
        entryHtml = `<strong>${entry.caller}</strong> called Calzo on ${betHTML(entry.bet.count, entry.bet.value, '14px')} → Actual: ${entry.actualCount} <span class="${resultClass}">${entry.success ? '✓ Exact!' : '✗ Wrong'}</span>`;
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
  return html;
}

// ============================================
// Action Log Modal (mobile)
// ============================================

function openActionLog() {
  if (!gameState || !gameState.actionLog) return;
  const html = renderLogHTML(gameState.actionLog);
  elements.logContent.innerHTML = html || '<p style="color: #6b7280;">No actions yet</p>';
  elements.logModal.classList.remove('hidden');
}

function closeActionLog() {
  elements.logModal.classList.add('hidden');
}

// ============================================
// Chat Modal (mobile)
// ============================================

function openChatModal() {
  renderChatHistory(elements.modalChatMessages);
  elements.chatModal.classList.remove('hidden');
}

function closeChatModal() {
  elements.chatModal.classList.add('hidden');
}

function sendModalChatMessage() {
  const text = elements.modalChatInput.value.trim();
  if (!text) return;
  socket.emit('chatMessage', { text });
  elements.modalChatInput.value = '';
}

function sendModalQuickEmoji(emoji) {
  socket.emit('chatMessage', { text: emoji });
}

// ============================================
// Probability Chart
// ============================================

function getOtherPlayersPaintedDice() {
  if (!gameState || !gameState.players) return [];
  let otherPainted = [];
  gameState.players.forEach(player => {
    if (player.id !== myPlayerId && player.paintedDice && player.paintedDice.length > 0) {
      otherPainted = otherPainted.concat(player.paintedDice);
    }
  });
  return otherPainted;
}

function openProbabilityChart() {
  if (!gameState) return;
  refreshProbabilityChart();
  elements.probModal.classList.remove('hidden');
}

function refreshProbabilityChart() {
  if (!gameState) return;
  const otherPainted = getOtherPlayersPaintedDice();
  const url = `/api/probability?total_dice=${gameState.totalDice}&my_dice=${(gameState.myDice || []).join(',')}&painted_dice=${otherPainted.join(',')}`;
  fetch(url).then(res => res.json()).then(data => {
    probabilityData = data;
    renderProbabilityTable();
  }).catch(err => console.error('Failed to load probability data:', err));
}

function closeProbabilityChart() {
  elements.probModal.classList.add('hidden');
}

function renderProbabilityTable() {
  if (!probabilityData) return;
  const data = currentProbTab === 'known' && probabilityData.known ? probabilityData.known : probabilityData.unknown;
  
  if (currentProbTab === 'known') {
    const otherPainted = getOtherPlayersPaintedDice();
    const knownDice = (gameState.myDice || []).concat(otherPainted);
    if (gameState.diceHidden) {
      elements.probDescription.textContent = `🔒 Your dice are hidden (Palo Fijo). Known: painted dice only ${otherPainted.join(', ') || 'none'}`;
    } else {
      elements.probDescription.textContent = `Probability knowing dice: ${knownDice.join(', ') || 'none'}`;
    }
  } else {
    elements.probDescription.textContent = 'Probability that a bet is true (without knowing any dice)';
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
  document.querySelectorAll('.prob-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  renderProbabilityTable();
}

// ============================================
// Socket Event Handlers
// ============================================

socket.on('connect', () => console.log('Connected to server'));
socket.on('disconnect', () => { console.log('Disconnected'); showError('Connection lost. Please refresh.'); });

socket.on('gameState', (state) => {
  gameState = state;
  
  // Don't switch screens until the player has joined (entered name/emoji)
  if (!myPlayerId) {
    showScreen('join');
    return;
  }
  
  switch (state.state) {
    case 'waiting':
      showScreen('lobby'); updateLobby(state);
      break;
    case 'betting': case 'rolling': case 'resolving':
      showScreen('game'); updateGameScreen(state);
      break;
    case 'game_over':
      showScreen('gameOver'); updateGameOver(state);
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

socket.on('error', (data) => showError(data.message));
socket.on('playerJoined', (data) => console.log(`${data.player.name} joined`));
socket.on('playerLeft', (data) => console.log(`${data.player.name} left`));
socket.on('botAdded', (data) => console.log(`Bot added: ${data.player.name}`));
socket.on('botRemoved', (data) => console.log(`Bot removed: ${data.player.name}`));
socket.on('gameStarted', () => console.log('Game started!'));
socket.on('gameStopped', () => { console.log('Game stopped'); showScreen('lobby'); });
socket.on('roundResolved', (result) => console.log('Round resolved:', result));
socket.on('newRound', (data) => { console.log('New round:', data.roundNumber); selectedPaintDice = []; paintMode = false; });
socket.on('gameReset', () => { console.log('Game reset'); showScreen('lobby'); });
socket.on('chatMessage', (message) => appendChatMessage(message));

socket.on('kicked', (data) => {
  alert(data.reason || 'You were kicked by the host.');
  myPlayerId = null;
  gameState = null;
  chatHistory = [];
  showScreen('join');
});

// ============================================
// User Actions
// ============================================

function joinGame() {
  const name = elements.playerName.value.trim();
  if (!name) { elements.joinError.textContent = 'Please enter your name'; return; }
  socket.emit('join', { name, emoji: selectedEmoji });
}
function startGame() { socket.emit('startGame'); }
function stopGame() { if (confirm('Stop game? All progress lost.')) socket.emit('stopGame'); }
function addBot() { socket.emit('addBot'); }
function removeBot(botId) { socket.emit('removeBot', { botId }); }
function movePlayer(playerId, direction) { socket.emit('movePlayer', { playerId, direction }); }
function shufflePlayers() { socket.emit('shufflePlayers'); }

function placeBet() {
  const count = parseInt(elements.betCount.value);
  const value = selectedBetValue;
  if (isNaN(count) || count < 1) { showError('Invalid bet count'); return; }
  const paintIndices = selectedPaintDice.length > 0 ? selectedPaintDice : null;
  socket.emit('bet', { count, value, paintIndices });
  selectedPaintDice = [];
  paintMode = false;
  elements.paintControls.classList.add('hidden');
}
function callDoubt() { socket.emit('doubt'); }
function callCalzo() { socket.emit('calzo'); }
function nextRound() { socket.emit('nextRound'); }
function playAgain() { socket.emit('resetGame'); }

function adjustBetCount(delta) {
  const input = elements.betCount;
  let value = parseInt(input.value) || 1;
  value = Math.max(1, value + delta);
  if (gameState) value = Math.min(value, gameState.totalDice);
  input.value = value;
}

function selectDiceValue(value) {
  const btn = document.querySelector(`.dice-btn[data-value="${value}"]`);
  if (btn && btn.classList.contains('locked') && !btn.classList.contains('selected')) return;
  selectedBetValue = value;
  elements.betValue.value = value;
  document.querySelectorAll('.dice-btn').forEach(b => {
    b.classList.remove('selected');
    if (parseInt(b.dataset.value) === value) b.classList.add('selected');
  });
  if (paintMode && gameState && gameState.canPaint) updatePaintControls(gameState);
}

function selectEmoji(emoji) {
  selectedEmoji = emoji;
  document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.classList.remove('selected');
    if (btn.dataset.emoji === emoji) btn.classList.add('selected');
  });
}

function showError(message) {
  elements.errorToast.textContent = message;
  elements.errorToast.classList.remove('hidden');
  setTimeout(() => elements.errorToast.classList.add('hidden'), 3000);
}

// ============================================
// Event Listeners
// ============================================

elements.joinBtn.addEventListener('click', joinGame);
elements.playerName.addEventListener('keypress', (e) => { if (e.key === 'Enter') joinGame(); });
document.querySelectorAll('.emoji-btn').forEach(btn => btn.addEventListener('click', () => selectEmoji(btn.dataset.emoji)));
elements.startGameBtn.addEventListener('click', startGame);
elements.addBotBtn.addEventListener('click', addBot);
elements.shuffleBtn.addEventListener('click', shufflePlayers);
elements.placeBetBtn.addEventListener('click', placeBet);
elements.doubtBtn.addEventListener('click', callDoubt);
elements.calzoBtn.addEventListener('click', callCalzo);
document.getElementById('paintBtn').addEventListener('click', togglePaintMode);
elements.nextRoundBtn.addEventListener('click', nextRound);
elements.probChartBtn.addEventListener('click', openProbabilityChart);
elements.stopGameBtn.addEventListener('click', stopGame);
elements.logBtn.addEventListener('click', openActionLog);
elements.chatBtn.addEventListener('click', openChatModal);
elements.minimizeLogBtn.addEventListener('click', toggleSidebar);
elements.expandLogBtn.addEventListener('click', toggleSidebar);
elements.closeProbModal.addEventListener('click', closeProbabilityChart);
elements.probModal.addEventListener('click', (e) => { if (e.target === elements.probModal) closeProbabilityChart(); });
elements.closeLogModal.addEventListener('click', closeActionLog);
elements.logModal.addEventListener('click', (e) => { if (e.target === elements.logModal) closeActionLog(); });
elements.closeChatModal.addEventListener('click', closeChatModal);
elements.chatModal.addEventListener('click', (e) => { if (e.target === elements.chatModal) closeChatModal(); });
elements.howToPlayBtn.addEventListener('click', () => elements.howToPlayModal.classList.remove('hidden'));
document.getElementById('gameHowToPlayBtn').addEventListener('click', () => elements.howToPlayModal.classList.remove('hidden'));
document.getElementById('lobbyHowToPlayBtn').addEventListener('click', () => elements.howToPlayModal.classList.remove('hidden'));
elements.closeHowToPlayModal.addEventListener('click', () => elements.howToPlayModal.classList.add('hidden'));
elements.howToPlayModal.addEventListener('click', (e) => { if (e.target === elements.howToPlayModal) elements.howToPlayModal.classList.add('hidden'); });
elements.modalChatSendBtn.addEventListener('click', sendModalChatMessage);
elements.modalChatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendModalChatMessage(); });
document.querySelectorAll('.modal-chat-emoji').forEach(btn => btn.addEventListener('click', () => sendModalQuickEmoji(btn.dataset.emoji)));
document.querySelectorAll('.prob-tab').forEach(tab => tab.addEventListener('click', () => switchProbTab(tab.dataset.tab)));
document.querySelectorAll('.dice-btn').forEach(btn => btn.addEventListener('click', () => selectDiceValue(parseInt(btn.dataset.value))));
elements.playAgainBtn.addEventListener('click', playAgain);

elements.betCount.addEventListener('input', () => {
  let value = parseInt(elements.betCount.value);
  if (isNaN(value) || value < 1) elements.betCount.value = 1;
  else if (gameState && value > gameState.totalDice) elements.betCount.value = gameState.totalDice;
});

// ============================================
// Action Cue (visual feedback on actions)
// ============================================

// Different settings per action for testing - adjust to find the sweet spot
const ACTION_CUE_CONFIG = {
  bet:    { emoji: '⬆️', fontSize: '160px', holdMs: 500, fadeMs: 1000 },
  paint:  { emoji: '🎨', fontSize: '160px', holdMs: 500, fadeMs: 1000 },
  doubt:  { emoji: '🤔', fontSize: '160px', holdMs: 500, fadeMs: 1000 },
  calzo:  { emoji: '🎯', fontSize: '160px', holdMs: 500, fadeMs: 1000 }
};

let lastActionCueId = null; // Track which action we last showed

function showActionCue(type) {
  const config = ACTION_CUE_CONFIG[type];
  if (!config) return;

  const cue = document.getElementById('actionCue');
  
  // Reset any in-progress animation
  cue.classList.remove('fading');
  cue.classList.add('hidden');
  
  // Force reflow so transitions reset
  void cue.offsetWidth;
  
  // Set per-type CSS variables
  cue.style.setProperty('--cue-size', config.fontSize);
  cue.style.setProperty('--cue-fade', config.fadeMs + 'ms');
  
  // Set emoji content
  cue.innerHTML = `<span class="cue-emoji">${config.emoji}</span>`;
  
  // Show
  cue.classList.remove('hidden');
  
  // Hold, then fade
  setTimeout(() => {
    cue.classList.add('fading');
    // After fade completes, hide
    setTimeout(() => {
      cue.classList.add('hidden');
      cue.classList.remove('fading');
    }, config.fadeMs);
  }, config.holdMs);
}

function detectAndShowActionCue(state) {
  const action = state.lastAction;
  if (!action) return;
  
  // Build a unique ID for this action so we don't repeat
  const actionId = JSON.stringify(action);
  if (actionId === lastActionCueId) return;
  lastActionCueId = actionId;
  
  // Skip cue animations for bot actions (they fire too fast and look glitchy)
  const actorName = action.player || action.doubter || action.caller || '';
  const actorIsBot = (state.players || []).some(p => p.name === actorName && p.isBot);
  if (actorIsBot) return;
  
  if (action.type === 'bet') {
    if (action.painted && action.painted.length > 0) {
      showActionCue('paint');
    } else {
      showActionCue('bet');
    }
  } else if (action.type === 'doubt') {
    showActionCue('doubt');
  } else if (action.type === 'calzo') {
    showActionCue('calzo');
  }
}

// ============================================
// Chat
// ============================================

let chatMinimized = false;

function toggleChat() {
  chatMinimized = !chatMinimized;
  if (chatMinimized) {
    elements.chatSidebar.classList.add('minimized');
    elements.expandChatBtn.classList.add('visible');
  } else {
    elements.chatSidebar.classList.remove('minimized');
    elements.expandChatBtn.classList.remove('visible');
  }
}

function sendChatMessage() {
  const text = elements.chatInput.value.trim();
  if (!text) return;
  socket.emit('chatMessage', { text });
  elements.chatInput.value = '';
}

function sendQuickEmoji(emoji) {
  socket.emit('chatMessage', { text: emoji });
}

function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function createChatMessageElement(message) {
  const div = document.createElement('div');
  div.className = 'chat-message';
  
  const isEmojiOnly = /^[\p{Emoji}\s]+$/u.test(message.text) && message.text.length <= 4;
  if (isEmojiOnly) div.classList.add('emoji-only');
  
  const senderLabel = message.isSpectator 
    ? `${message.emoji || '👁️'} ${message.sender} <span class="chat-spectator-tag">- Spectator</span>`
    : `${message.emoji || '🎲'} ${message.sender}`;
  
  const timeStr = formatTimestamp(message.timestamp);
  
  div.innerHTML = `
    <div class="chat-sender">${senderLabel} <span class="chat-time">${timeStr}</span></div>
    <div class="chat-text">${escapeHtml(message.text)}</div>
  `;
  return div;
}

function appendToContainer(container, message) {
  if (!container) return;
  container.appendChild(createChatMessageElement(message));
  container.scrollTop = container.scrollHeight;
}

function renderChatHistory(container) {
  if (!container) return;
  container.innerHTML = '';
  chatHistory.forEach(msg => container.appendChild(createChatMessageElement(msg)));
  container.scrollTop = container.scrollHeight;
}

function appendChatMessage(message) {
  chatHistory.push(message);
  appendToContainer(elements.lobbyChatMessages, message);
  appendToContainer(elements.chatMessages, message);
  appendToContainer(elements.modalChatMessages, message);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Chat event listeners
elements.minimizeChatBtn.addEventListener('click', toggleChat);
elements.expandChatBtn.addEventListener('click', toggleChat);
elements.chatSendBtn.addEventListener('click', sendChatMessage);
elements.chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(); });

elements.lobbyChatSendBtn.addEventListener('click', () => {
  const text = elements.lobbyChatInput.value.trim();
  if (!text) return;
  socket.emit('chatMessage', { text });
  elements.lobbyChatInput.value = '';
});
elements.lobbyChatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const text = elements.lobbyChatInput.value.trim();
    if (!text) return;
    socket.emit('chatMessage', { text });
    elements.lobbyChatInput.value = '';
  }
});

document.querySelectorAll('.chat-emoji-btn:not(.modal-chat-emoji):not(.lobby-chat-emoji)').forEach(btn => {
  btn.addEventListener('click', () => sendQuickEmoji(btn.dataset.emoji));
});
document.querySelectorAll('.lobby-chat-emoji').forEach(btn => {
  btn.addEventListener('click', () => sendQuickEmoji(btn.dataset.emoji));
});

// Keep-alive ping to prevent Render free tier from sleeping (every 5 min)
setInterval(() => {
  fetch('/api/ping').catch(() => {});
}, 5 * 60 * 1000);

// Initialize
showScreen('join');
elements.playerName.focus();
window.adjustBetCount = adjustBetCount;
