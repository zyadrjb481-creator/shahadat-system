import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, doc, getDocs, setDoc, query, where, limit } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

// Load config from firebase-applet-config.json if it exists, otherwise fall back to environment variables.
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {};

if (fs.existsSync(configPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.error('Failed to parse firebase-applet-config.json:', err);
  }
} else {
  // Try loading from environment variables (important for production deployment on Render/Vercel)
  firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    appId: process.env.FIREBASE_APP_ID,
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || '(default)'
  };
}

const app = initializeApp({
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId
});

// Configure Firestore with standard options
const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true
}, firebaseConfig.firestoreDatabaseId || '(default)');

/**
 * Automatically seeds a default admin if the collection is completely empty.
 */
export async function autoSeedAdminIfNeeded() {
  try {
    const adminsCol = collection(db, 'admins');
    const q = query(adminsCol, limit(1));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('No admins found in Firestore collection. Seeding first admin account...');
      const defaultUsername = 'admin';
      const defaultPassword = 'password123';
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(defaultPassword, salt);
      
      const adminDocRef = doc(adminsCol, defaultUsername);
      await setDoc(adminDocRef, {
        username: defaultUsername,
        passwordHash,
        role: 'superadmin',
        createdAt: new Date().toISOString()
      });
      console.log(`Successfully seeded default admin: ${defaultUsername} / ${defaultPassword}`);
    } else {
      console.log('Admin account(s) exist in Firestore.');
    }
  } catch (error) {
    console.error('Error during auto-seeding admin account in Firestore:', error);
  }
}

export { db };
