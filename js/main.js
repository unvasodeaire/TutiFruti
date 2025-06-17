// js/main.js (Versión Corregida)

import { db, auth } from './firebase.js';
import { 
    signInAnonymously, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    doc, setDoc, getDoc, updateDoc, onSnapshot, 
    collection, addDoc, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

    // --- REFERENCIAS AL DOM ---
    const generateCategoriesBtn = document.getElementById('generate-categories-btn');
    const generateLoader = document.getElementById('generate-loader');
    const initialActions = document.getElementById('initial-actions');
    const detailsEntryScreen = document.getElementById('details-entry-screen');
    const goToCreateBtn = document.getElementById('go-to-create-btn');
    const goToJoinBtn = document.getElementById('go-to-join-btn');
    const detailsTitle = document.getElementById('details-title');
    const playerNameInput = document.getElementById('player-name-input');
    const gameCodeInputContainer = document.getElementById('game-code-input-container');
    const gameCodeInput = document.getElementById('game-code-input');
    const createOptionsContainer = document.getElementById('create-options-container');
    const targetScoreInput = document.getElementById('target-score-input');
    const bastaBonusInput = document.getElementById('basta-bonus-input');
    const backToStartBtn = document.getElementById('back-to-start-btn');
    const confirmActionBtn = document.getElementById('confirm-action-btn');
    const confirmActionText = document.getElementById('confirm-action-text');
    const actionLoader = document.getElementById('action-loader');
    const lobbyTargetScore = document.getElementById('lobby-target-score');
    const lobbyBastaBonus = document.getElementById('lobby-basta-bonus');
    const copyGameIdBtn = document.getElementById('copy-game-id');
    const startGameBtn = document.getElementById('start-game-btn');
    const gameIdDisplay = document.getElementById('game-id-display');
    const playerList = document.getElementById('player-list');
    const waitingForHostMsg = document.getElementById('waiting-for-host-msg');
    const categoryEditorContainer = document.getElementById('category-editor-container');
    const categoryList = document.getElementById('category-list');
    const addCategoryForm = document.getElementById('add-category-form');
    const newCategoryInput = document.getElementById('new-category-input');
    const chatMessages = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const roundTitle = document.getElementById('round-title');
    const letterDisplay = document.getElementById('letter-display');
    const totalScoreDisplay = document.getElementById('total-score');
    const gameForm = document.getElementById('game-form');
    const bastaBtn = document.getElementById('basta-btn');
    const resultsTitle = document.getElementById('results-title');
    const resultsDisplay = document.getElementById('results-display');
    const roundScoreDisplay = document.getElementById('round-score');
    const resultsButtons = document.getElementById('results-buttons');
    const verifyAnswersBtn = document.getElementById('verify-answers-btn');
    const confirmScoresBtn = document.getElementById('confirm-scores-btn');
    const nextRoundBtn = document.getElementById('next-round-btn');
    const verifyLoader = document.getElementById('verify-loader');
    const winnerScreen = document.getElementById('winner-screen');
    const winnerName = document.getElementById('winner-name');
    const finalScoresList = document.getElementById('final-scores-list');
    const playAgainBtn = document.getElementById('play-again-btn');
    const errorModal = document.getElementById('error-modal');
    const errorMessage = document.getElementById('error-message');
    const closeErrorModalBtn = document.getElementById('close-error-modal');
    const authLoader = document.getElementById('auth-loader');



    // ... (después de las declaraciones de 'const')

const homeBtn = document.getElementById('home-btn');
homeBtn.addEventListener('click', () => {
    // Preguntamos al usuario si está seguro para no sacarlo de una partida por accidente
    if (confirm('¿Seguro que quieres volver al menú principal? Se perderá el progreso de la partida actual.')) {
        window.location.reload();
    }
}); 

    // --- LÓGICA PARA EFECTOS ---
    letterDisplay.addEventListener('animationend', () => {
        letterDisplay.classList.remove('pulse');
    });


// --- ESTADO DEL JUEGO LOCAL Y CONFIGURACIÓN ---
let currentUser = null;
let currentGameId = null;
let unsubscribeFromGame = null;
let unsubscribeFromChat = null;
let localPlayerIsHost = false;
let currentAction = null; 
let debouncedSave = null;
let localRoundNumber = 0;
let localPlayerName = '';

const letters = 'ABCDEFGHIJLMNOPQRSTUV';
let defaultCategories = [
    { id: 'nombre', label: 'Nombre' },
    { id: 'apellido', label: 'Apellido' },
    { id: 'ciudad_o_pais', label: 'Ciudad o País' },
    { id: 'color', label: 'Color' },
    { id: 'fruta_o_verdura', label: 'Fruta o Verdura' },
    { id: 'animal', label: 'Animal' }
];

// --- MANEJO DE ERRORES ---
function showFirebaseError(error) {
    console.error("Firebase Error:", error.code, error.message);
    let userMessage = `Ocurrió un error inesperado:\n${error.message}`;
    if (error.code === 'permission-denied') { userMessage = `Error de Permisos...`; }
    errorMessage.textContent = userMessage;
    errorModal.classList.remove('hidden');
}
closeErrorModalBtn.addEventListener('click', () => errorModal.classList.add('hidden'));

// js/main.js

// --- AUTENTICACIÓN E INICIO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        authLoader.classList.add('hidden');
        goToCreateBtn.disabled = false;
        goToJoinBtn.disabled = false;
        showScreen('start-screen');

    } else {
        try { await signInAnonymously(auth); } catch (error) {
            authLoader.textContent = "Error de autenticación.";
            showFirebaseError(error);
        }
    }
});

