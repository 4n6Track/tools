// leaderboard.js
import {
  collection, addDoc, query, where, orderBy, limit, getDocs,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { db, isFirebaseConfigured } from './firebase-config.js';

export async function submitScore({ uid, username, difficulty, score, elapsedSeconds, mistakes }) {
  if (!isFirebaseConfigured) throw new Error('OFFLINE');
  await addDoc(collection(db, 'scores'), {
    uid, username, difficulty, score,
    elapsedSeconds, mistakes,
    createdAt: Date.now(),
  });
}

export async function fetchTopScores(difficulty, topN = 10) {
  if (!isFirebaseConfigured) return [];
  const q = query(
    collection(db, 'scores'),
    where('difficulty', '==', difficulty),
    orderBy('score', 'desc'),
    limit(topN)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}
