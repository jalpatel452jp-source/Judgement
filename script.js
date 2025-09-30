document.addEventListener('DOMContentLoaded', () => {

    // ======== STATE MANAGEMENT ========
    let gameState = {
        players: [], // { name: string, score: number }
        rounds: [], // { color, toPlay, cards, assumed: {}, scores: {}, isComplete: bool }
        config: { numRounds: 0, gameType: 'complete', multiplier: 10, maxCardsPerPlayer: 0 },
        currentRoundIndex: 0,
        gamePhase: 'landing', // landing, setup, playing, finished
    };
    
    let tempAssumeState = {
        roundIndex: -1,
        playerSequence: [],
        assumedHands: {},
        currentIndex: 0,
    };
    
    let isDeleteMode = false;
    let roundsToRemove = new Set();

    // ======== DOM ELEMENT SELECTORS ========
    const pages = { landing: document.getElementById('landing-page'), scoring: document.getElementById('scoring-page'), winner: document.getElementById('winner-page') };
    const modals = { setup: document.getElementById('setup-modal'), assume: document.getElementById('assume-modal'), score: document.getElementById('score-modal'), addRound: document.getElementById('add-round-modal')};
    const ctaPlayBtn = document.getElementById('cta-play');
    const finishGameBtn = document.getElementById('finish-game-btn');
    const newGameBtn = document.getElementById('new-game-btn');

    // Setup Modal
    const setupStep1 = document.getElementById('setup-step-1'), setupStep2 = document.getElementById('setup-step-2');
    const playerInputsContainer = document.getElementById('player-inputs-container');
    const addPlayerBtn = document.getElementById('add-player-btn'), savePlayersBtn = document.getElementById('save-players-btn');
    const numRoundsInput = document.getElementById('num-rounds'), maxRoundsInfo = document.getElementById('max-rounds-info');
    const multiplierInput = document.getElementById('multiplier'), startGameBtn = document.getElementById('start-game-btn');

    // Assume Modal
    const assumeModalTitle = document.getElementById('assume-modal-title'), assumeContextInfo = document.getElementById('assume-context-info');
    const assumeRestrictionText = document.getElementById('assume-restriction-text'), assumeInput = document.getElementById('assume-input');
    const assumeNextBtn = document.getElementById('assume-next-btn'), assumeUndoBtn = document.getElementById('assume-undo-btn');

    // Score Modal
    const scoreEntryContainer = document.getElementById('score-entry-container'), saveScoresBtn = document.getElementById('save-scores-btn');
    
    // Scoring Page Controls
    const scorecardContainer = document.getElementById('scorecard-container'), toggleTotals = document.getElementById('toggle-totals');
    const addRoundBtn = document.getElementById('add-round-btn'), removeRoundBtn = document.getElementById('remove-round-btn');
    const defaultControls = document.getElementById('default-controls'), deleteModeControls = document.getElementById('delete-mode-controls');
    const saveChangesBtn = document.getElementById('save-changes-btn'), discardChangesBtn = document.getElementById('discard-changes-btn');
    
    // Add Round Modal
    const addRoundColorSelect = document.getElementById('add-round-color'), addRoundToPlaySelect = document.getElementById('add-round-to-play');
    const addRoundCardsInput = document.getElementById('add-round-cards'), saveNewRoundBtn = document.getElementById('save-new-round-btn');
    const cancelAddRoundBtn = document.getElementById('cancel-add-round-btn');


    // ======== CORE & UTILITY FUNCTIONS ========
    const showPage = (pageName) => {
        Object.values(pages).forEach(page => page.classList.remove('active'));
        pages[pageName].classList.add('active');
    };
    const toggleModal = (modalName, show) => modals[modalName].classList.toggle('active', show);
    const shuffleArray = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    };

    function resetGame() {
        gameState = {
            players: [], rounds: [],
            config: { numRounds: 0, gameType: 'complete', multiplier: 10, maxCardsPerPlayer: 0 },
            currentRoundIndex: 0, gamePhase: 'landing',
        };
        isDeleteMode = false;
        roundsToRemove.clear();
        scorecardContainer.innerHTML = '';
        playerInputsContainer.innerHTML = `<input type="text" placeholder="Player 1 Name" class="player-input"><input type="text" placeholder="Player 2 Name" class="player-input"><input type="text" placeholder="Player 3 Name" class="player-input">`;
        document.getElementById('setup-step-1').classList.remove('hidden');
        document.getElementById('setup-step-2').classList.add('hidden');
        addPlayerBtn.disabled = true;
        showPage('landing');
    }

    // ======== SETUP LOGIC ========
    function handlePlayerInputChange() {
        const inputs = [...playerInputsContainer.querySelectorAll('.player-input')];
        addPlayerBtn.disabled = !inputs.every(input => input.value.trim() !== '');
    }

    function handleAddPlayer() {
        if (playerInputsContainer.children.length >= 52) return;
        const newInput = document.createElement('input');
        newInput.type = 'text';
        newInput.placeholder = `Player ${playerInputsContainer.children.length + 1} Name`;
        newInput.className = 'player-input';
        playerInputsContainer.appendChild(newInput);
        newInput.focus();
        handlePlayerInputChange();
    }

    function handleSavePlayers() {
        const playerNames = [...playerInputsContainer.querySelectorAll('.player-input')].map(input => input.value.trim()).filter(Boolean);
        if (playerNames.length < 3) { alert('You need at least 3 players.'); return; }
        gameState.players = playerNames.map(name => ({ name, score: 0 }));
        shuffleArray(gameState.players);
        const maxRounds = Math.floor(52 / gameState.players.length);
        gameState.config.maxCardsPerPlayer = maxRounds;
        numRoundsInput.value = maxRounds;
        numRoundsInput.max = maxRounds;
        maxRoundsInfo.textContent = `Max for ${gameState.players.length} players is ${maxRounds}.`;
        document.getElementById('setup-step-1').classList.add('hidden');
        document.getElementById('setup-step-2').classList.remove('hidden');
    }

    function handleStartGame() {
        const numRounds = parseInt(numRoundsInput.value);
        if (isNaN(numRounds) || numRounds <= 0 || numRounds > gameState.config.maxCardsPerPlayer) {
            alert(`Please enter a valid number of rounds between 1 and ${gameState.config.maxCardsPerPlayer}.`); return;
        }
        gameState.config.numRounds = numRounds;
        gameState.config.gameType = document.querySelector('input[name="game-type"]:checked').value;
        gameState.config.multiplier = parseInt(multiplierInput.value) || 10;
        generateRounds();
        gameState.gamePhase = 'playing';
        toggleModal('setup', false);
        renderScorecard();
        showPage('scoring');
    }
    
    function generateRounds() {
        const { numRounds, gameType } = gameState.config;
        let roundSequence = [];
        for (let i = 1; i <= numRounds; i++) roundSequence.push(i);
        if (gameType === 'complete') {
            for (let i = numRounds; i >= 1; i--) roundSequence.push(i);
        }
        gameState.rounds = roundSequence.map((cards, index) => createRoundObject(cards, index));
    }
    
    function createRoundObject(cards, index) {
        const colors = ['Spades', 'Diamonds', 'Clubs', 'Hearts'];
        return {
            color: colors[index % 4],
            toPlay: gameState.players[index % gameState.players.length].name,
            cards, assumed: {}, scores: {}, isComplete: false,
        };
    }

    // ======== RENDERING LOGIC ========
    function renderScorecard() {
        const table = document.createElement('table');
        table.className = 'scorecard-table';
        const colorMap = { 'Spades': 'Kadi/Spades', 'Diamonds': 'Charkat/Diamonds', 'Clubs': 'Falai/Clubs', 'Hearts': 'Laal/Hearts' };
        
        // Header
        const thead = table.createTHead();
        const headerRow = thead.insertRow();
        const headers = ['Color', 'To Play', 'Cards', ...gameState.players.map(p => p.name), 'Total Assumed', 'Action'];
        headers.forEach(text => { headerRow.insertCell().textContent = text; });

        // Body
        const tbody = table.createTBody();
        gameState.rounds.forEach((round, roundIndex) => {
            const row = tbody.insertRow();
            row.className = roundIndex === gameState.currentRoundIndex ? 'active-round' : '';
            if (roundsToRemove.has(roundIndex)) row.classList.add('marked-for-removal');

            row.insertCell().textContent = colorMap[round.color] || round.color;
            row.insertCell().textContent = round.toPlay;
            const cardsCell = row.insertCell();
            cardsCell.textContent = round.cards;
            if (isDeleteMode) {
                const removeIcon = document.createElement('span');
                removeIcon.className = 'remove-round-icon';
                removeIcon.textContent = '⊖';
                removeIcon.onclick = () => toggleRoundForRemoval(roundIndex);
                cardsCell.appendChild(removeIcon);
            }

            let totalAssumed = 0;
            gameState.players.forEach(player => {
                const cell = row.insertCell();
                if (round.isComplete) {
                    cell.textContent = round.scores[player.name];
                } else if (Object.keys(round.assumed).length === gameState.players.length) {
                    cell.textContent = `(${round.assumed[player.name]})`;
                } else { cell.textContent = '-'; }
                if (round.assumed[player.name] !== undefined) totalAssumed += round.assumed[player.name];
            });
            
            row.insertCell().textContent = Object.keys(round.assumed).length === gameState.players.length ? totalAssumed : '-';
            const actionCell = row.insertCell();
            const isRoundActive = roundIndex === gameState.currentRoundIndex;
            if (isRoundActive && !round.isComplete) {
                const allAssumed = Object.keys(round.assumed).length === gameState.players.length;
                const actionBtn = document.createElement('button');
                actionBtn.className = 'btn';
                if (allAssumed) {
                    actionBtn.textContent = 'Add Score';
                    actionBtn.onclick = () => openScoreModal(roundIndex);
                } else {
                    actionBtn.textContent = 'Enter Assumed';
                    actionBtn.onclick = () => startAssumeProcess(roundIndex);
                }
                actionCell.appendChild(actionBtn);
            }
        });
        
        // Footer (Totals)
        const tfoot = table.createTFoot();
        tfoot.id = 'totals-row';
        const footerRow = tfoot.insertRow();
        footerRow.insertCell().colSpan = 3;
        footerRow.cells[0].textContent = 'TOTAL SCORE';
        gameState.players.forEach(player => footerRow.insertCell().textContent = player.score);
        footerRow.insertCell().colSpan = 2;
        
        scorecardContainer.innerHTML = '';
        scorecardContainer.appendChild(table);
        tfoot.style.display = toggleTotals.checked ? '' : 'none';
    }
    
    // ======== GAMEPLAY LOGIC (ASSUME & SCORE) ========
    function startAssumeProcess(roundIndex) {
        const round = gameState.rounds[roundIndex];
        const startingPlayer = gameState.players.find(p => p.name === round.toPlay);
        const startIndex = gameState.players.indexOf(startingPlayer);
        const sequence = Array.from({ length: gameState.players.length }, (_, i) => gameState.players[(startIndex + i) % gameState.players.length]);
        
        tempAssumeState = { roundIndex, playerSequence: sequence, assumedHands: {}, currentIndex: 0, };
        promptNextAssume();
    }

    function promptNextAssume() {
        const { currentIndex, playerSequence, assumedHands, roundIndex } = tempAssumeState;
        const round = gameState.rounds[roundIndex];
        const currentPlayer = playerSequence[currentIndex];
        
        assumeModalTitle.textContent = `Enter hands for ${currentPlayer.name}`;
        assumeInput.value = '';
        assumeInput.max = round.cards;
        assumeUndoBtn.disabled = currentIndex === 0;

        // Display context of previous assumptions
        const contextEntries = Object.entries(assumedHands);
        if (contextEntries.length > 0) {
            assumeContextInfo.textContent = `So far: ${contextEntries.map(([name, hands]) => `${name} (${hands})`).join(', ')}`;
        } else {
            assumeContextInfo.textContent = 'You are the first to assume.';
        }

        // Check for restriction on the last player
        if (currentIndex === playerSequence.length - 1) {
            const sumOfOthers = Object.values(assumedHands).reduce((a, b) => a + b, 0);
            const restrictedNumber = round.cards - sumOfOthers;
            if (restrictedNumber >= 0) {
                assumeRestrictionText.textContent = `You cannot assume ${restrictedNumber}.`;
                tempAssumeState.restrictedNumber = restrictedNumber;
            }
        } else {
             assumeRestrictionText.textContent = '';
             tempAssumeState.restrictedNumber = -1;
        }
        
        toggleModal('assume', true);
        assumeInput.focus();
    }

    function handleAssumeNext() {
        const { currentIndex, playerSequence, roundIndex, restrictedNumber } = tempAssumeState;
        const round = gameState.rounds[roundIndex];
        const currentPlayer = playerSequence[currentIndex];
        const assumedValue = parseInt(assumeInput.value);

        if (isNaN(assumedValue) || assumedValue < 0 || assumedValue > round.cards) { alert(`Enter a number between 0 and ${round.cards}.`); return; }
        if (assumedValue === restrictedNumber) { alert(`You cannot assume the restricted number: ${restrictedNumber}.`); return; }

        tempAssumeState.assumedHands[currentPlayer.name] = assumedValue;

        if (currentIndex < playerSequence.length - 1) {
            tempAssumeState.currentIndex++;
            promptNextAssume();
        } else {
            gameState.rounds[roundIndex].assumed = tempAssumeState.assumedHands;
            toggleModal('assume', false);
            renderScorecard();
        }
    }
    
    function handleAssumeUndo() {
        if(tempAssumeState.currentIndex > 0) {
            tempAssumeState.currentIndex--;
            const prevPlayerName = tempAssumeState.playerSequence[tempAssumeState.currentIndex].name;
            delete tempAssumeState.assumedHands[prevPlayerName];
            promptNextAssume();
        }
    }

    function openScoreModal(roundIndex) {
        scoreEntryContainer.innerHTML = '';
        gameState.players.forEach(player => {
            const assumed = gameState.rounds[roundIndex].assumed[player.name];
            const entryDiv = document.createElement('div');
            entryDiv.className = 'player-score-entry';
            entryDiv.innerHTML = `<span>${player.name} (${assumed})</span><div class="score-buttons" data-player-name="${player.name}"><button class="btn successful">Successful</button><button class="btn unsuccessful">Unsuccessful</button></div>`;
            scoreEntryContainer.appendChild(entryDiv);
        });
        
        scoreEntryContainer.querySelectorAll('.score-buttons button').forEach(button => {
            button.onclick = (e) => {
                e.target.parentElement.querySelectorAll('button').forEach(btn => btn.classList.remove('selected'));
                e.target.classList.add('selected');
            };
        });
        saveScoresBtn.dataset.roundIndex = roundIndex;
        toggleModal('score', true);
    }
    
    function handleSaveScores() {
        const roundIndex = parseInt(saveScoresBtn.dataset.roundIndex);
        const round = gameState.rounds[roundIndex];
        let allSelected = true;

        scoreEntryContainer.querySelectorAll('.score-buttons').forEach(sel => {
            const playerName = sel.dataset.playerName;
            const selectedBtn = sel.querySelector('button.selected');
            if (!selectedBtn) { allSelected = false; return; }
            const isSuccessful = selectedBtn.classList.contains('successful');
            const assumed = round.assumed[playerName];
            let points = isSuccessful ? (assumed === 0 ? 10 : assumed * gameState.config.multiplier) : 0;
            round.scores[playerName] = points;
            gameState.players.find(p => p.name === playerName).score += points;
        });

        if (!allSelected) { alert('Please select a result for every player.'); return; }
        round.isComplete = true;
        gameState.currentRoundIndex++;
        toggleModal('score', false);
        renderScorecard();

        if (gameState.currentRoundIndex >= gameState.rounds.length) handleFinishGame(false);
    }
    
    function handleFinishGame(prompt = true) {
        if (prompt && !confirm('Are you sure you want to finish the game?')) return;
        gameState.gamePhase = 'finished';
        gameState.players.sort((a, b) => b.score - a.score);
        renderWinnerPage();
        renderScorecard();
        showPage('winner');
    }

    function renderWinnerPage() {
        const podiumContainer = document.getElementById('podium-container');
        podiumContainer.innerHTML = '';
        const places = ['2nd', '1st', '3rd'];
        const top3 = [gameState.players[1], gameState.players[0], gameState.players[2]];
        top3.forEach((player, index) => {
            if (!player) return;
            const placeDiv = document.createElement('div');
            placeDiv.className = `podium-place podium-${places[index]}`;
            placeDiv.innerHTML = `<h3>${player.name}</h3><p>${player.score} pts</p><h2>${places[index].toUpperCase()}</h2>`;
            podiumContainer.appendChild(placeDiv);
        });
    }

    // ======== ADD/REMOVE ROUND LOGIC ========
    function handleAddRound() {
        addRoundToPlaySelect.innerHTML = gameState.players.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
        addRoundCardsInput.max = gameState.config.maxCardsPerPlayer;
        addRoundCardsInput.value = 1;
        toggleModal('addRound', true);
    }

    function handleSaveNewRound() {
        const color = addRoundColorSelect.value;
        const toPlay = addRoundToPlaySelect.value;
        const cards = parseInt(addRoundCardsInput.value);
        if (isNaN(cards) || cards <= 0 || cards > gameState.config.maxCardsPerPlayer) {
            alert(`Invalid number of cards. Must be between 1 and ${gameState.config.maxCardsPerPlayer}.`); return;
        }
        const newRound = { color, toPlay, cards, assumed: {}, scores: {}, isComplete: false };
        gameState.rounds.push(newRound);
        toggleModal('addRound', false);
        renderScorecard();
    }
    
    function handleRemoveRound() {
        isDeleteMode = true;
        defaultControls.classList.add('hidden');
        deleteModeControls.classList.remove('hidden');
        renderScorecard();
    }

    function toggleRoundForRemoval(roundIndex) {
        if (roundsToRemove.has(roundIndex)) {
            roundsToRemove.delete(roundIndex);
        } else {
            roundsToRemove.add(roundIndex);
        }
        renderScorecard();
    }

    function handleSaveChanges() {
        const sortedIndices = Array.from(roundsToRemove).sort((a, b) => b - a);
        sortedIndices.forEach(index => gameState.rounds.splice(index, 1));
        // Recalculate color and toPlay for all rounds based on new index
        gameState.rounds.forEach((round, index) => {
            const newValues = createRoundObject(round.cards, index);
            round.color = newValues.color;
            round.toPlay = newValues.toPlay;
        });
        handleDiscardChanges(); // Resets mode and re-renders
    }

    function handleDiscardChanges() {
        isDeleteMode = false;
        roundsToRemove.clear();
        defaultControls.classList.remove('hidden');
        deleteModeControls.classList.add('hidden');
        renderScorecard();
    }

    // ======== EVENT LISTENERS ========
    ctaPlayBtn.addEventListener('click', () => { showPage('scoring'); toggleModal('setup', true); });
    playerInputsContainer.addEventListener('keyup', handlePlayerInputChange);
    addPlayerBtn.addEventListener('click', handleAddPlayer);
    savePlayersBtn.addEventListener('click', handleSavePlayers);
    startGameBtn.addEventListener('click', handleStartGame);
    assumeNextBtn.addEventListener('click', handleAssumeNext);
    assumeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') assumeNextBtn.click(); });
    assumeUndoBtn.addEventListener('click', handleAssumeUndo);
    saveScoresBtn.addEventListener('click', handleSaveScores);
    finishGameBtn.addEventListener('click', () => handleFinishGame(true));
    newGameBtn.addEventListener('click', resetGame);
    toggleTotals.addEventListener('change', () => document.getElementById('totals-row').style.display = toggleTotals.checked ? '' : 'none');
    addRoundBtn.addEventListener('click', handleAddRound);
    removeRoundBtn.addEventListener('click', handleRemoveRound);
    saveChangesBtn.addEventListener('click', handleSaveChanges);
    discardChangesBtn.addEventListener('click', handleDiscardChanges);
    saveNewRoundBtn.addEventListener('click', handleSaveNewRound);
    cancelAddRoundBtn.addEventListener('click', () => toggleModal('addRound', false));

    // ======== INITIALIZATION ========
    resetGame();
});

