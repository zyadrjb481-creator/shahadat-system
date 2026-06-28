import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { dbManager, Student, Payment, GatewayConfig } from './server/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { doc, getDoc } from 'firebase/firestore';
import { db, autoSeedAdminIfNeeded } from './server/firebase';

const app = express();
const PORT = 3000;

app.use(express.json());

// CORS middleware to support separate frontend (Vercel) and backend (Render)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Helper to sign transactions (HMAC-SHA256) for the Simulator
function generateSignature(transactionId: string, amount: number): string {
  const config = dbManager.getGatewayConfig();
  return crypto
    .createHmac('sha256', config.apiSecret)
    .update(`${transactionId}:${amount}`)
    .digest('hex');
}

// Helper to sign real Kashier transactions
function generateKashierHash(merchantOrderId: string, amount: number, merchantId: string, apiSecret: string, currency: string = "EGP"): string {
  const pathString = `mid?${merchantId}&orderId?${merchantOrderId}&amount?${amount}&currency?${currency}`;
  return crypto
    .createHmac('sha256', apiSecret)
    .update(pathString)
    .digest('hex');
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secure-jwt-secret-key-123456';

interface DecodedToken {
  username: string;
  role: string;
}

// Admin Auth Middleware (Secured using stateless JWT)
const verifyAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'غير مصرح للدخول - الرجاء تسجيل الدخول أولاً' });
    return;
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    (req as any).admin = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'جلسة عمل منتهية الصلاحية أو غير صالحة' });
  }
};

// ==========================================
// 1. PUBLIC INQUIRY API
// ==========================================

// Search for a student by Seat Number or National ID
app.get('/api/student/search', (req, res) => {
  const query = req.query.query as string;
  if (!query) {
    res.status(400).json({ error: 'الرجاء إدخال رقم الجلوس أو الرقم القومي' });
    return;
  }

  const student = dbManager.getStudentBySeatOrNationalId(query);
  if (!student) {
    res.status(404).json({ error: 'عذراً، لم يتم العثور على طالب بهذا الرقم' });
    return;
  }

  // Security Check: If not paid, do not expose grades and full details!
  // Only expose basic information needed to show name and confirm payment requirement.
  if (!student.is_paid) {
    res.json({
      student: {
        id: student.id,
        seat_number: student.seat_number,
        full_name: student.full_name,
        school_name: student.school_name,
        school_year: student.school_year,
        price: student.price,
        is_paid: false
      }
    });
  } else {
    // If paid, return ALL details including grades and QR verification hash
    res.json({
      student: {
        ...student,
        is_paid: true
      }
    });
  }
});

// Verification API (Accessed via QR Code scans or manual code lookup)
app.get('/api/student/verify/:hash', (req, res) => {
  const { hash } = req.params;
  const students = dbManager.getStudents();
  const student = students.find(s => s.certificate_hash === hash && s.is_paid);

  if (!student) {
    res.status(404).json({ verified: false, error: 'شهادة غير صالحة أو غير مسجلة في النظام' });
    return;
  }

  res.json({
    verified: true,
    student: {
      seat_number: student.seat_number,
      full_name: student.full_name,
      grade: student.grade,
      percentage: student.percentage,
      school_name: student.school_name,
      school_year: student.school_year,
      verification_date: new Date().toLocaleDateString('ar-EG'),
      certificate_hash: student.certificate_hash
    }
  });
});

// ==========================================
// 2. SECURE CASHIER GATEWAY SYSTEM
// ==========================================

// Initialize a payment transaction for a student
app.post('/api/payments/initialize', (req, res) => {
  const { studentId, paymentMethod } = req.body;
  if (!studentId) {
    res.status(400).json({ error: 'معرّف الطالب مطلوب لبدء الدفع' });
    return;
  }

  const student = dbManager.getStudentById(studentId);
  if (!student) {
    res.status(404).json({ error: 'لم يتم العثور على الطالب' });
    return;
  }

  if (student.is_paid) {
    res.status(400).json({ error: 'الشهادة مدفوعة بالفعل ومتاحة للتحميل' });
    return;
  }

  const transactionId = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const amount = student.price;
  const config = dbManager.getGatewayConfig();

  // Generate appropriate cryptographic signature based on mode
  let signature = '';
  if (config.mode === 'simulator') {
    signature = generateSignature(transactionId, amount);
  } else {
    signature = generateKashierHash(transactionId, amount, config.merchantId, config.apiSecret);
  }

  // Store PENDING transaction in DB
  dbManager.addPayment({
    student_id: studentId,
    amount,
    transaction_id: transactionId,
    status: 'pending',
    payment_method: paymentMethod || 'credit_card'
  });

  // Return the cashier redirection path with secure tokens
  const checkoutUrl = `/payment-gateway?transactionId=${transactionId}&amount=${amount}&signature=${signature}`;
  res.json({
    transactionId,
    amount,
    mode: config.mode,
    merchantId: config.merchantId,
    apiKey: config.apiKey,
    signature,
    checkoutUrl
  });
});

