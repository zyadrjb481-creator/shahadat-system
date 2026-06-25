import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export interface Student {
  id: string;
  seat_number: string;
  national_id: string;
  full_name: string;
  grade: string;
  percentage: number;
  school_name: string;
  school_year: string;
  price: number; // 0 for free, > 0 for paid
  is_paid: boolean;
  subject_grades: Record<string, number>;
  certificate_hash: string; // for QR Code verification
}

export interface Payment {
  id: string;
  student_id: string;
  amount: number;
  transaction_id: string;
  status: 'pending' | 'success' | 'failed';
  payment_method: string;
  created_at: string;
  updated_at?: string;
}

export interface GatewayConfig {
  merchantId: string;
  apiKey: string;
  apiSecret: string;
  mode: 'simulator' | 'sandbox' | 'production';
}

// ----------------------------------------------------
// 1. Initialize Firebase Admin
// ----------------------------------------------------
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {};
if (fs.existsSync(configPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (err) {
    console.error('Error reading firebase-applet-config.json:', err);
  }
}

const serviceAccountPath1 = path.join(process.cwd(), 'service-account.json');
const serviceAccountPath2 = path.join(process.cwd(), 'serviceAccountKey.json');
let serviceAccount: any = null;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const trimmedVal = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
    if (trimmedVal.startsWith('{')) {
      serviceAccount = JSON.parse(trimmedVal);
    } else {
      const envPath = path.resolve(trimmedVal);
      if (fs.existsSync(envPath)) {
        serviceAccount = JSON.parse(fs.readFileSync(envPath, 'utf-8'));
      }
    }
  } catch (err) {
    console.error('Error parsing FIREBASE_SERVICE_ACCOUNT env var:', err);
  }
}

if (!serviceAccount && fs.existsSync(serviceAccountPath1)) {
  try {
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath1, 'utf-8'));
  } catch (err) {
    console.error('Error reading service-account.json:', err);
  }
}

if (!serviceAccount && fs.existsSync(serviceAccountPath2)) {
  try {
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath2, 'utf-8'));
  } catch (err) {
    console.error('Error reading serviceAccountKey.json:', err);
  }
}

let isUsingServiceAccount = false;

if (getApps().length === 0) {
  if (serviceAccount) {
    try {
      initializeApp({
        credential: cert(serviceAccount)
      });
      isUsingServiceAccount = true;
      console.log('Firebase Admin initialized successfully using service account key for project:', serviceAccount.project_id);
    } catch (err) {
      console.error('Error initializing Firebase Admin with service account:', err);
    }
  }

  // Fallback to default sandboxed environment credentials if no service account uploaded
  if (getApps().length === 0) {
    initializeApp({
      projectId: 'valiant-lexicon-pdpgw'
    });
    console.log('Firebase Admin initialized using default sandbox project valiant-lexicon-pdpgw');
  }
}

// Access the specific firestore database (use custom ID for sandbox, default for custom projects)
const dbId = isUsingServiceAccount 
  ? '(default)' 
  : 'ai-studio-a4ae27dc-5b1d-4a7c-85f7-14edfc7b387f';

export const db = getFirestore(dbId);

// Helper to generate a unique cryptographic-like hash for a student's certificate
function generateHash(seatNumber: string, fullName: string): string {
  let hash = 0;
  const str = `${seatNumber}-${fullName}-verified-cert-2026`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'CERT-' + Math.abs(hash).toString(16).toUpperCase();
}

