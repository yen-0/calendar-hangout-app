// lib/firebase.ts
import { initializeApp, getApps }      from "firebase/app";
import { getAuth }                     from "firebase/auth";
import { getFirestore }                from "firebase/firestore";
import { getFunctions }                from "firebase/functions";

// pull in the helpers you need
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup, 
  createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    User,
    Auth,
    signInAnonymously,
    
} from "firebase/auth";

import {
  writeBatch,
  Timestamp,
  updateDoc,
  doc,
  collection, query, where, onSnapshot
} from "firebase/firestore";

const firebaseConfig = {
  apiKey:   process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  // …etc.
};

const app = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApps()[0];

export const auth      = getAuth(app);
export const db        = getFirestore(app);
export const functions = getFunctions(app);

// re-export the auth helpers here:
export {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
    createUserWithEmailAndPassword,
  writeBatch, Timestamp, updateDoc, doc, collection, query, where, onSnapshot,
};