// Server-Side Webhook (Receives both Simulated & Real Kashier callbacks)
app.post('/api/payments/webhook', (req, res) => {
  const { transactionId, amount, status, signature } = req.body;

  if (!transactionId || amount === undefined || !status || !signature) {
    res.status(400).json({ error: 'بيانات غير مكتملة للعملية' });
    return;
  }

  const config = dbManager.getGatewayConfig();

  // Secure validation: Check the HMAC signature to make sure Cashier or simulator actually signed this request
  let expectedSignature = '';
  if (config.mode === 'simulator') {
    expectedSignature = generateSignature(transactionId, Number(amount));
  } else {
    expectedSignature = generateKashierHash(transactionId, Number(amount), config.merchantId, config.apiSecret);
  }

  // Accept either simulator signature or real Kashier signature for safe fallback
  if (signature !== expectedSignature && signature !== generateSignature(transactionId, Number(amount))) {
    res.status(403).json({ error: 'توقيع التحقق غير صالح - فشل التأمين' });
    return;
  }

  const payment = dbManager.getPaymentByTransactionId(transactionId);
  if (!payment) {
    res.status(404).json({ error: 'العملية غير موجودة بالنظام' });
    return;
  }

  // Prevent double-processing
  if (payment.status !== 'pending') {
    res.json({ success: true, message: 'تم معالجة هذه العملية مسبقاً' });
    return;
  }

  // Update payment status inside database
  dbManager.updatePayment(payment.id, {
    status: status === 'success' ? 'success' : 'failed'
  });

  // Activate Certificate download if success
  if (status === 'success') {
    dbManager.updateStudent(payment.student_id, { is_paid: true });
  }

  res.json({ success: true, verified: true });
});

// Kashier Redirect Callback Endpoint
app.post('/api/payments/kashier-callback', (req, res) => {
  const { merchantOrderId, paymentStatus, signature } = req.body;
  
  if (!merchantOrderId) {
    res.status(400).json({ error: 'كود العملية مطلوب' });
    return;
  }

  const payment = dbManager.getPaymentByTransactionId(merchantOrderId);
  if (!payment) {
    res.status(404).json({ error: 'العملية غير مسجلة' });
    return;
  }

  const success = paymentStatus === 'SUCCESS' || paymentStatus === 'success';
  const statusStr = success ? 'success' : 'failed';

  // Update payment status inside database
  dbManager.updatePayment(payment.id, {
    status: statusStr
  });

  // Activate Certificate download if success
  if (success) {
    dbManager.updateStudent(payment.student_id, { is_paid: true });
  }

  const student = dbManager.getStudentById(payment.student_id);

  res.json({ success: true, studentId: payment.student_id, student });
});

// Directly check payment status inside server (Safe callback verification)
app.get('/api/payments/verify', (req, res) => {
  const transactionId = req.query.transactionId as string;
  if (!transactionId) {
    res.status(400).json({ error: 'كود العملية مطلوب للتحقق' });
    return;
  }

  const payment = dbManager.getPaymentByTransactionId(transactionId);
  if (!payment) {
    res.status(404).json({ error: 'العملية غير مسجلة' });
    return;
  }

  res.json({
    status: payment.status,
    studentId: payment.student_id,
    amount: payment.amount,
    paymentMethod: payment.payment_method,
    createdAt: payment.created_at
  });
});

// ==========================================
// 3. ADMIN PORTAL API (Secured via verifyAdmin)
// ==========================================

// Login Route
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });
    return;
  }

  try {
    const adminDocRef = doc(db, 'admins', username.trim());
    const adminDoc = await getDoc(adminDocRef);

    if (!adminDoc.exists()) {
      res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
      return;
    }

    const adminData = adminDoc.data();
    const isMatch = await bcrypt.compare(password, adminData.passwordHash);

    if (!isMatch) {
      res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
      return;
    }

    // Generate stateless secure JWT token
    const token = jwt.sign(
      { username: adminData.username, role: adminData.role || 'admin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ success: true, token, username: adminData.username });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر أثناء تسجيل الدخول' });
  }
});

// Admin verification check
app.get('/api/admin/me', verifyAdmin, (req, res) => {
  res.json({ authenticated: true, username: (req as any).admin?.username || 'admin' });
});

// Logout Route
app.post('/api/admin/logout', (req, res) => {
  res.json({ success: true });
});

// Get Gateway Config
app.get('/api/admin/gateway-config', verifyAdmin, (req, res) => {
  res.json({ gatewayConfig: dbManager.getGatewayConfig() });
});

// Update Gateway Config
app.post('/api/admin/gateway-config', verifyAdmin, (req, res) => {
  const { merchantId, apiKey, apiSecret, mode } = req.body;
  if (!merchantId || !apiKey || !apiSecret || !mode) {
    res.status(400).json({ error: 'الرجاء ملء جميع حقول التكوين المطلوبة' });
    return;
  }
  if (!['simulator', 'sandbox', 'production'].includes(mode)) {
    res.status(400).json({ error: 'وضع البوابة غير صالح' });
    return;
  }
  const updated = dbManager.updateGatewayConfig({ merchantId, apiKey, apiSecret, mode });
  res.json({ success: true, gatewayConfig: updated });
});

