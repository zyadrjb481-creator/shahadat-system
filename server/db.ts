import fs from 'fs';
import path from 'path';

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

const DB_FILE = path.join(process.cwd(), 'database.json');

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

export interface GatewayConfig {
  merchantId: string;
  apiKey: string;
  apiSecret: string;
  mode: 'simulator' | 'sandbox' | 'production';
}

interface DBData {
  students: Student[];
  payments: Payment[];
  gatewayConfig?: GatewayConfig;
}

const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  merchantId: '8e688370b0ecea73ff706a8aac9e3843',
  apiKey: '55ea9130-fb8a-4d9e-953a-285b680b85e1',
  apiSecret: '8bba4e7259e71f70abb2ce6f5977418616f186fecb9861f552cd49e38d302d8d13543bdc1a8f0c0e5b3a7bf0e0c9a68b',
  mode: 'sandbox'
};

function readDB(): DBData {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initialData: DBData = {
        students: INITIAL_STUDENTS,
        payments: INITIAL_PAYMENTS,
        gatewayConfig: DEFAULT_GATEWAY_CONFIG
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
      return initialData;
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    if (!parsed.gatewayConfig) {
      parsed.gatewayConfig = DEFAULT_GATEWAY_CONFIG;
    }
    return parsed;
  } catch (err) {
    console.error('Error reading database file:', err);
    return { students: INITIAL_STUDENTS, payments: INITIAL_PAYMENTS, gatewayConfig: DEFAULT_GATEWAY_CONFIG };
  }
}

function writeDB(data: DBData) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing database file:', err);
  }
}

export const dbManager = {
  // Students
  getStudents(): Student[] {
    return readDB().students;
  },

  getStudentById(id: string): Student | undefined {
    return readDB().students.find(s => s.id === id);
  },

  getStudentBySeatOrNationalId(query: string): Student | undefined {
    const trimmed = query.trim();
    return readDB().students.find(
      s => s.seat_number === trimmed || s.national_id === trimmed || s.id === trimmed
    );
  },

  addStudent(student: Omit<Student, 'id' | 'certificate_hash'>): Student {
    const data = readDB();
    const id = 'student-' + Date.now();
    const certificate_hash = generateHash(student.seat_number, student.full_name);
    
    const newStudent: Student = {
      ...student,
      id,
      certificate_hash,
      is_paid: student.price === 0 ? true : false // Free is automatically paid
    };
    
    data.students.push(newStudent);
    writeDB(data);
    return newStudent;
  },

  updateStudent(id: string, updates: Partial<Student>): Student | undefined {
    const data = readDB();
    const idx = data.students.findIndex(s => s.id === id);
    if (idx === -1) return undefined;

    // Keep certain critical values consistent if name or seat number is changed
    let certHash = data.students[idx].certificate_hash;
    if (updates.full_name || updates.seat_number) {
      certHash = generateHash(
        updates.seat_number || data.students[idx].seat_number,
        updates.full_name || data.students[idx].full_name
      );
    }

    const updated: Student = {
      ...data.students[idx],
      ...updates,
      certificate_hash: certHash
    };

    // If price becomes 0, mark as paid automatically
    if (updates.price === 0) {
      updated.is_paid = true;
    }

    data.students[idx] = updated;
    writeDB(data);
    return updated;
  },

  deleteStudent(id: string): boolean {
    const data = readDB();
    const initialLen = data.students.length;
    data.students = data.students.filter(s => s.id !== id);
    if (data.students.length === initialLen) return false;
    writeDB(data);
    return true;
  },

  // Payments
  getPayments(): Payment[] {
    return readDB().payments;
  },

  getPaymentById(id: string): Payment | undefined {
    return readDB().payments.find(p => p.id === id);
  },

  getPaymentByTransactionId(txnId: string): Payment | undefined {
    return readDB().payments.find(p => p.transaction_id === txnId);
  },

  addPayment(payment: Omit<Payment, 'id' | 'created_at'>): Payment {
    const data = readDB();
    const id = 'pay-' + Date.now();
    const newPayment: Payment = {
      ...payment,
      id,
      created_at: new Date().toISOString()
    };
    data.payments.push(newPayment);
    writeDB(data);
    return newPayment;
  },

  updatePayment(id: string, updates: Partial<Payment>): Payment | undefined {
    const data = readDB();
    const idx = data.payments.findIndex(p => p.id === id);
    if (idx === -1) return undefined;

    const updated: Payment = {
      ...data.payments[idx],
      ...updates,
      updated_at: new Date().toISOString()
    };

    data.payments[idx] = updated;
    writeDB(data);
    return updated;
  },

  getGatewayConfig(): GatewayConfig {
    const data = readDB();
    if (!data.gatewayConfig) {
      return DEFAULT_GATEWAY_CONFIG;
    }
    return data.gatewayConfig;
  },

  updateGatewayConfig(updates: Partial<GatewayConfig>): GatewayConfig {
    const data = readDB();
    const current = data.gatewayConfig || DEFAULT_GATEWAY_CONFIG;
    const updated: GatewayConfig = {
      ...current,
      ...updates
    };
    data.gatewayConfig = updated;
    writeDB(data);
    return updated;
  }
};
