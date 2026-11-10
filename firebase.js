/* ============================================================
   BRIVIAN · firebase.js
   Conexión con Firebase (Authentication + Firestore).
   Se carga desde la CDN oficial de Google, sin instalar nada.
   OJO: los módulos ES no funcionan abriendo el archivo con doble clic;
   usa Live Server (http://localhost:5500).
   ============================================================ */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, sendPasswordResetEmail, deleteUser,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  initializeFirestore, doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
  query, where, orderBy, limit, limitToLast, startAfter, writeBatch, runTransaction, serverTimestamp, increment,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

// Estas llaves son públicas por diseño: la seguridad la dan las reglas de Firestore (firestore.rules).
const firebaseConfig = {
  apiKey: 'AIzaSyDp5LvosjeZsUJihqKO-0f_4VCkUbVAvRo',
  authDomain: 'brivian.firebaseapp.com',
  projectId: 'brivian',
  storageBucket: 'brivian.firebasestorage.app',
  messagingSenderId: '465019085512',
  appId: '1:465019085512:web:9b06c3eee1ce1c3c3b7bfd',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
auth.languageCode = 'es';
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

export {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, deleteUser,
  doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
  query, where, orderBy, limit, limitToLast, startAfter, writeBatch, runTransaction, serverTimestamp, increment,
  onSnapshot,
};