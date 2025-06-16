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
    { id: 'nombre', label: 'Nombre' }, { id: 'animal', label: 'Animal' }, { id: 'color', label: 'Color' },
    { id: 'fruta_verdura', label: 'Fruta o Verdura' }, { id: 'objeto', label: 'Objeto' }
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
        const gameData = {
            status: 'waiting', hostId: currentUser.uid, players: [player],
            categories: defaultCategories, currentRound: 0, lastScoredRound: 0, responses: {},
            targetScore: targetScore, bastaBonus: bastaBonus, winner: null, usedLetters: [],
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
                // --- LÓGICA MEJORADA ---
                const resultsAreVerified = gameData.detailedResults && Object.keys(gameData.detailedResults).length > 0;

                if (resultsAreVerified) {
                    // Si los resultados ya están verificados, TODOS ven la pantalla de resultados.
                    showScreen('results-screen');
                    displayResults(gameData);
                } else {
                    // Si aún no se han verificado...
                    if (localPlayerIsHost) {
                        // El ANFITRIÓN ve la pantalla de resultados para poder hacer clic en "Verificar con IA".
                        showScreen('results-screen');
                        displayResults(gameData);
                    } else {
                        // LOS DEMÁS JUGADORES ven la pantalla de espera.
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

startGameBtn.addEventListener('click', async () => {
     try {
        const gameRef = doc(db, "games", currentGameId);
        const gameDoc = await getDoc(gameRef);
        const currentUsedLetters = gameDoc.data().usedLetters || [];
        const newLetter = getUniqueLetter(currentUsedLetters);
        await updateDoc(gameRef, {
            status: 'playing', currentLetter: newLetter, currentRound: 1, responses: {}, 
            usedLetters: [...currentUsedLetters, newLetter], detailedResults: {},
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

nextRoundBtn.addEventListener('click', async () => {
    try {
        const gameRef = doc(db, "games", currentGameId);
        const gameDoc = await getDoc(gameRef);
        const gameData = gameDoc.data();
        const newLetter = getUniqueLetter(gameData.usedLetters);
        await updateDoc(gameRef, {
            status: 'playing', currentLetter: newLetter,
            currentRound: gameData.currentRound + 1, responses: {}, detailedResults: {}, 
            usedLetters: [...gameData.usedLetters, newLetter],
        });
    } catch (error) { showFirebaseError(error); }
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
                verifiedResults[playerId][cat.id] = { score: 0 };
                continue;
            }

            const prompt = `Evalúa esta respuesta para un juego de Tutti Frutti de forma estricta. Letra: '${gameData.currentLetter}'. Categoría: '${cat.label}'. Respuesta: '${answer}'.\nReglas estrictas:\n1. La respuesta DEBE ser una palabra o término real y relevante para la categoría.\n2. La respuesta DEBE empezar con la letra '${gameData.currentLetter}'.\n3. No se aceptan respuestas de una sola letra (excepto si es un nombre propio reconocido como 'U Thant').\n4. Penaliza errores de ortografía graves.\nDevuelve un JSON con una única clave "score" (number): 10 si es perfecta, 0 si no cumple ALGUNA regla.`;
            
            try {
                // --- IMPORTANTE: Pega tu clave de API de Gemini aquí ---
                const apiKey = "AIzaSyCYn5XSl_1Lm8RHtD6ewDifSCipzVmFIWc"; 
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
                const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } };
                const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!response.ok) throw new Error('API request failed');
                const result = await response.json();
                verifiedResults[playerId][cat.id] = { score: JSON.parse(result.candidates[0].content.parts[0].text).score };
            } catch (e) {
                verifiedResults[playerId][cat.id] = { score: 0 }; 
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
    playerList.innerHTML = gameData.players.map(p => `<li class="p-2 rounded-md shadow-sm flex items-center justify-between"><span><span class="inline-block w-4 h-4 bg-green-400 rounded-full mr-2"></span>${p.name} ${p.id === gameData.hostId ? '(Anfitrión)' : ''}</span><span class="font-bold text-accent">${p.score} pts</span></li>`).join('');
    
    // Mostramos u ocultamos el editor de categorías si eres el anfitrión
    categoryEditorContainer.classList.toggle('hidden', !localPlayerIsHost);

    if (localPlayerIsHost) {
        // Renderizamos la lista de categorías con un atributo extra 'data-id'
        categoryList.innerHTML = gameData.categories.map(cat => `
            <li data-id="${cat.id}" class="flex justify-between items-center p-2 bg-card rounded-md shadow-sm">
                <span>${cat.label}</span>
                <button onclick="window.removeCategory('${cat.id}')" class="text-danger font-bold text-lg px-2 leading-none">×</button>
            </li>
        `).join('');

        // Le damos una clase al contenedor para activar el cursor 'grab' del CSS
        categoryList.classList.add('sortable-active');

        // --- INICIALIZACIÓN DE SORTABLEJS ---
        Sortable.create(categoryList, {
            animation: 150, // Animación suave al soltar
            ghostClass: 'sortable-ghost', // Clase para el elemento fantasma
            dragClass: 'sortable-drag',   // Clase para el elemento arrastrado
            onEnd: async (evt) => {
                // Se ejecuta cuando el anfitrión suelta una categoría
                const newOrderIds = [...evt.to.children].map(item => item.dataset.id);
                
                // Reordenamos el array de categorías original según el nuevo orden
                const newCategories = newOrderIds.map(id => {
                    return gameData.categories.find(cat => cat.id === id);
                });

                // Actualizamos la base de datos con el nuevo orden
                const gameRef = doc(db, "games", currentGameId);
                try {
                    await updateDoc(gameRef, { categories: newCategories });
                } catch (error) {
                    showFirebaseError(error);
                }
            }
        });

    } else {
        // Si no es el anfitrión, solo mostramos la lista sin controles
        categoryList.classList.remove('sortable-active');
        categoryList.innerHTML = gameData.categories.map(cat => `
            <li class="p-2 bg-card rounded-md shadow-sm">
                <span>${cat.label}</span>
            </li>
        `).join('');
    }
    
    // Lógica para mostrar los botones de empezar/esperar
    if (localPlayerIsHost) {
        startGameBtn.classList.remove('hidden');
        waitingForHostMsg.classList.add('hidden');
    } else {
        startGameBtn.classList.add('hidden');
        waitingForHostMsg.classList.remove('hidden');
    }
}

function buildForm(formCategories) {
    gameForm.innerHTML = formCategories.map(cat => `<div><label for="${cat.id}" class="block text-sm font-medium">${cat.label}</label><input type="text" id="${cat.id}" class="w-full p-3 bg-slate-100 dark:bg-slate-700 rounded-lg mt-1"></div>`).join('');
}

function displayResults(gameData) {
    const bastaPlayerName = gameData.players.find(p => p.id === gameData.bastaPlayer)?.name || 'Alguien';
    let title = `¡${bastaPlayerName} dijo BASTA!`;
    if(gameData.bastaPlayer && gameData.bastaBonus > 0 && gameData.currentRound <= (gameData.lastScoredRound || 0)) {
        title += ` (+${gameData.bastaBonus} pts de bonus)`;
    }
    resultsTitle.textContent = title;
    
    const { detailedResults, responses, players } = gameData;
    const roundScores = {};
    players.forEach(p => roundScores[p.id] = 0);

    let resultsHTML = '';
    gameData.categories.forEach(cat => {
        resultsHTML += `<div class="bg-slate-100 dark:bg-slate-700 p-3 rounded-lg"><p class="font-bold text-lg">${cat.label}</p><ul class="mt-2 space-y-1">`;
        
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
            let reasonHTML = '';
            
            if (detailedResults && detailedResults[player.id]?.[cat.id]) {
                const result = detailedResults[player.id][cat.id];
                if (result.score === 10) {
                    const responseUpper = responseText.toUpperCase();
                    points = validResponsesCount[responseUpper] > 1 ? 5 : 10;
                    icon = points === 10 ? `<span class="text-green-500 font-bold text-lg">✅</span>` : `<span class="text-blue-500 font-bold text-lg">🔷</span>`;
                } else {
                    icon = `<span class="text-red-500 font-bold text-lg">❌</span>`;
                }
                if (result.manual && result.reason) {
                    reasonHTML = `<div class="text-xs text-red-500 ml-5 pl-1 border-l-2 border-red-500">Razón: ${result.reason}</div>`;
                }
            }

            roundScores[player.id] += points;
            
            let hostControls = '';
            if (localPlayerIsHost && detailedResults && gameData.currentRound > (gameData.lastScoredRound || 0)) {
                hostControls = `<div class="flex items-center gap-1">
                                    <button onclick="window.manualCorrection('${player.id}', '${cat.id}', true)" class="manual-correction-btn correct">✅</button>
                                    <button onclick="window.manualCorrection('${player.id}', '${cat.id}', false)" class="manual-correction-btn incorrect">❌</button>
                                </div>`;
            }
            
            resultsHTML += `<li>
                              <div class="text-sm flex justify-between items-center">
                                  <span><b>${player.name}:</b> ${responseText || '(vacío)'}</span>
                                  <div class="flex items-center gap-2">
                                      ${detailedResults ? `${icon} +${points}` : ''}
                                      ${hostControls}
                                  </div>
                              </div>
                              ${reasonHTML}
                           </li>`;
        });
        resultsHTML += `</ul></div>`;
    });
    resultsDisplay.innerHTML = resultsHTML;
    roundScoreDisplay.textContent = roundScores[currentUser.uid] || 0;

    if (localPlayerIsHost) {
        resultsButtons.classList.remove('hidden');
        const resultsAreVerified = detailedResults && Object.keys(detailedResults).length > 0;
        const roundIsScored = gameData.currentRound <= (gameData.lastScoredRound || 0);

        verifyAnswersBtn.classList.toggle('hidden', resultsAreVerified || roundIsScored);
        confirmScoresBtn.classList.toggle('hidden', !resultsAreVerified || roundIsScored);
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

copyGameIdBtn.addEventListener('click', () => {
    const tempInput = document.createElement('input');
    tempInput.value = currentGameId;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    alert("¡Código copiado!");
});