const INITIAL_STUDENTS: Student[] = [
  {
    id: 'student-1',
    seat_number: '1001',
    national_id: '30501011234567',
    full_name: 'أحمد محمد علي حسن',
    grade: 'ممتاز',
    percentage: 95.5,
    school_name: 'مدرسة المتفوقين الثانوية للبنين',
    school_year: '2025 - 2026',
    price: 150,
    is_paid: false,
    subject_grades: {
      'الرياضيات البحوتة': 59,
      'الفيزياء': 58,
      'الكيمياء': 57,
      'اللغة العربية': 76,
      'اللغة الإنجليزية': 48,
      'الجيولوجيا': 59
    },
    certificate_hash: generateHash('1001', 'أحمد محمد علي حسن')
  },
  {
    id: 'student-2',
    seat_number: '1002',
    national_id: '30602021234568',
    full_name: 'سارة عبد الرحمن محمود حسن',
    grade: 'جيد جداً',
    percentage: 88.2,
    school_name: 'مدرسة الحرية الثانوية الرسمية للغات',
    school_year: '2025 - 2026',
    price: 150,
    is_paid: true, // already paid
    subject_grades: {
      'الرياضيات البحوتة': 52,
      'الفيزياء': 51,
      'الكيمياء': 50,
      'اللغة العربية': 72,
      'اللغة الإنجليزية': 45,
      'الأحياء': 57
    },
    certificate_hash: generateHash('1002', 'سارة عبد الرحمن محمود حسن')
  },
  {
    id: 'student-3',
    seat_number: '1003',
    national_id: '30503031234569',
    full_name: 'عمر خالد وليد سعيد',
    grade: 'مقبول',
    percentage: 64.8,
    school_name: 'مدرسة الأمل الثانوية العسكرية بنين',
    school_year: '2025 - 2026',
    price: 0, // FREE Certificate
    is_paid: true, // Free is always accessible
    subject_grades: {
      'الرياضيات البحوتة': 35,
      'الفيزياء': 38,
      'الكيمياء': 40,
      'اللغة العربية': 52,
      'اللغة الإنجليزية': 30,
      'التاريخ': 42
    },
    certificate_hash: generateHash('1003', 'عمر خالد وليد سعيد')
  }
];

const INITIAL_PAYMENTS: Payment[] = [
  {
    id: 'pay-1',
    student_id: 'student-2',
    amount: 150,
    transaction_id: 'TXN-KASHIER-882910',
    status: 'success',
    payment_method: 'credit_card',
    created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
  }
];

const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  merchantId: '8e688370b0ecea73ff706a8aac9e3843',
  apiKey: '55ea9130-fb8a-4d9e-953a-285b680b85e1',
  apiSecret: '8bba4e7259e71f70abb2ce6f5977418616f186fecb9861f552cd49e38d302d8d13543bdc1a8f0c0e5b3a7bf0e0c9a68b',
  mode: 'simulator'
};

// ----------------------------------------------------
// 2. Database Autoseed Helper
// ----------------------------------------------------
export async function seedDatabaseIfEmpty() {
  try {
    const studentsColl = db.collection('students');
    const snapshot = await studentsColl.limit(1).get();
    if (snapshot.empty) {
      console.log('Seeding initial students to Firestore...');
      for (const student of INITIAL_STUDENTS) {
        await studentsColl.doc(student.id).set(student);
      }
    }

    const paymentsColl = db.collection('payments');
    const paymentsSnapshot = await paymentsColl.limit(1).get();
    if (paymentsSnapshot.empty) {
      console.log('Seeding initial payments to Firestore...');
      for (const payment of INITIAL_PAYMENTS) {
        await paymentsColl.doc(payment.id).set(payment);
      }
    }

    const configColl = db.collection('gatewayConfig');
    const configDoc = await configColl.doc('main').get();
    if (!configDoc.exists) {
      console.log('Seeding default gateway config to Firestore...');
      await configColl.doc('main').set(DEFAULT_GATEWAY_CONFIG);
    }

    const adminsColl = db.collection('admins');
    const adminSnapshot = await adminsColl.limit(1).get();
    if (adminSnapshot.empty) {
      console.log('Seeding default admin user to Firestore...');
      await adminsColl.doc('admin').set({
        username: 'admin',
        password: 'password123'
      });
    }

    console.log('Firestore database initialized successfully.');
  } catch (err) {
    console.error('Error seeding Firestore database:', err);
  }
}

