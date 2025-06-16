import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- CONFIGURACIÓN ---
// IMPORTANTE: Reemplaza esto con la configuración de tu propio proyecto de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBPzUGUCfRzbShQbJ9zQM2MJAyeQ3-yrsg",
    authDomain: "royer2025-5837b.firebaseapp.com",
    projectId: "royer2025-5837b",
    storageBucket: "royer2025-5837b.appspot.com",
    messagingSenderId: "694629365695",
    appId: "1:694629365695:web:d7682bdfefe10fa095130a",
    measurementId: "G-J17RTWG08J"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Exporta los servicios de Firebase para usarlos en otros módulos
export const db = getFirestore(app);
export const auth = getAuth(app);