// --- NAVEGACIÓN EN PANTALLA DE INICIO ---
goToCreateBtn.addEventListener('click', () => {
    currentAction = 'create';
    initialActions.classList.add('hidden');
    detailsEntryScreen.classList.remove('hidden');
    detailsTitle.textContent = "Crear Nueva Partida";
    createOptionsContainer.classList.remove('hidden');
    gameCodeInputContainer.classList.add('hidden');
    confirmActionBtn.dataset.action = 'create';
    confirmActionText.textContent = "Crear y Entrar";
});

goToJoinBtn.addEventListener('click', () => {
    currentAction = 'join';
    initialActions.classList.add('hidden');
    detailsEntryScreen.classList.remove('hidden');
    detailsTitle.textContent = "Unirse a una Partida";
    createOptionsContainer.classList.add('hidden');
    gameCodeInputContainer.classList.remove('hidden');
    confirmActionBtn.dataset.action = 'join';
    confirmActionText.textContent = "Buscar y Unirse";
});

backToStartBtn.addEventListener('click', () => {
    initialActions.classList.remove('hidden');
    detailsEntryScreen.classList.add('hidden');
    currentAction = null;
});

// --- LÓGICA DEL JUEGO MULTIJUGADOR ---
confirmActionBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    localPlayerName = playerNameInput.value.trim();
    if (!localPlayerName) { alert("Por favor, ingresa tu nombre."); return; }
    actionLoader.classList.remove('hidden');
    confirmActionBtn.disabled = true;
    if (currentAction === 'create') {
        const targetScore = parseInt(targetScoreInput.value, 10);
        const bastaBonus = parseInt(bastaBonusInput.value, 10);
        if (isNaN(targetScore) || targetScore <= 0 || isNaN(bastaBonus) || bastaBonus < 0) {
            alert("El puntaje y el bonus deben ser números válidos.");
        } else {
            await createGame(localPlayerName, targetScore, bastaBonus);
        }
    } else if (currentAction === 'join') {
        const gameId = gameCodeInput.value.trim().toUpperCase();
        if (!gameId) { alert("Por favor, ingresa el código de la partida."); } 
        else { await joinGame(localPlayerName, gameId); }
    }
    actionLoader.classList.add('hidden');
    confirmActionBtn.disabled = false;
});


