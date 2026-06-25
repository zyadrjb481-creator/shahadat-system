import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { dbManager, Student, Payment, GatewayConfig, seedDatabaseIfEmpty } from './server/db';

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper to sign transactions (HMAC-SHA256) for the Simulator
async function generateSignature(transactionId: string, amount: number): Promise<string> {
  const config = await dbManager.getGatewayConfig();
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

// Admin Sessions (simple, robust, stateful token storage mapping session token to username)
const ADMIN_SESSIONS = new Map<string, string>();

// Admin Auth Middleware
const verifyAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'غير مصرح للدخول - الرجاء تسجيل الدخول أولاً' });
    return;
  }
  const token = authHeader.split(' ')[1];
  if (!ADMIN_SESSIONS.has(token)) {
    res.status(403).json({ error: 'جلسة عمل منتهية الصلاحية أو غير صالحة' });
    return;
  }
  // Store username on request object for downstream use if needed
  (req as any).adminUsername = ADMIN_SESSIONS.get(token);
  next();
};

// ==========================================
// 1. PUBLIC INQUIRY API
// ==========================================

// Search for a student by Seat Number or National ID
app.get('/api/student/search', async (req, res) => {
  const query = req.query.query as string;
  if (!query) {
    res.status(400).json({ error: 'الرجاء إدخال رقم الجلوس أو الرقم القومي' });
    return;
  }

  const student = await dbManager.getStudentBySeatOrNationalId(query);
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
app.get('/api/student/verify/:hash', async (req, res) => {
  const { hash } = req.params;
  const students = await dbManager.getStudents();
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
app.post('/api/payments/initialize', async (req, res) => {
  const { studentId, paymentMethod } = req.body;
  if (!studentId) {
    res.status(400).json({ error: 'معرّف الطالب مطلوب لبدء الدفع' });
    return;
  }

  const student = await dbManager.getStudentById(studentId);
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
  const config = await dbManager.getGatewayConfig();

  // Generate appropriate cryptographic signature based on mode
  let signature = '';
  if (config.mode === 'simulator') {
    signature = await generateSignature(transactionId, amount);
  } else {
    signature = generateKashierHash(transactionId, amount, config.merchantId, config.apiSecret);
  }

  // Store PENDING transaction in DB
  await dbManager.addPayment({
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
app.post('/api/payments/webhook', async (req, res) => {
  const { transactionId, amount, status, signature } = req.body;

  if (!transactionId || amount === undefined || !status || !signature) {
    res.status(400).json({ error: 'بيانات غير مكتملة للعملية' });
    return;
  }

  const config = await dbManager.getGatewayConfig();

  // Secure validation: Check the HMAC signature to make sure Cashier or simulator actually signed this request
  let expectedSignature = '';
  if (config.mode === 'simulator') {
    expectedSignature = await generateSignature(transactionId, Number(amount));
  } else {
    expectedSignature = generateKashierHash(transactionId, Number(amount), config.merchantId, config.apiSecret);
  }

  // Accept either simulator signature or real Kashier signature for safe fallback
  if (signature !== expectedSignature && signature !== await generateSignature(transactionId, Number(amount))) {
    res.status(403).json({ error: 'توقيع التحقق غير صالح - فشل التأمين' });
    return;
  }

  const payment = await dbManager.getPaymentByTransactionId(transactionId);
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
  await dbManager.updatePayment(payment.id, {
    status: status === 'success' ? 'success' : 'failed'
  });

  // Activate Certificate download if success
  if (status === 'success') {
    await dbManager.updateStudent(payment.student_id, { is_paid: true });
  }

  res.json({ success: true, verified: true });
});

// Kashier Redirect Callback Endpoint
app.post('/api/payments/kashier-callback', async (req, res) => {
  const { merchantOrderId, paymentStatus, signature } = req.body;
  
  if (!merchantOrderId) {
    res.status(400).json({ error: 'كود العملية مطلوب' });
    return;
  }

  const payment = await dbManager.getPaymentByTransactionId(merchantOrderId);
  if (!payment) {
    res.status(404).json({ error: 'العملية غير مسجلة' });
    return;
  }

  const success = paymentStatus === 'SUCCESS' || paymentStatus === 'success';
  const statusStr = success ? 'success' : 'failed';

  // Update payment status inside database
  await dbManager.updatePayment(payment.id, {
    status: statusStr
  });

  // Activate Certificate download if success
  if (success) {
    await dbManager.updateStudent(payment.student_id, { is_paid: true });
  }

  const student = await dbManager.getStudentById(payment.student_id);

  res.json({ success: true, studentId: payment.student_id, student });
});

// Directly check payment status inside server (Safe callback verification)
app.get('/api/payments/verify', async (req, res) => {
  const transactionId = req.query.transactionId as string;
  if (!transactionId) {
    res.status(400).json({ error: 'كود العملية مطلوب للتحقق' });
    return;
  }

  const payment = await dbManager.getPaymentByTransactionId(transactionId);
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
    res.status(400).json({ error: 'الرجاء إدخال اسم المستخدم وكلمة المرور' });
    return;
  }
  const adminUser = await dbManager.getAdminByUsername(username);
  if (adminUser && adminUser.password === password) {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    ADMIN_SESSIONS.set(sessionToken, adminUser.username);
    res.json({ success: true, token: sessionToken, username: adminUser.username });
  } else {
    res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }
});

// Admin verification check
app.get('/api/admin/me', verifyAdmin, (req, res) => {
  res.json({ authenticated: true, username: (req as any).adminUsername || 'admin' });
});

// Logout Route
app.post('/api/admin/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    ADMIN_SESSIONS.delete(token);
  }
  res.json({ success: true });
});

// Get Gateway Config
app.get('/api/admin/gateway-config', verifyAdmin, async (req, res) => {
  res.json({ gatewayConfig: await dbManager.getGatewayConfig() });
});

// Update Gateway Config
app.post('/api/admin/gateway-config', verifyAdmin, async (req, res) => {
  const { merchantId, apiKey, apiSecret, mode } = req.body;
  if (!merchantId || !apiKey || !apiSecret || !mode) {
    res.status(400).json({ error: 'الرجاء ملء جميع حقول التكوين المطلوبة' });
    return;
  }
  if (!['simulator', 'sandbox', 'production'].includes(mode)) {
    res.status(400).json({ error: 'وضع البوابة غير صالح' });
    return;
  }
  const updated = await dbManager.updateGatewayConfig({ merchantId, apiKey, apiSecret, mode });
  res.json({ success: true, gatewayConfig: updated });
});

// Statistics Endpoint
app.get('/api/admin/stats', verifyAdmin, async (req, res) => {
  const students = await dbManager.getStudents();
  const payments = await dbManager.getPayments();

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
app.get('/api/admin/students', verifyAdmin, async (req, res) => {
  res.json({ students: await dbManager.getStudents() });
});

app.post('/api/admin/students', verifyAdmin, async (req, res) => {
  const { seat_number, national_id, full_name, grade, percentage, school_name, school_year, price, subject_grades } = req.body;
  
  if (!seat_number || !national_id || !full_name || !grade || percentage === undefined || !school_name || !school_year || price === undefined) {
    res.status(400).json({ error: 'الرجاء ملء جميع الحقول المطلوبة' });
    return;
  }

  // Check unique seat_number and national_id
  const students = await dbManager.getStudents();
  if (students.some(s => s.seat_number === seat_number)) {
    res.status(400).json({ error: 'رقم الجلوس هذا مسجل بالفعل لطالب آخر' });
    return;
  }
  if (students.some(s => s.national_id === national_id)) {
    res.status(400).json({ error: 'الرقم القومي هذا مسجل بالفعل لطالب آخر' });
    return;
  }

  const newStudent = await dbManager.addStudent({
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

app.put('/api/admin/students/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Remove read-only or system generated values
  delete updates.id;
  delete updates.certificate_hash;

  if (updates.percentage !== undefined) updates.percentage = Number(updates.percentage);
  if (updates.price !== undefined) updates.price = Number(updates.price);

  const updated = await dbManager.updateStudent(id, updates);
  if (!updated) {
    res.status(404).json({ error: 'الطالب غير موجود' });
    return;
  }

  res.json({ success: true, student: updated });
});

app.delete('/api/admin/students/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const deleted = await dbManager.deleteStudent(id);
  if (!deleted) {
    res.status(404).json({ error: 'الطالب غير موجود' });
    return;
  }
  res.json({ success: true });
});

// Re-issue student certificate (resets payment or changes cert hash for security validation)
app.post('/api/admin/students/:id/reissue', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const student = await dbManager.getStudentById(id);
  if (!student) {
    res.status(404).json({ error: 'الطالب غير موجود' });
    return;
  }

  // Re-issue generates a new hash by appending a fresh timestamp identifier
  const freshHash = 'CERT-' + crypto.createHash('md5')
    .update(`${student.seat_number}-${student.full_name}-${Date.now()}`)
    .digest('hex').substring(0, 10).toUpperCase();

  const updated = await dbManager.updateStudent(id, {
    certificate_hash: freshHash
  });

  res.json({ success: true, student: updated, message: 'تم إعادة إصدار كود التحقق الخاص بالشهادة بنجاح' });
});

// Payments List
app.get('/api/admin/payments', verifyAdmin, async (req, res) => {
  const payments = await dbManager.getPayments();
  const students = await dbManager.getStudents();

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
  // Seed database first on startup
  await seedDatabaseIfEmpty();

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