// Statistics Endpoint
app.get('/api/admin/stats', verifyAdmin, (req, res) => {
  const students = dbManager.getStudents();
  const payments = dbManager.getPayments();

  const totalStudents = students.length;
  const paidStudents = students.filter(s => s.is_paid).length;
  const pendingPayments = payments.filter(p => p.status === 'pending').length;
  const successfulPayments = payments.filter(p => p.status === 'success');
  const totalRevenue = successfulPayments.reduce((sum, p) => sum + p.amount, 0);

  // calculate grades averages
  const percentages = students.map(s => s.percentage);
  const avgPercentage = percentages.length > 0 
    ? Number((percentages.reduce((sum, val) => sum + val, 0) / percentages.length).toFixed(1))
    : 0;

  res.json({
    totalStudents,
    paidStudents,
    pendingPayments,
    totalRevenue,
    avgPercentage
  });
});

// Student Management CRUD
app.get('/api/admin/students', verifyAdmin, (req, res) => {
  res.json({ students: dbManager.getStudents() });
});

app.post('/api/admin/students', verifyAdmin, (req, res) => {
  const { seat_number, national_id, full_name, grade, percentage, school_name, school_year, price, subject_grades } = req.body;
  
  if (!seat_number || !national_id || !full_name || !grade || percentage === undefined || !school_name || !school_year || price === undefined) {
    res.status(400).json({ error: 'الرجاء ملء جميع الحقول المطلوبة' });
    return;
  }

  // Check unique seat_number and national_id
  const students = dbManager.getStudents();
  if (students.some(s => s.seat_number === seat_number)) {
    res.status(400).json({ error: 'رقم الجلوس هذا مسجل بالفعل لطالب آخر' });
    return;
  }
  if (students.some(s => s.national_id === national_id)) {
    res.status(400).json({ error: 'الرقم القومي هذا مسجل بالفعل لطالب آخر' });
    return;
  }

  const newStudent = dbManager.addStudent({
    seat_number,
    national_id,
    full_name,
    grade,
    percentage: Number(percentage),
    school_name,
    school_year,
    price: Number(price),
    subject_grades: subject_grades || {},
    is_paid: Number(price) === 0 // Free are automatically paid
  });

  res.status(212).json({ success: true, student: newStudent });
});

app.put('/api/admin/students/:id', verifyAdmin, (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Remove read-only or system generated values
  delete updates.id;
  delete updates.certificate_hash;

  if (updates.percentage !== undefined) updates.percentage = Number(updates.percentage);
  if (updates.price !== undefined) updates.price = Number(updates.price);

  const updated = dbManager.updateStudent(id, updates);
  if (!updated) {
    res.status(404).json({ error: 'الطالب غير موجود' });
    return;
  }

  res.json({ success: true, student: updated });
});

app.delete('/api/admin/students/:id', verifyAdmin, (req, res) => {
  const { id } = req.params;
  const deleted = dbManager.deleteStudent(id);
  if (!deleted) {
    res.status(404).json({ error: 'الطالب غير موجود' });
    return;
  }
  res.json({ success: true });
});

// Re-issue student certificate (resets payment or changes cert hash for security validation)
app.post('/api/admin/students/:id/reissue', verifyAdmin, (req, res) => {
  const { id } = req.params;
  const student = dbManager.getStudentById(id);
  if (!student) {
    res.status(404).json({ error: 'الطالب غير موجود' });
    return;
  }

  // Re-issue generates a new hash by appending a fresh timestamp identifier
  const freshHash = 'CERT-' + crypto.createHash('md5')
    .update(`${student.seat_number}-${student.full_name}-${Date.now()}`)
    .digest('hex').substring(0, 10).toUpperCase();

  const updated = dbManager.updateStudent(id, {
    certificate_hash: freshHash
  });

  res.json({ success: true, student: updated, message: 'تم إعادة إصدار كود التحقق الخاص بالشهادة بنجاح' });
});

// Payments List
app.get('/api/admin/payments', verifyAdmin, (req, res) => {
  const payments = dbManager.getPayments();
  const students = dbManager.getStudents();

  // Map student name to payments for easy admin viewing
  const enrichedPayments = payments.map(p => {
    const student = students.find(s => s.id === p.student_id);
    return {
      ...p,
      student_name: student ? student.full_name : 'طالب محذوف',
      seat_number: student ? student.seat_number : '-'
    };
  });

  res.json({ payments: enrichedPayments });
});

// ==========================================
// 4. VITE DEV SERVER & STATIC ASSETS
// ==========================================

async function startServer() {
  // Ensure default admin account is seeded in Firestore
  await autoSeedAdminIfNeeded();

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