// ----------------------------------------------------
// 3. Database Manager (Async Firestore Implementation)
// ----------------------------------------------------
export const dbManager = {
  // Students
  async getStudents(): Promise<Student[]> {
    const snap = await db.collection('students').get();
    return snap.docs.map(doc => doc.data() as Student);
  },

  async getStudentById(id: string): Promise<Student | undefined> {
    const doc = await db.collection('students').doc(id).get();
    return doc.exists ? (doc.data() as Student) : undefined;
  },

  async getStudentBySeatOrNationalId(query: string): Promise<Student | undefined> {
    const trimmed = query.trim();
    // Try seat number first
    const seatSnap = await db.collection('students').where('seat_number', '==', trimmed).get();
    if (!seatSnap.empty) {
      return seatSnap.docs[0].data() as Student;
    }
    // Try national ID
    const nationalSnap = await db.collection('students').where('national_id', '==', trimmed).get();
    if (!nationalSnap.empty) {
      return nationalSnap.docs[0].data() as Student;
    }
    // Try ID
    const idSnap = await db.collection('students').doc(trimmed).get();
    if (idSnap.exists) {
      return idSnap.data() as Student;
    }
    return undefined;
  },

  async addStudent(student: Omit<Student, 'id' | 'certificate_hash'>): Promise<Student> {
    const id = 'student-' + Date.now();
    const certificate_hash = generateHash(student.seat_number, student.full_name);
    
    const newStudent: Student = {
      ...student,
      id,
      certificate_hash,
      is_paid: student.price === 0 ? true : false // Free are automatically paid
    };
    
    await db.collection('students').doc(id).set(newStudent);
    return newStudent;
  },

  async updateStudent(id: string, updates: Partial<Student>): Promise<Student | undefined> {
    const docRef = db.collection('students').doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return undefined;

    const current = docSnap.data() as Student;

    let certHash = current.certificate_hash;
    if (updates.full_name || updates.seat_number) {
      certHash = generateHash(
        updates.seat_number || current.seat_number,
        updates.full_name || current.full_name
      );
    }

    const updated: Student = {
      ...current,
      ...updates,
      certificate_hash: certHash
    };

    // If price becomes 0, mark as paid automatically
    if (updates.price === 0) {
      updated.is_paid = true;
    }

    await docRef.set(updated, { merge: true });
    return updated;
  },

  async deleteStudent(id: string): Promise<boolean> {
    const docRef = db.collection('students').doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return false;
    await docRef.delete();
    return true;
  },

  // Payments
  async getPayments(): Promise<Payment[]> {
    const snap = await db.collection('payments').get();
    return snap.docs.map(doc => doc.data() as Payment);
  },

  async getPaymentById(id: string): Promise<Payment | undefined> {
    const docSnap = await db.collection('payments').doc(id).get();
    return docSnap.exists ? (docSnap.data() as Payment) : undefined;
  },

  async getPaymentByTransactionId(txnId: string): Promise<Payment | undefined> {
    const snap = await db.collection('payments').where('transaction_id', '==', txnId).get();
    return !snap.empty ? (snap.docs[0].data() as Payment) : undefined;
  },

  async addPayment(payment: Omit<Payment, 'id' | 'created_at'>): Promise<Payment> {
    const id = 'pay-' + Date.now();
    const newPayment: Payment = {
      ...payment,
      id,
      created_at: new Date().toISOString()
    };
    await db.collection('payments').doc(id).set(newPayment);
    return newPayment;
  },

  async updatePayment(id: string, updates: Partial<Payment>): Promise<Payment | undefined> {
    const docRef = db.collection('payments').doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return undefined;

    const updated: Payment = {
      ...(docSnap.data() as Payment),
      ...updates,
      updated_at: new Date().toISOString()
    };

    await docRef.set(updated, { merge: true });
    return updated;
  },

  // Gateway Config
  async getGatewayConfig(): Promise<GatewayConfig> {
    const docSnap = await db.collection('gatewayConfig').doc('main').get();
    if (!docSnap.exists) {
      return DEFAULT_GATEWAY_CONFIG;
    }
    return docSnap.data() as GatewayConfig;
  },

  async updateGatewayConfig(updates: Partial<GatewayConfig>): Promise<GatewayConfig> {
    const docRef = db.collection('gatewayConfig').doc('main');
    const docSnap = await docRef.get();
    const current = docSnap.exists ? (docSnap.data() as GatewayConfig) : DEFAULT_GATEWAY_CONFIG;
    const updated: GatewayConfig = {
      ...current,
      ...updates
    };
    await docRef.set(updated, { merge: true });
    return updated;
  },

  // Admin users management
  async getAdminByUsername(username: string): Promise<any | undefined> {
    const trimmed = username.trim();
    const docSnap = await db.collection('admins').doc(trimmed).get();
    if (docSnap.exists) {
      return docSnap.data();
    }
    const snap = await db.collection('admins').where('username', '==', trimmed).get();
    if (!snap.empty) {
      return snap.docs[0].data();
    }
    return undefined;
  }
};
