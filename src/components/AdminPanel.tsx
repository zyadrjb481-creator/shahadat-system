import React, { useState, useEffect } from 'react';
import { 
  Users, CreditCard, DollarSign, Percent, Plus, Edit2, Trash2, RefreshCw, 
  Search, ShieldAlert, LogIn, LogOut, ArrowRight, Save, X, Eye, Check, AlertCircle,
  Settings, Key, Globe, Lock
} from 'lucide-react';
import { Student, Payment, AdminStats } from '../types';
import { getApiUrl } from '../config';

interface AdminPanelProps {
  onBackToSearch: () => void;
}

export default function AdminPanel({ onBackToSearch }: AdminPanelProps) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('admin_token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Tabs: 'dashboard' | 'students' | 'payments' | 'gateway'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'students' | 'payments' | 'gateway'>('dashboard');

  // Dashboard stats
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  // Search/Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all');

  // Student Form states (Create/Edit)
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [seatNumber, setSeatNumber] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [fullName, setFullName] = useState('');
  const [grade, setGrade] = useState('ممتاز');
  const [percentage, setPercentage] = useState<number>(90);
  const [schoolName, setSchoolName] = useState('مدرسة المتفوقين الثانوية للبنين');
  const [schoolYear, setSchoolYear] = useState('2025 - 2026');
  const [price, setPrice] = useState<number>(150);

  // Kashier Gateway Config States
  const [gatewayMerchantId, setGatewayMerchantId] = useState('');
  const [gatewayApiKey, setGatewayApiKey] = useState('');
  const [gatewayApiSecret, setGatewayApiSecret] = useState('');
  const [gatewayMode, setGatewayMode] = useState<'simulator' | 'sandbox' | 'production'>('simulator');
  const [gatewaySaving, setGatewaySaving] = useState(false);

  interface SubjectGradeItem {
    id: string;
    name: string;
    maxGrade: number;
    grade: number;
  }

  const [subjectItems, setSubjectItems] = useState<SubjectGradeItem[]>([]);

  const loadGeneralEducationPresets = () => {
    setSubjectItems([
      { id: 'gen-1', name: 'اللغة العربية', maxGrade: 80, grade: 75 },
      { id: 'gen-2', name: 'اللغة الإنجليزية', maxGrade: 60, grade: 45 },
      { id: 'gen-3', name: 'الرياضيات البحوتة', maxGrade: 60, grade: 55 },
      { id: 'gen-4', name: 'الفيزياء', maxGrade: 60, grade: 50 },
      { id: 'gen-5', name: 'الكيمياء', maxGrade: 60, grade: 52 },
    ]);
  };

  const loadAzharPresets = () => {
    setSubjectItems([
      { id: 'azhar-1', name: 'القرآن الكريم', maxGrade: 100, grade: 90 },
      { id: 'azhar-2', name: 'الفقه الشافعي/الحنفي', maxGrade: 40, grade: 35 },
      { id: 'azhar-3', name: 'الحديث وعلومه', maxGrade: 40, grade: 36 },
      { id: 'azhar-4', name: 'التفسير', maxGrade: 40, grade: 38 },
      { id: 'azhar-5', name: 'التوحيد', maxGrade: 40, grade: 34 },
      { id: 'azhar-6', name: 'النحو والصرف', maxGrade: 40, grade: 37 },
      { id: 'azhar-7', name: 'اللغة العربية (المطالعة والنصوص)', maxGrade: 40, grade: 35 },
      { id: 'azhar-8', name: 'اللغة الإنجليزية', maxGrade: 60, grade: 45 },
    ]);
  };

  const addCustomSubject = () => {
    setSubjectItems(prev => [
      ...prev,
      {
        id: `custom-${Date.now()}-${Math.random()}`,
        name: '',
        maxGrade: 100,
        grade: 0
      }
    ]);
  };

  const removeSubject = (id: string) => {
    setSubjectItems(prev => prev.filter(item => item.id !== id));
  };

  const updateSubjectItem = (id: string, field: 'name' | 'maxGrade' | 'grade', value: any) => {
    setSubjectItems(prev => prev.map(item => {
      if (item.id === id) {
        if (field === 'maxGrade') {
          return { ...item, maxGrade: Number(value) || 0 };
        }
        if (field === 'grade') {
          return { ...item, grade: Number(value) || 0 };
        }
        return { ...item, name: value };
      }
      return item;
    }));
  };

  // Auto-calculate percentage when subjectItems changes
  useEffect(() => {
    const totalGrades = subjectItems.reduce((acc, item) => acc + item.grade, 0);
    const totalMax = subjectItems.reduce((acc, item) => acc + item.maxGrade, 0);
    const calculatedPercentage = totalMax > 0 ? Number(((totalGrades / totalMax) * 100).toFixed(1)) : 0;
    setPercentage(calculatedPercentage);
  }, [subjectItems]);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Check login on startup
  useEffect(() => {
    if (token) {
      fetchAdminData();
    }
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoading(true);

    try {
      const response = await fetch(getApiUrl('/api/admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'فشل تسجيل الدخول');
      }

      localStorage.setItem('admin_token', data.token);
      setToken(data.token);
      showToast('مرحباً بك في لوحة تحكم الإدارة الآمنة', 'success');
    } catch (err: any) {
      setLoginError(err.message || 'اسم المستخدم أو كلمة المرور غير صحيحة');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(getApiUrl('/api/admin/logout'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('admin_token');
    setToken(null);
    setStats(null);
    setStudents([]);
    setPayments([]);
  };

  const fetchAdminData = async () => {
    if (!token) return;
    setLoading(true);

    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch Stats
      const statsRes = await fetch(getApiUrl('/api/admin/stats'), { headers });
      const statsData = await statsRes.json();
      if (statsRes.status === 401 || statsRes.status === 403) {
        handleLogout();
        return;
      }
      setStats(statsData);

      // Fetch Students
      const studentsRes = await fetch(getApiUrl('/api/admin/students'), { headers });
      const studentsData = await studentsRes.json();
      setStudents(studentsData.students);

      // Fetch Payments
      const paymentsRes = await fetch(getApiUrl('/api/admin/payments'), { headers });
      const paymentsData = await paymentsRes.json();
      setPayments(paymentsData.payments);

      // Fetch Gateway Config
      const gatewayRes = await fetch(getApiUrl('/api/admin/gateway-config'), { headers });
      if (gatewayRes.ok) {
        const gatewayData = await gatewayRes.json();
        const cfg = gatewayData.gatewayConfig;
        if (cfg) {
          setGatewayMerchantId(cfg.merchantId || '');
          setGatewayApiKey(cfg.apiKey || '');
          setGatewayApiSecret(cfg.apiSecret || '');
          setGatewayMode(cfg.mode || 'simulator');
        }
      }
    } catch (err) {
      showToast('فشل تحميل بيانات لوحة الإدارة', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGatewayConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gatewayMerchantId || !gatewayApiKey || !gatewayApiSecret) {
      showToast('جميع الحقول مطلوبة لتكوين كاشير', 'error');
      return;
    }
    setGatewaySaving(true);
    try {
      const response = await fetch(getApiUrl('/api/admin/gateway-config'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          merchantId: gatewayMerchantId,
          apiKey: gatewayApiKey,
          apiSecret: gatewayApiSecret,
          mode: gatewayMode
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'فشل حفظ الإعدادات');
      }
      showToast('تم حفظ إعدادات بوابة كاشير بنجاح وقفل التشفير الرقمي', 'success');
      fetchAdminData();
    } catch (err: any) {
      showToast(err.message || 'فشل حفظ التكوين المالي', 'error');
    } finally {
      setGatewaySaving(false);
    }
  };

  const openAddModal = () => {
    setEditingStudent(null);
    setFormError(null);
    setSeatNumber('');
    setNationalId('');
    setFullName('');
    setGrade('ممتاز');
    setPercentage(90);
    setSchoolName('مدرسة المتفوقين الثانوية للبنين');
    setSchoolYear('2025 - 2026');
    setPrice(150);
    loadGeneralEducationPresets();
    setShowModal(true);
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setFormError(null);
    setSeatNumber(student.seat_number);
    setNationalId(student.national_id);
    setFullName(student.full_name);
    setGrade(student.grade);
    setPercentage(student.percentage);
    setSchoolName(student.school_name);
    setSchoolYear(student.school_year);
    setPrice(student.price);
    
    if (student.subject_grades && Object.keys(student.subject_grades).length > 0) {
      const parsedItems: SubjectGradeItem[] = Object.entries(student.subject_grades).map(([key, value], index) => {
        let name = key;
        let maxGrade = key.includes('اللغة العربية') ? 80 : 60;
        if (key.includes('|')) {
          const parts = key.split('|');
          name = parts[0];
          maxGrade = Number(parts[1]) || 60;
        }
        return {
          id: `sub-${index}-${Date.now()}`,
          name,
          maxGrade,
          grade: value
        };
      });
      setSubjectItems(parsedItems);
    } else {
      loadGeneralEducationPresets();
    }
    setShowModal(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!seatNumber.trim() || !nationalId.trim() || !fullName.trim() || !schoolName.trim() || !schoolYear.trim()) {
      setFormError('الرجاء تعبئة كافة الحقول الأساسية للطالب');
      return;
    }

    if (nationalId.length !== 14) {
      setFormError('الرقم القومي المصري يجب أن يكون مكوناً من 14 رقماً بالضبط');
      return;
    }

    // Serialize subjectItems to Record<string, number>
    const serializedGrades: Record<string, number> = {};
    subjectItems.forEach(item => {
      if (item.name.trim()) {
        const key = `${item.name.trim()}|${item.maxGrade}`;
        serializedGrades[key] = item.grade;
      }
    });

    const payload = {
      seat_number: seatNumber.trim(),
      national_id: nationalId.trim(),
      full_name: fullName.trim(),
      grade,
      percentage: Number(percentage),
      school_name: schoolName.trim(),
      school_year: schoolYear.trim(),
      price: Number(price),
      subject_grades: serializedGrades
    };

    try {
      const url = editingStudent 
        ? getApiUrl(`/api/admin/students/${editingStudent.id}`) 
        : getApiUrl('/api/admin/students');
      
      const method = editingStudent ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'فشلت عملية الحفظ');
      }

      showToast(editingStudent ? 'تم تعديل بيانات الطالب بنجاح' : 'تمت إضافة الطالب الجديد بنجاح', 'success');
      setShowModal(false);
      fetchAdminData();
    } catch (err: any) {
      setFormError(err.message || 'فشلت معالجة البيانات، الرجاء المحاولة مرة أخرى');
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا الطالب نهائياً من سجلات الوزارة؟ لا يمكن التراجع عن هذا الإجراء.')) {
      return;
    }

    try {
      const response = await fetch(getApiUrl(`/api/admin/students/${id}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'فشل حذف الطالب');
      }

      showToast('تم حذف الطالب بنجاح من قاعدة البيانات', 'success');
      fetchAdminData();
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ أثناء الحذف', 'error');
    }
  };

  const handleReissueCert = async (id: string) => {
    try {
      const response = await fetch(getApiUrl(`/api/admin/students/${id}/reissue`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'فشل إعادة الإصدار');
      }

      showToast(`تم إعادة إصدار كود التحقق بنجاح: ${data.student.certificate_hash}`, 'success');
      fetchAdminData();
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ أثناء تدوير كود التوثيق', 'error');
    }
  };



  // Client filtering
  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.full_name.includes(searchQuery) ||
      student.seat_number.includes(searchQuery) ||
      student.national_id.includes(searchQuery);

    if (filterPaid === 'paid') return matchesSearch && student.is_paid;
    if (filterPaid === 'unpaid') return matchesSearch && !student.is_paid;
    return matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8" dir="rtl">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg border text-sm font-semibold transition-all ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {toast.type === 'success' ? <Check className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 1. ADMIN LOGIN FORM */}
      {!token ? (
        <div className="max-w-md mx-auto my-12 bg-white rounded-2xl border border-gray-150 p-6 sm:p-8 shadow-xs">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 text-slate-700 border border-gray-200 mb-3">
              <ShieldAlert className="w-6 h-6 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">تسجيل دخول المسؤول الأمن</h2>
            <p className="text-xs text-gray-400 mt-1">لوحة تحكم إدارة السجلات وإصدار الشهادات وتتبع المدفوعات</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المستخدم</label>
              <input
                type="text"
                required
                placeholder="أدخل اسم المستخدم (admin)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full px-4 py-2.5 text-gray-900 border border-gray-300 rounded-lg text-sm text-right focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">كلمة المرور</label>
              <input
                type="password"
                required
                placeholder="أدخل كلمة المرور (password123)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-4 py-2.5 text-gray-900 border border-gray-300 rounded-lg text-sm text-right focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {loginError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs border border-red-100 font-medium">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? 'جاري التحقق من الرموز...' : 'تسجيل الدخول الآمن'}</span>
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <button
              onClick={onBackToSearch}
              className="text-xs text-gray-500 hover:text-gray-800 transition-colors flex items-center justify-center gap-1 mx-auto cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>العودة لبوابة الاستعلام الرئيسية</span>
            </button>
          </div>
        </div>
      ) : (
        /* 2. ADMIN SECURED WORKSPACE */
        <div className="space-y-6">
          {/* Workspace Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">لوحة الإشراف العام والاعتماد والتوثيق</h2>
              <p className="text-xs text-gray-400 mt-1">مسجل دخول بصفة مسؤول النظام. إمكانية إدارة النتائج والتحقق من Webhooks بوابة كاشير.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchAdminData}
                className="inline-flex items-center justify-center w-9 h-9 text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-300 bg-white rounded-lg transition-colors cursor-pointer"
                title="تحديث البيانات"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={onBackToSearch}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-900/10 text-gray-700 hover:bg-gray-50 text-xs font-semibold rounded-lg transition-all cursor-pointer bg-white"
              >
                <Eye className="w-4 h-4 text-emerald-600" />
                <span>عرض البوابة</span>
              </button>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition-all cursor-pointer border border-red-200"
              >
                <LogOut className="w-4 h-4" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-200 gap-6 text-sm font-semibold overflow-x-auto whitespace-nowrap">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`pb-3 transition-colors cursor-pointer ${activeTab === 'dashboard' ? 'border-b-2 border-emerald-600 text-emerald-700 font-extrabold' : 'text-gray-400 hover:text-gray-600'}`}
            >
              الإحصائيات والتحليلات
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className={`pb-3 transition-colors cursor-pointer ${activeTab === 'students' ? 'border-b-2 border-emerald-600 text-emerald-700 font-extrabold' : 'text-gray-400 hover:text-gray-600'}`}
            >
              إدارة الطلاب والشهادات ({students.length})
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`pb-3 transition-colors cursor-pointer ${activeTab === 'payments' ? 'border-b-2 border-emerald-600 text-emerald-700 font-extrabold' : 'text-gray-400 hover:text-gray-600'}`}
            >
              سجل مدفوعات كاشير ({payments.length})
            </button>
            <button
              onClick={() => setActiveTab('gateway')}
              className={`pb-3 transition-colors cursor-pointer ${activeTab === 'gateway' ? 'border-b-2 border-emerald-600 text-emerald-700 font-extrabold' : 'text-gray-400 hover:text-gray-600'}`}
            >
              إعدادات بوابة كاشير
            </button>
          </div>

          {/* STATS OVERVIEW TAB */}
          {activeTab === 'dashboard' && stats && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white border border-gray-150 rounded-xl p-5 flex items-center justify-between shadow-3xs">
                  <div>
                    <span className="text-xs text-gray-400 block font-bold">إجمالي الطلاب</span>
                    <strong className="text-2xl font-black text-gray-900 mt-1 block">{stats.totalStudents}</strong>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white border border-gray-150 rounded-xl p-5 flex items-center justify-between shadow-3xs">
                  <div>
                    <span className="text-xs text-gray-400 block font-bold">شهادات مفعلة/مدفوعة</span>
                    <strong className="text-2xl font-black text-emerald-700 mt-1 block">
                      {stats.paidStudents} <span className="text-xs font-normal text-gray-400">طالب</span>
                    </strong>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Check className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white border border-gray-150 rounded-xl p-5 flex items-center justify-between shadow-3xs">
                  <div>
                    <span className="text-xs text-gray-400 block font-bold">نسبة التحصيل</span>
                    <strong className="text-2xl font-black text-emerald-700 mt-1 block">
                      {stats.totalStudents > 0 ? Math.round((stats.paidStudents / stats.totalStudents) * 100) : 0}%
                    </strong>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                    <Percent className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white border border-gray-150 rounded-xl p-5 flex items-center justify-between shadow-3xs">
                  <div>
                    <span className="text-xs text-gray-400 block font-bold">مدفوعات قيد السداد</span>
                    <strong className="text-2xl font-black text-amber-600 mt-1 block">{stats.pendingPayments}</strong>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <CreditCard className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white border border-gray-150 rounded-xl p-5 flex items-center justify-between shadow-3xs">
                  <div>
                    <span className="text-xs text-gray-400 block font-bold">إجمالي الإيرادات (كاشير)</span>
                    <strong className="text-2xl font-black text-slate-900 mt-1 block">{stats.totalRevenue} ج.م</strong>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Quick Info Box */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 flex flex-col md:flex-row justify-between gap-4 items-center">
                <div className="space-y-1 text-center md:text-right">
                  <h3 className="font-bold text-gray-900">سيرفر معالجة الويب هوك الخاص بكاشير (Webhook Endpoint)</h3>
                  <p className="text-xs text-gray-500">يتلقى السيرفر التحديثات الفورية للمعاملات مباشرة وبشكل آمن ويوقع الـ Callback لمنع أي اختراق أو تحايل من العميل.</p>
                </div>
                <div className="bg-slate-900 text-white font-mono text-xs px-3.5 py-2 rounded-lg border border-slate-750 select-all">
                  POST /api/payments/webhook
                </div>
              </div>
            </div>
          )}

          {/* STUDENTS MANAGEMENT TAB */}
          {activeTab === 'students' && (
            <div className="space-y-4">
              {/* Controls */}
              <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
                {/* Search / Filters */}
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="البحث بالاسم أو رقم الجلوس..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="block w-full sm:w-64 px-4 py-2 pr-9 text-gray-900 border border-gray-300 rounded-lg text-xs"
                    />
                    <Search className="w-4 h-4 text-gray-400 absolute right-3 top-2.5" />
                  </div>

                  <select
                    value={filterPaid}
                    onChange={(e: any) => setFilterPaid(e.target.value)}
                    className="block px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs"
                  >
                    <option value="all">كل الشهادات</option>
                    <option value="paid">الشهادات المفعلة / المدفوعة</option>
                    <option value="unpaid">الشهادات قيد الدفع</option>
                  </select>
                </div>

                {/* Add Student Button */}
                <button
                  onClick={openAddModal}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة طالب / رفع شهادة</span>
                </button>
              </div>

              {/* Students List Table */}
              <div className="bg-white border border-gray-150 rounded-xl overflow-hidden shadow-3xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-gray-600 border-b border-gray-150 font-bold">
                      <tr>
                        <th className="px-4 py-3">رقم الجلوس</th>
                        <th className="px-4 py-3">اسم الطالب</th>
                        <th className="px-4 py-3">المدرسة</th>
                        <th className="px-4 py-3 text-center">النسبة والتقدير</th>
                        <th className="px-4 py-3 text-center">رسوم الشهادة</th>
                        <th className="px-4 py-3 text-center">الحالة</th>
                        <th className="px-4 py-3 text-center">كود التوثيق المعلق</th>
                        <th className="px-4 py-3 text-center">الإجراءات والتحكم</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-gray-400 font-medium">
                            لا توجد سجلات مطابقة لمعايير البحث الحالية.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((student) => (
                          <tr key={student.id} className="hover:bg-slate-50/55 transition-colors">
                            <td className="px-4 py-3 font-mono font-bold text-gray-900">{student.seat_number}</td>
                            <td className="px-4 py-3">
                              <span className="font-semibold text-gray-900 block">{student.full_name}</span>
                              <span className="text-[10px] text-gray-400 font-mono">الرقم القومي: {student.national_id}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-500">{student.school_name}</td>
                            <td className="px-4 py-3 text-center">
                              <strong className="text-gray-900 font-bold block">{student.percentage}%</strong>
                              <span className="text-[10px] text-gray-400 block">{student.grade}</span>
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-emerald-800">
                              {student.price === 0 ? 'مجانية' : `${student.price} ج.م`}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${student.is_paid ? 'bg-green-50 text-green-700 border border-green-150' : 'bg-amber-50 text-amber-700 border border-amber-150'}`}>
                                {student.is_paid ? 'مدفوعة / مفعلة' : 'بانتظار الدفع'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-gray-500 text-[10px] select-all">
                              {student.certificate_hash}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => openEditModal(student)}
                                  className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                  title="تعديل بيانات الطالب والمواد"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleReissueCert(student.id)}
                                  className="p-1 text-teal-600 hover:text-teal-900 hover:bg-teal-50 rounded transition-colors cursor-pointer"
                                  title="إعادة إصدار الشهادة وتدوير الـ QR"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteStudent(student.id)}
                                  className="p-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                  title="حذف الطالب بشكل نهائي"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PAYMENTS LOG TAB */}
          {activeTab === 'payments' && (
            <div className="bg-white border border-gray-150 rounded-xl overflow-hidden shadow-3xs">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-gray-600 border-b border-gray-150 font-bold">
                    <tr>
                      <th className="px-4 py-3">رقم العملية (Transaction ID)</th>
                      <th className="px-4 py-3">اسم الطالب</th>
                      <th className="px-4 py-3">رقم الجلوس</th>
                      <th className="px-4 py-3 text-center">وسيلة السداد</th>
                      <th className="px-4 py-3 text-center">المبلغ</th>
                      <th className="px-4 py-3 text-center">تاريخ الدفع</th>
                      <th className="px-4 py-3 text-center">حالة العملية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-400 font-medium">
                          لا توجد عمليات سداد مسجلة بالنظام حتى الآن.
                        </td>
                      </tr>
                    ) : (
                      payments.slice().reverse().map((payment) => (
                        <tr key={payment.id} className="hover:bg-slate-50/55 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-gray-900 select-all">{payment.transaction_id}</td>
                          <td className="px-4 py-3 font-semibold text-gray-900">{payment.student_name}</td>
                          <td className="px-4 py-3 font-mono text-gray-500">{payment.seat_number}</td>
                          <td className="px-4 py-3 text-center text-gray-600">
                            {payment.payment_method === 'credit_card' ? 'بطاقة بنكية' : payment.payment_method === 'vodafone_cash' ? 'محفظة هاتف' : 'فوري (Fawry)'}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-emerald-800">{payment.amount} ج.م</td>
                          <td className="px-4 py-3 text-center text-gray-400">
                            {new Date(payment.created_at).toLocaleString('ar-EG')}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black border ${payment.status === 'success' ? 'bg-green-50 text-green-700 border-green-150' : payment.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-150' : 'bg-red-50 text-red-700 border-red-150'}`}>
                              {payment.status === 'success' ? 'مقبولة وناجحة' : payment.status === 'pending' ? 'معلقة / انتظار' : 'مرفوضة / فشلت'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* KASHIER GATEWAY SETTINGS TAB */}
          {activeTab === 'gateway' && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-150 rounded-xl p-6 shadow-3xs">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-6">
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-gray-900 text-base">إعدادات بوابة الدفع الإلكتروني كاشير (Kashier)</h3>
                    <p className="text-xs text-gray-400 mt-0.5">قم بتهيئة مفاتيح الاتصال والتشفير لتفعيل التحصيل الإلكتروني الحقيقي لقيم الشهادات.</p>
                  </div>
                </div>

                <form onSubmit={handleSaveGatewayConfig} className="space-y-6">
                  {/* Gateway Mode Switcher */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-700">وضع بوابة الدفع والتحقق</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setGatewayMode('simulator')}
                        className={`flex flex-col p-4 rounded-xl border text-right transition-all cursor-pointer ${gatewayMode === 'simulator' ? 'border-emerald-500 bg-emerald-50/40 text-emerald-950 shadow-3xs' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'}`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-extrabold text-xs">1. محاكاة تجريبية آمنة (Simulator)</span>
                          <span className={`w-2.5 h-2.5 rounded-full ${gatewayMode === 'simulator' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`}></span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">تسمح لك باختبار دورة الدفع الكاملة والويب هوك بدون الحاجة لحساب كاشير حقيقي. رائعة للعرض الفوري والتطوير.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setGatewayMode('sandbox')}
                        className={`flex flex-col p-4 rounded-xl border text-right transition-all cursor-pointer ${gatewayMode === 'sandbox' ? 'border-amber-500 bg-amber-50/40 text-amber-950 shadow-3xs' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'}`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-extrabold text-xs">2. بيئة كاشير التجريبية (Sandbox)</span>
                          <span className={`w-2.5 h-2.5 rounded-full ${gatewayMode === 'sandbox' ? 'bg-amber-500 animate-pulse' : 'bg-gray-300'}`}></span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">تتصل مباشرة بخوادم كاشير التجريبية الحقيقية (test-checkout.kashier.co). يمكنك استخدام بطاقات كاشير الاختبارية لتأكيد نجاح السيرفر.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setGatewayMode('production')}
                        className={`flex flex-col p-4 rounded-xl border text-right transition-all cursor-pointer ${gatewayMode === 'production' ? 'border-red-500 bg-red-50/40 text-red-950 shadow-3xs' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'}`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-extrabold text-xs">3. البيئة الحية الحقيقية (Production)</span>
                          <span className={`w-2.5 h-2.5 rounded-full ${gatewayMode === 'production' ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`}></span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">التحصيل المالي الحقيقي من العملاء. سيتم توجيه الطلاب مباشرة إلى بوابة الدفع الحية لكاشير وإيداع الأموال بحسابك البنكي.</p>
                      </button>
                    </div>
                  </div>

                  {/* Credentials Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        <span>معرّف التاجر الخاص بكاشير (Merchant ID)</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={gatewayMerchantId}
                        onChange={(e) => setGatewayMerchantId(e.target.value)}
                        placeholder="أدخل معرّف التاجر الخاص بكاشير"
                        className="block w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-mono text-gray-900 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-gray-400" />
                        <span>مفتاح الـ API العام (API Key / iframe Key)</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={gatewayApiKey}
                        onChange={(e) => setGatewayApiKey(e.target.value)}
                        placeholder="أدخل مفتاح الـ API العام أو iframe id"
                        className="block w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-mono text-gray-900 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white transition-all"
                      />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-gray-400" />
                        <span>مفتاح التشفير السري للتوقيع الرقمي (Signature Secret Key)</span>
                      </label>
                      <input
                        type="password"
                        required
                        value={gatewayApiSecret}
                        onChange={(e) => setGatewayApiSecret(e.target.value)}
                        placeholder="أدخل المفتاح السري لتوقيع معاملات كاشير (HMAC-SHA256)"
                        className="block w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-mono text-gray-900 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white transition-all"
                      />
                      <span className="text-[10px] text-gray-400 block pt-0.5 leading-relaxed">
                        يتم تشفير هذا المفتاح وتخزينه في الخادم بصفة سرية مطلقة، ويُسخدم لتوقيع معاملات الدفع والتحقق من صحة Webhooks لمنع أي تلاعب بالشهادات من طرف المتصفح.
                      </span>
                    </div>
                  </div>

                  {/* Informational Alert */}
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-extrabold text-gray-900 flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-emerald-600 animate-spin" />
                      <span>ربط الـ Webhook التلقائي بكاشير لمزامنة الدفع الفوري للطلاب:</span>
                    </h4>
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                      لكي يتم تفعيل الشهادة للطالب تلقائياً وبشكل آمن وفوري بمجرد إتمام السداد بنجاح، قم بنسخ الرابط التالي ولصقه في حقل <strong>"Webhook / Callback URL"</strong> داخل لوحة تحكم التاجر الخاصة بك في كاشير (Kashier Dashboard):
                    </p>
                    <div className="flex items-center justify-between gap-4 bg-slate-900 text-white p-3 rounded-lg border border-slate-750">
                      <div className="font-mono text-[10px] select-all overflow-x-auto whitespace-nowrap scrollbar-none flex-1 pl-2">
                        {window.location.origin}/api/payments/webhook
                      </div>
                      <span className="text-[9px] bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md font-bold shrink-0">نشط وآمن</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4 border-t border-gray-100">
                    <button
                      type="submit"
                      disabled={gatewaySaving}
                      className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 rounded-lg transition-colors shadow-xs cursor-pointer"
                    >
                      {gatewaySaving ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>جاري قفل وتوثيق التكوين المالي...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>حفظ وتفعيل إعدادات كاشير</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* STUDENT FORM MODAL (ADD / EDIT) */}
          {showModal && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 flex flex-col">
                <div className="p-5 border-b border-gray-150 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                  <h3 className="font-bold text-gray-900 text-sm sm:text-base flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-600" />
                    {editingStudent ? 'تعديل بيانات الطالب والدرجات' : 'إضافة طالب جديد وحفظ المواد'}
                  </h3>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-1 hover:bg-gray-200 rounded-full transition-colors cursor-pointer text-gray-400 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveStudent} className="p-6 overflow-y-auto space-y-6 text-right">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-gray-900 text-xs border-b border-gray-100 pb-2">1. البيانات الأساسية للطالب</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">الاسم الكامل للطالب</label>
                        <input
                          type="text"
                          required
                          placeholder="أحمد علي..."
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="block w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-lg text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">الرقم القومي (14 رقماً)</label>
                        <input
                          type="text"
                          maxLength={14}
                          required
                          placeholder="30501011234567"
                          value={nationalId}
                          onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ''))}
                          className="block w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-lg text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">رقم الجلوس</label>
                        <input
                          type="text"
                          required
                          placeholder="1004"
                          value={seatNumber}
                          onChange={(e) => setSeatNumber(e.target.value)}
                          className="block w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-lg text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">المدرسة</label>
                        <input
                          type="text"
                          required
                          value={schoolName}
                          onChange={(e) => setSchoolName(e.target.value)}
                          className="block w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-lg text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">العام الدراسي</label>
                        <input
                          type="text"
                          required
                          value={schoolYear}
                          onChange={(e) => setSchoolYear(e.target.value)}
                          className="block w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-lg text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">التقدير العام للنتيجة</label>
                        <select
                          value={grade}
                          onChange={(e) => setGrade(e.target.value)}
                          className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs"
                        >
                          <option value="ممتاز">ممتاز</option>
                          <option value="جيد جداً">جيد جداً</option>
                          <option value="جيد">جيد</option>
                          <option value="مقبول">مقبول</option>
                          <option value="ضعيف">ضعيف</option>
                        </select>
                      </div>

                       <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                          النسبة المئوية الإجمالية (%) <span className="text-[10px] text-emerald-600 font-bold mr-1">(تُحسب تلقائياً)</span>
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          required
                          disabled
                          value={percentage}
                          className="block w-full px-3 py-2 text-gray-500 bg-slate-100 border border-gray-300 rounded-lg text-xs font-mono cursor-not-allowed font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">سعر الشهادة (0 للمجانية)</label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={price}
                          onChange={(e) => setPrice(Number(e.target.value))}
                          className="block w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-lg text-xs font-mono"
                        />
                        <span className="text-[10px] text-gray-400">تنبيه: تحديد السعر 0 سيجعل تحميل الشهادة مجاناً فوراً دون بوابة كاشير.</span>
                      </div>
                    </div>
                  </div>

                  {/* Subject Grades Form */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
                      <h4 className="font-bold text-gray-900 text-xs">2. تفاصيل درجات المواد الدراسية</h4>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={loadGeneralEducationPresets}
                          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md border border-blue-200 transition-colors cursor-pointer"
                        >
                          تحميل مواد التربية والتعليم
                        </button>
                        <button
                          type="button"
                          onClick={loadAzharPresets}
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-md border border-emerald-200 transition-colors cursor-pointer"
                        >
                          تحميل مواد الأزهر الشريف
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {subjectItems.length === 0 ? (
                        <p className="text-gray-400 text-xs text-center py-2">لا توجد مواد مضافة حالياً. اختر شعبة من الأعلى أو أضف مادة مخصصة.</p>
                      ) : (
                        <div className="space-y-2">
                          {subjectItems.map((item) => (
                            <div key={item.id} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <div className="flex-1 min-w-[120px]">
                                <label className="block text-[8px] text-gray-400 font-bold mb-0.5">اسم المادة الدراسية</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="اسم المادة (مثال: القرآن الكريم)"
                                  value={item.name}
                                  onChange={(e) => updateSubjectItem(item.id, 'name', e.target.value)}
                                  className="block w-full px-2 py-1 text-gray-900 border border-gray-300 rounded-md text-xs"
                                />
                              </div>
                              <div className="w-20">
                                <label className="block text-[8px] text-gray-400 font-bold mb-0.5">درجة الطالب</label>
                                <input
                                  type="number"
                                  min="0"
                                  max={item.maxGrade}
                                  required
                                  value={item.grade}
                                  onChange={(e) => updateSubjectItem(item.id, 'grade', Number(e.target.value))}
                                  className="block w-full px-2 py-1 text-gray-900 border border-gray-300 rounded-md text-xs font-mono"
                                />
                              </div>
                              <div className="w-20">
                                <label className="block text-[8px] text-gray-400 font-bold mb-0.5">الدرجة العظمى</label>
                                <input
                                  type="number"
                                  min="1"
                                  required
                                  value={item.maxGrade}
                                  onChange={(e) => updateSubjectItem(item.id, 'maxGrade', Number(e.target.value))}
                                  className="block w-full px-2 py-1 text-gray-900 border border-gray-300 rounded-md text-xs font-mono"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => removeSubject(item.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-md transition-colors mt-3.5 cursor-pointer"
                                title="حذف المادة"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={addCustomSubject}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>إضافة مادة مخصصة أخرى</span>
                      </button>
                    </div>
                  </div>

                  {formError && (
                    <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs border border-red-100 font-medium">
                      {formError}
                    </div>
                  )}

                  <div className="flex gap-2 pt-4 border-t border-gray-150">
                    <button
                      type="submit"
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>حفظ البيانات</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