async function createGame(playerName, targetScore, bastaBonus) {
    try {
        const gameId = `JUEGO-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        currentGameId = gameId;
        const player = { id: currentUser.uid, name: playerName, score: 0 };

        // Leemos el modo de juego seleccionado
        const selectedMode = document.querySelector('input[name="game-mode"]:checked').value;

        // Si el modo es 'classic', usamos las categorías por defecto.
        // Si es 'ai_collaborative', la lista de categorías empieza vacía.
        const initialCategories = selectedMode === 'classic' ? defaultCategories : [];

        const gameData = {
            status: 'waiting', 
            hostId: currentUser.uid, 
            players: [player],
            categories: initialCategories, // <-- Usamos la lista de categorías correcta
            currentRound: 0, 
            lastScoredRound: 0, 
            responses: {},
            targetScore: targetScore, 
            bastaBonus: bastaBonus, 
            winner: null, 
            usedLetters: [],
            gameMode: selectedMode, // <-- Guardamos el modo de juego
            themeChooserIndex: 0, // <-- Inicializamos el índice del turno para el modo IA
            preselectedLetter: null
        };

        await setDoc(doc(db, "games", gameId), gameData);
        listenToGameChanges(gameId);
        listenToChat(gameId);
    } catch (error) { showFirebaseError(error); }
}

async function joinGame(playerName, gameId) {
     try {
        const gameRef = doc(db, "games", gameId);
        const gameDoc = await getDoc(gameRef);
        if (gameDoc.exists() && gameDoc.data().status === 'waiting' && gameDoc.data().players.length < 10) {
            currentGameId = gameId;
            const player = { id: currentUser.uid, name: playerName, score: 0 };
            const players = [...gameDoc.data().players.filter(p => p.id !== currentUser.uid), player];
            await updateDoc(gameRef, { players });
            listenToGameChanges(gameId);
            listenToChat(gameId);
        } else { alert("Partida no encontrada, llena, o ya ha comenzado."); }
    } catch (error) { showFirebaseError(error); }
}

function listenToGameChanges(gameId) {
    if (unsubscribeFromGame) unsubscribeFromGame();
    unsubscribeFromGame = onSnapshot(doc(db, "games", gameId), (doc) => {
        const gameData = doc.data();
        if (!gameData) {
            alert("La partida ha terminado o fue eliminada.");
            showScreen('start-screen');
            if(unsubscribeFromGame) unsubscribeFromGame();
            return;
        };
        localPlayerIsHost = currentUser.uid === gameData.hostId;
        let usedLetters = gameData.usedLetters || [];

        switch(gameData.status) {
            case 'waiting':
                showScreen('lobby-screen');
                updateLobbyUI(gameData);
                localRoundNumber = 0;
                break;
            case 'playing':
                showScreen('main-game-screen');
                roundTitle.textContent = `Ronda ${gameData.currentRound}`;
                letterDisplay.textContent = gameData.currentLetter;

                letterDisplay.classList.add('pulse');

                bastaBtn.disabled = false;
                if (gameData.currentRound > localRoundNumber) {
                    localRoundNumber = gameData.currentRound;
                    buildForm(gameData.categories);
                    if (debouncedSave) gameForm.removeEventListener('input', debouncedSave);
                    debouncedSave = debounce(saveMyAnswers, 500);
                    gameForm.addEventListener('input', debouncedSave);
                }
                break;
                case 'scoring':
                    const resultsAreVerified = gameData.detailedResults && Object.keys(gameData.detailedResults).length > 0;
                    if (resultsAreVerified) {
                        showScreen('results-screen');
                        displayResults(gameData);
                    } else {
                        if (localPlayerIsHost) {
                            showScreen('results-screen');
                            displayResults(gameData);
                        } else {
                            // --- LÓGICA MEJORADA AQUÍ ---
                            // Buscamos el nombre del jugador que dijo "Basta"
                            const bastaPlayer = gameData.players.find(p => p.id === gameData.bastaPlayer);
                            const bastaPlayerNameEl = document.getElementById('basta-player-name');
                            if (bastaPlayer && bastaPlayerNameEl) {
                                bastaPlayerNameEl.textContent = bastaPlayer.name;
                            }
                            showScreen('ai-verifying-screen');
                        }
                    }
                    bastaBtn.disabled = true;
                    if (debouncedSave) gameForm.removeEventListener('input', debouncedSave);
                    break;
                case 'finished':
                showScreen('winner-screen');
                displayWinner(gameData);
                break;
        }
        const myPlayer = gameData.players.find(p => p.id === currentUser.uid);
        if(myPlayer) totalScoreDisplay.textContent = myPlayer.score;
    }, (error) => { showFirebaseError(error); });
}

function getUniqueLetter(lettersUsed) {
    if (lettersUsed.length >= letters.length) lettersUsed = []; // Reset if all letters have been used
    let availableLetters = letters.split('').filter(l => !lettersUsed.includes(l));
    if (availableLetters.length === 0) return letters[Math.floor(Math.random() * letters.length)];
    return availableLetters[Math.floor(Math.random() * availableLetters.length)];
}

// js/main.js

startGameBtn.addEventListener('click', async () => {
    try {
        const gameRef = doc(db, "games", currentGameId);
        const gameDoc = await getDoc(gameRef);
        const gameData = gameDoc.data();
        
        let newLetter = '';
        const currentUsedLetters = gameData.usedLetters || [];

        if (gameData.preselectedLetter) {
            newLetter = gameData.preselectedLetter;
        } else {
            newLetter = getUniqueLetter(currentUsedLetters);
        }
        
        // --- LA CORRECCIÓN ESTÁ AQUÍ ---
        // Incrementamos correctamente el número de la ronda.
        const newRoundNumber = gameData.currentRound + 1;
        
        await updateDoc(gameRef, {
            status: 'playing', 
            currentLetter: newLetter, 
            currentRound: newRoundNumber, // Usamos el nuevo número de ronda
            responses: {}, 
            usedLetters: [...currentUsedLetters, newLetter], 
            detailedResults: {},
            preselectedLetter: null 
        });
     } catch (error) { showFirebaseError(error); }
});

bastaBtn.addEventListener('click', async () => {
    bastaBtn.disabled = true;
    await saveMyAnswers();
    try {
        const gameRef = doc(db, "games", currentGameId);
        const gameDoc = await getDoc(gameRef);
        if (gameDoc.data().status === 'playing') {
             await updateDoc(gameRef, { status: 'scoring', bastaPlayer: currentUser.uid });
        }
    } catch (error) { showFirebaseError(error); }
});

// js/main.js

nextRoundBtn.addEventListener('click', async () => {
    try {
        const gameRef = doc(db, "games", currentGameId);
        const gameDoc = await getDoc(gameRef);
        const gameData = gameDoc.data();

        // Si el modo es clásico, empieza la siguiente ronda al azar inmediatamente.
        if (gameData.gameMode === 'classic') {
            const currentUsedLetters = gameData.usedLetters || [];
            const newLetter = getUniqueLetter(currentUsedLetters);
            
            await updateDoc(gameRef, {
                status: 'playing',
                currentLetter: newLetter,
                currentRound: gameData.currentRound + 1,
                responses: {},
                detailedResults: {},
                usedLetters: [...currentUsedLetters, newLetter]
            });

        } else { // Si el modo es Colaborativo con IA...
            // Calculamos el índice del siguiente jugador en el turno.
            const nextChooserIndex = (gameData.themeChooserIndex + 1) % gameData.players.length;
            
            // ...solo volvemos a la sala de espera y actualizamos el turno.
            await updateDoc(gameRef, {
                status: 'waiting', // Volvemos a la sala de espera
                lastScoredRound: gameData.currentRound, // Marcamos la ronda como puntuada
                themeChooserIndex: nextChooserIndex, // Pasamos el turno
                preselectedLetter: null // Limpiamos la letra anterior
            });
        }
    } catch (error) {
        showFirebaseError(error);
    }
});

// --- CHAT Y CATEGORÍAS ---
function listenToChat(gameId) {
    const chatRef = collection(db, "games", gameId, "chat");
    const q = query(chatRef, orderBy("timestamp", "desc"));
    if(unsubscribeFromChat) unsubscribeFromChat();
    unsubscribeFromChat = onSnapshot(q, (snapshot) => {
        chatMessages.innerHTML = '';
        snapshot.forEach(doc => {
            const msg = doc.data();
            const msgEl = document.createElement('p');
            msgEl.innerHTML = `<b>${msg.name}:</b> ${msg.text}`;
            chatMessages.prepend(msgEl);
        });
    });
}

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text) {
        const chatRef = collection(db, "games", currentGameId, "chat");
        await addDoc(chatRef, { name: localPlayerName, text, timestamp: serverTimestamp() });
        chatInput.value = '';
    }
});

addCategoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newCatLabel = newCategoryInput.value.trim();
    if (newCatLabel) {
        const newCatId = newCatLabel.toLowerCase().replace(/\s+/g, '_');
        const gameRef = doc(db, "games", currentGameId);
        const gameDoc = await getDoc(gameRef);
        const currentCategories = gameDoc.data().categories;
        if (!currentCategories.find(c => c.id === newCatId)) {
            await updateDoc(gameRef, { categories: [...currentCategories, {id: newCatId, label: newCatLabel}] });
        }
        newCategoryInput.value = '';
    }
});

async function removeCategory(categoryId) {
    const gameRef = doc(db, "games", currentGameId);
    const gameDoc = await getDoc(gameRef);
    const currentCategories = gameDoc.data().categories;
    await updateDoc(gameRef, { categories: currentCategories.filter(c => c.id !== categoryId) });
}

// --- GUARDADO AUTOMÁTICO, VERIFICACIÓN Y CÁLCULO DE PUNTOS ---
function debounce(func, delay) {
    let timeout;
    return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); };
}

async function saveMyAnswers() {
    if (!currentGameId || !currentUser) return;
    const myResponses = {};
    const gameDoc = await getDoc(doc(db, "games", currentGameId));
    const currentCategories = gameDoc.data().categories;
    currentCategories.forEach(cat => {
        const input = document.getElementById(cat.id);
        if (input) myResponses[cat.id] = input.value;
    });
    const updatePath = `responses.${currentUser.uid}`;
    try { await updateDoc(doc(db, "games", currentGameId), { [updatePath]: myResponses }); } 
    catch (error) { console.error("Failed to save answers:", error); }
}


verifyAnswersBtn.addEventListener('click', async () => {
    verifyLoader.classList.remove('hidden');
    verifyAnswersBtn.disabled = true;
    const gameRef = doc(db, "games", currentGameId);
    const gameDoc = await getDoc(gameRef);
    const gameData = gameDoc.data();
    
    const allResponses = gameData.responses || {};
    const playerIds = Object.keys(allResponses);
    const verifiedResults = {};
    
    for (const playerId of playerIds) {
        verifiedResults[playerId] = {};
        for (const cat of gameData.categories) {
            const answer = (allResponses[playerId]?.[cat.id] || "").trim();
            if (!answer) {
                verifiedResults[playerId][cat.id] = { score: 0, reason: 'Sin respuesta.' };
                continue;
            }

            // CORRECCIÓN 1: Renombramos la variable a 'promptText'
            const promptText = `Evalúa esta respuesta para un juego de Tutti Frutti (o 'Stop'). Letra: '${gameData.currentLetter}'. Categoría: '${cat.label}'. Respuesta: '${answer}'.
            Reglas estrictas:
            1. La respuesta DEBE empezar con la letra '${gameData.currentLetter}'.
            2. La respuesta DEBE ser un término real y relevante para la categoría.
            3. Penaliza errores de ortografía graves.
            
            Devuelve un JSON con dos claves: "score" (number) y "reason" (string).
            - "score": 10 si es correcta, 0 si es incorrecta.
            - "reason": Si el score es 0, explica brevemente en español por qué es incorrecta (ej: "No empieza con la letra correcta", "No parece ser un animal válido"). Si el score es 10, el reason debe ser una cadena vacía.`;
            
            try {
                const apiKey = "AIzaSyCYn5XSl_1Lm8RHtD6ewDifSCipzVmFIWc";
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
                
                // CORRECCIÓN 2: Usamos la variable correcta 'promptText' en el payload
                const payload = { contents: [{ role: "user", parts: [{ text: promptText }] }], generationConfig: { responseMimeType: "application/json" } };
                
                const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!response.ok) throw new Error('API request failed');

                const result = await response.json();
                const aiResponse = JSON.parse(result.candidates[0].content.parts[0].text);
                
                verifiedResults[playerId][cat.id] = { score: aiResponse.score, reason: aiResponse.reason || '' };

            } catch (e) {
                verifiedResults[playerId][cat.id] = { score: 0, reason: "Error al verificar con IA." }; 
                console.error(`Error verifying ${answer} for ${cat.label}:`, e);
            }
        }
    }

    try { await updateDoc(gameRef, { detailedResults: verifiedResults }); } 
    catch (error) { showFirebaseError(error); }
    verifyLoader.classList.add('hidden');
});

async function manualCorrection(playerId, categoryId, correct) {
    const gameRef = doc(db, "games", currentGameId);
    let reason = '';
    if (!correct) {
        reason = prompt(`¿Por qué la respuesta es incorrecta? (Opcional)`);
    }
    const newScore = correct ? 10 : 0;
    const updatePath = `detailedResults.${playerId}.${categoryId}`;
    try {
        await updateDoc(gameRef, {
            [updatePath]: { score: newScore, manual: true, reason: reason || '' }
        });
    } catch(e) { showFirebaseError(e); }
}


async function kickPlayer(playerIdToKick, playerName) {
    // Doble chequeo de seguridad
    if (!localPlayerIsHost) {
        alert('Solo el anfitrión puede expulsar jugadores.');
        return;
    }

    if (confirm(`¿Seguro que quieres expulsar a ${playerName}?`)) {
        try {
            const gameRef = doc(db, "games", currentGameId);
            const gameDoc = await getDoc(gameRef);
            const currentPlayers = gameDoc.data().players;
            
            // Filtramos el array para quitar al jugador expulsado
            const newPlayers = currentPlayers.filter(p => p.id !== playerIdToKick);
            
            // Actualizamos la base de datos
            await updateDoc(gameRef, { players: newPlayers });
        } catch (error) {
            showFirebaseError(error);
        }
    }
}

confirmScoresBtn.addEventListener('click', async () => {
    confirmScoresBtn.disabled = true;
    try {
        const gameRef = doc(db, "games", currentGameId);
        const gameDoc = await getDoc(gameRef);
        const gameData = gameDoc.data();
        
        const { detailedResults, responses, players, targetScore, bastaBonus, bastaPlayer } = gameData;
        if (!detailedResults) return;

        const finalScores = {};
        players.forEach(p => finalScores[p.id] = 0);

        const currentCategories = gameData.categories;
        currentCategories.forEach(cat => {
            const validResponsesCount = {};
            players.forEach(p => {
                if (detailedResults[p.id]?.[cat.id]?.score === 10) {
                    const responseUpper = (responses[p.id]?.[cat.id] || "").trim().toUpperCase();
                    if (responseUpper) validResponsesCount[responseUpper] = (validResponsesCount[responseUpper] || 0) + 1;
                }
            });
            players.forEach(p => {
                if (detailedResults[p.id]?.[cat.id]?.score === 10) {
                    const responseUpper = (responses[p.id]?.[cat.id] || "").trim().toUpperCase();
                    if (responseUpper) finalScores[p.id] += validResponsesCount[responseUpper] > 1 ? 5 : 10;
                }
            });
        });
        
        if(bastaPlayer && finalScores[bastaPlayer] !== undefined) {
            finalScores[bastaPlayer] += bastaBonus || 0;
        }

        const updatedPlayers = players.map(p => ({ ...p, score: p.score + (finalScores[p.id] || 0) }));
        
        const winners = updatedPlayers.filter(p => p.score >= targetScore);
        
        if (winners.length > 0) {
            const highestScorer = winners.reduce((prev, current) => (prev.score > current.score) ? prev : current);
            await updateDoc(gameRef, { status: 'finished', winner: highestScorer.name, players: updatedPlayers });
        } else {
            await updateDoc(gameRef, { players: updatedPlayers, lastScoredRound: gameData.currentRound });
        }
    } catch (error) {
        showFirebaseError(error);
        confirmScoresBtn.disabled = false;
    }
});

playAgainBtn.addEventListener('click', async () => {
    if (!localPlayerIsHost) return;
    const gameRef = doc(db, "games", currentGameId);
    const gameDoc = await getDoc(gameRef);
    const gameData = gameDoc.data();
    const resetPlayers = gameData.players.map(p => ({ ...p, score: 0 }));
    await updateDoc(gameRef, {
        status: 'waiting', players: resetPlayers, currentRound: 0, lastScoredRound: 0,
        responses: {}, detailedResults: {}, winner: null, usedLetters: [],
    });
});

// --- ACTUALIZACIÓN DE LA UI ---
function showScreen(screenIdToShow) {
    // Añadimos 'ai-verifying-screen' a la lista de pantallas a ocultar
    ['start-screen', 'lobby-screen', 'main-game-screen', 'results-screen', 'winner-screen', 'ai-verifying-screen'].forEach(id => {
        const screen = document.getElementById(id);
        if (screen) screen.classList.add('hidden');
    });
    const targetScreen = document.getElementById(screenIdToShow);
    if (targetScreen) { targetScreen.classList.remove('hidden'); }
}



function updateLobbyUI(gameData) {
    lobbyTargetScore.textContent = gameData.targetScore;
    lobbyBastaBonus.textContent = gameData.bastaBonus;
    gameIdDisplay.textContent = currentGameId;
    
    // Lógica mejorada para mostrar la lista de jugadores Y el botón de expulsar con ICONO
    playerList.innerHTML = gameData.players.map(p => {
        const isHost = p.id === gameData.hostId;
        // ICONO DE EXPULSAR
        const kickButton = (localPlayerIsHost && !isHost) 
            ? `<button onclick="window.kickPlayer('${p.id}', '${p.name}')" class="action-btn" title="Expulsar a ${p.name}">
                   <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/></svg>
               </button>` 
            : '';

        return `
            <li class="p-2 rounded-md flex items-center justify-between">
                <span class="flex items-center">
                    <span class="inline-block w-3 h-3 bg-green-400 rounded-full mr-3"></span>
                    ${p.name} ${isHost ? '<span class="text-xs text-text-secondary ml-2">(Anfitrión)</span>' : ''}
                </span>
                <div class="flex items-center gap-4">
                    <span class="font-bold">${p.score} pts</span>
                    ${kickButton}
                </div>
            </li>
        `;
    }).join('');
    
    // Mostramos la letra pre-seleccionada si existe
    const nextLetterInfo = document.getElementById('next-letter-info');
    const lobbyNextLetter = document.getElementById('lobby-next-letter');
    if (gameData.preselectedLetter) {
        lobbyNextLetter.textContent = gameData.preselectedLetter;
        nextLetterInfo.classList.remove('hidden');
    } else {
        nextLetterInfo.classList.add('hidden');
    }

    // Lógica principal para mostrar los controles correctos
    categoryEditorContainer.classList.toggle('hidden', !localPlayerIsHost);
    
    if (localPlayerIsHost) {
        // Renderizamos la lista de categorías con un ICONO para eliminar
        categoryList.innerHTML = gameData.categories.map(cat => `
            <li data-id="${cat.id}" data-label="${cat.label}" class="flex justify-between items-center p-3 bg-card rounded-xl shadow-sm">
                <span>${cat.label}</span>
                <button onclick="window.removeCategory('${cat.id}')" class="action-btn" title="Eliminar categoría">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z"/></svg>
                </button>
            </li>
        `).join('');

        const addCategorySection = document.getElementById('add-category-form');
        const generateCategoriesSection = document.getElementById('generate-categories-btn').parentElement;
        
        if (gameData.gameMode === 'classic') {
            categoryList.classList.add('sortable-active');
            Sortable.create(categoryList, { /* ... tu código de SortableJS ... */ });
            addCategorySection.style.display = 'flex';
            generateCategoriesSection.style.display = 'none';
            startGameBtn.classList.remove('hidden');
            waitingForHostMsg.classList.add('hidden');
        } else { // Modo 'ai_collaborative'
            categoryList.classList.remove('sortable-active'); // No se puede reordenar en modo IA
            const themeChooser = gameData.players[gameData.themeChooserIndex];
            const isMyTurnToChoose = themeChooser?.id === currentUser.uid;

            addCategorySection.style.display = 'none';
            generateCategoriesSection.style.display = isMyTurnToChoose ? 'block' : 'none';

            // El botón de empezar solo lo ve el anfitrión y solo si ya se ha elegido una letra
            startGameBtn.classList.toggle('hidden', !localPlayerIsHost || !gameData.preselectedLetter);
            
            // Mensaje de espera para todos
            if (isMyTurnToChoose) {
                waitingForHostMsg.textContent = 'Es tu turno de elegir un tema usando el botón "Generar con IA".';
            } else {
                waitingForHostMsg.textContent = `Esperando que ${themeChooser?.name || 'alguien'} elija el tema de la ronda...`;
            }
            waitingForHostMsg.classList.remove('hidden');
        }
    } else { // Vista para jugadores que no son anfitriones
        categoryList.innerHTML = gameData.categories.map(cat => `<li class="p-2 bg-card rounded-md shadow-sm"><span>${cat.label}</span></li>`).join('');
        if (gameData.gameMode === 'ai_collaborative') {
            const themeChooser = gameData.players[gameData.themeChooserIndex];
            const isMyTurnToChoose = themeChooser?.id === currentUser.uid;
            
            waitingForHostMsg.classList.remove('hidden');
            if (isMyTurnToChoose) {
                waitingForHostMsg.textContent = '¡Es tu turno! El anfitrión ha habilitado el botón para que generes el tema.';
                // Nota: El botón en sí está en la sección del anfitrión, pero esta lógica es para el texto.
            } else {
                waitingForHostMsg.textContent = `Esperando que ${themeChooser?.name || 'alguien'} elija el tema...`;
            }
        } else {
            waitingForHostMsg.textContent = 'Esperando que el anfitrión inicie la partida...';
            waitingForHostMsg.classList.remove('hidden');
        }
        startGameBtn.classList.add('hidden');
    }
}

function buildForm(formCategories) {
    gameForm.innerHTML = formCategories.map(cat => `<div><label for="${cat.id}" class="block text-sm font-medium">${cat.label}</label><input type="text" id="${cat.id}" class="w-full p-3 bg-slate-100 dark:bg-slate-700 rounded-lg mt-1"></div>`).join('');
}


// js/main.js

function displayResults(gameData) {
    const { detailedResults, responses, players, bastaPlayer, currentRound, lastScoredRound } = gameData;
    const roundIsScored = currentRound <= (lastScoredRound || 0);

    // Obtenemos referencias a los contenedores
    const resultsDisplayContainer = document.getElementById('results-display');
    const standingsContainer = document.getElementById('standings-container');
    const roundScoreEl = document.getElementById('round-score').parentElement;
    
    const bastaPlayerName = players.find(p => p.id === bastaPlayer)?.name || 'Alguien';
    resultsTitle.textContent = `¡${bastaPlayerName} dijo BASTA!`;

    if (roundIsScored) {
        // --- VISTA 1: TABLA DE POSICIONES ---
        
        // Controlamos la visibilidad directamente con style.display
        resultsDisplayContainer.style.display = 'none';
        standingsContainer.style.display = 'block';
        roundScoreEl.style.display = 'none';

        const standingsList = document.getElementById('standings-list');
        const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
        
        standingsList.innerHTML = sortedPlayers.map((p, index) => `
            <li class="p-3 rounded-xl flex justify-between items-center text-lg ${index === 0 ? 'bg-yellow-500 bg-opacity-20' : 'bg-white bg-opacity-5'}">
                <span class="font-semibold">${index + 1}. ${p.name}</span>
                <span class="font-bold">${p.score} pts</span>
            </li>
        `).join('');
        
    } else {
        // --- VISTA 2: DESGLOSE DE LA RONDA ---

        // Controlamos la visibilidad directamente con style.display
        resultsDisplayContainer.style.display = 'grid'; // Lo mostramos como grid
        standingsContainer.style.display = 'none';
        roundScoreEl.style.display = 'block';

        const roundScores = {};
        players.forEach(p => roundScores[p.id] = 0);
        let resultsHTML = '';
        
        // (Aquí va toda tu lógica para construir las tarjetas, que ya estaba bien.
        // La pego completa abajo para que no haya dudas)
        gameData.categories.forEach(cat => {
            resultsHTML += `<div class="result-card"><div class="result-card-header"><h4>${cat.label}</h4></div><ul class="result-card-body">`;
            const validResponsesCount = {};
            if (detailedResults) {
                players.forEach(p => {
                    if (detailedResults[p.id]?.[cat.id]?.score === 10) {
                        const responseUpper = (responses[p.id]?.[cat.id] || "").trim().toUpperCase();
                        if (responseUpper) validResponsesCount[responseUpper] = (validResponsesCount[responseUpper] || 0) + 1;
                    }
                });
            }
            players.forEach(player => {
                const responseText = (responses?.[player.id]?.[cat.id] || "").trim();
                let points = 0;
                let icon = '';
                let reasonText = '';
                let rowClass = 'correct';
                if (detailedResults && detailedResults[player.id]?.[cat.id]) {
                    const result = detailedResults[player.id][cat.id];
                    if (result.score === 10) {
                        const responseUpper = responseText.toUpperCase();
                        points = validResponsesCount[responseUpper] > 1 ? 5 : 10;
                        icon = points === 10 ? `<span class="text-green-400">✅</span>` : `<span class="text-blue-400">🔷</span>`;
                    } else {
                        rowClass = 'incorrect';
                        icon = `<span class="text-red-400">❌</span>`;
                        if (result.reason) { reasonText = `<div class="reason-text">${result.reason}</div>`; }
                    }
                }
                roundScores[player.id] += points;
                let hostControls = '';
                if (localPlayerIsHost && detailedResults && !roundIsScored) {
                    hostControls = `<button onclick="window.manualCorrection('${player.id}', '${cat.id}', true)" class="action-btn" title="Marcar como correcta">✅</button>
                                  <button onclick="window.manualCorrection('${player.id}', '${cat.id}', false)" class="action-btn" title="Marcar como incorrecta">❌</button>`;
                }
                resultsHTML += `<li class="answer-row ${rowClass}"><div class="answer-details"><b>${player.name}:</b><span class="answer-text">${responseText || '(vacío)'}</span>${reasonText}</div><div class="score-controls"><span>${icon} +${points}</span>${hostControls}</div></li>`;
            });
            resultsHTML += `</ul></div>`;
        });
        resultsDisplayContainer.innerHTML = resultsHTML;
        document.getElementById('round-score').textContent = roundScores[currentUser.uid] || 0;
    }

    // La lógica de los botones de abajo se mantiene igual
    if (localPlayerIsHost) {
        resultsButtons.classList.remove('hidden');
        const isVerified = detailedResults && Object.keys(detailedResults).length > 0;
        verifyAnswersBtn.classList.toggle('hidden', isVerified || roundIsScored);
        confirmScoresBtn.classList.toggle('hidden', !isVerified || roundIsScored);
        nextRoundBtn.classList.toggle('hidden', !roundIsScored);
        verifyAnswersBtn.disabled = false;
        confirmScoresBtn.disabled = false;
    } else {
        resultsButtons.classList.add('hidden');
    }
}
        
function displayWinner(gameData) {
    winnerName.textContent = gameData.winner;
    finalScoresList.innerHTML = gameData.players
        .sort((a, b) => b.score - a.score)
        .map(p => `<li class="p-2 bg-white dark:bg-slate-700 rounded-md shadow-sm flex items-center justify-between"><span>${p.name}</span><span class="font-bold text-indigo-500">${p.score} pts</span></li>`)
        .join('');
    playAgainBtn.classList.toggle('hidden', !localPlayerIsHost);
}

// ASIGNACIÓN A WINDOW PARA FUNCIONES GLOBALES (ACCESIBLES DESDE EL HTML)
window.manualCorrection = manualCorrection;
window.removeCategory = removeCategory;
window.kickPlayer = kickPlayer; // <-- AÑADIR ESTA LÍNEA

copyGameIdBtn.addEventListener('click', () => {
    const tempInput = document.createElement('input');
    tempInput.value = currentGameId;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    alert("¡Código copiado!");
});



generateCategoriesBtn.addEventListener('click', async () => {
    // Chequeo de seguridad: ¿Realmente es mi turno?
    const gameRef = doc(db, "games", currentGameId);
    const gameDocForCheck = await getDoc(gameRef);
    const gameDataForCheck = gameDocForCheck.data();
    if (gameDataForCheck.players[gameDataForCheck.themeChooserIndex]?.id !== currentUser.uid) {
        return alert("No es tu turno de elegir el tema.");
    }

    const theme = prompt("Escribe un tema para generar categorías (ej: La Biblia, Marvel, Profesiones):");
    if (!theme) return;

    generateLoader.classList.remove('hidden');
    generateCategoriesBtn.disabled = true;

    // --- LÓGICA MEJORADA AQUÍ ---
    // 1. Obtenemos las letras que ya han sido usadas en la partida.
    const usedLetters = gameDataForCheck.usedLetters || [];
    const exclusionList = usedLetters.length > 0 ? `La letra que elijas NO PUEDE SER una de estas: [${usedLetters.join(', ')}].` : '';

    // 2. Añadimos la nueva regla de exclusión al prompt.
    const promptForAI = `Basado en el tema "${theme}", genera una ronda para un juego de Tutti Frutti (o 'Stop').
    Necesito dos cosas:
    1. Una letra adecuada para el tema, que tenga varias respuestas posibles en español. ${exclusionList}
    2. Una lista de 6 a 7 categorías relacionadas con el tema que funcionen bien con la letra que elegiste.
    Devuelve SÓLO un objeto JSON con dos claves: "letter" (string, una sola letra mayúscula) y "categories" (un array de strings).`;

    try {
        const apiKey = "AIzaSyCYn5XSl_1Lm8RHtD6ewDifSCipzVmFIWc";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const payload = { contents: [{ role: "user", parts: [{ text: promptForAI }] }], generationConfig: { responseMimeType: "application/json" } };

        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error('La respuesta de la API no fue exitosa.');

        const result = await response.json();
        const aiResponse = JSON.parse(result.candidates[0].content.parts[0].text);
        
        if (aiResponse.categories && aiResponse.letter && aiResponse.letter.length === 1) {
            const currentCategories = gameDataForCheck.categories || [];
            
            const newCategories = aiResponse.categories.map(catLabel => ({
                label: catLabel,
                id: catLabel.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
            }));

            // Reemplazamos las categorías anteriores con las nuevas generadas
            await updateDoc(gameRef, { 
                categories: newCategories,
                preselectedLetter: aiResponse.letter.toUpperCase()
            });

        } else {
            throw new Error("La IA no devolvió los datos en el formato esperado (letra y categorías).");
        }

    } catch (error) {
        console.error("Error al generar ronda con IA:", error);
        alert("Hubo un error al generar la ronda. Por favor, intenta de nuevo.");
    } finally {
        generateLoader.classList.add('hidden');
        generateCategoriesBtn.disabled = false;
    }
});