import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Eye, CreditCard, Sparkles, AlertTriangle } from 'lucide-react';
import StudentSearch from './components/StudentSearch';
import StudentCertificate from './components/StudentCertificate';
import PaymentGateway from './components/PaymentGateway';
import CertificateVerify from './components/CertificateVerify';
import AdminPanel from './components/AdminPanel';
import { Student } from './types';

type AppView = 'search' | 'certificate' | 'gateway' | 'verify' | 'admin';

export default function App() {
  const [view, setView] = useState<AppView>('search');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  // Cashier Active Payment Transaction State
  const [activeTxn, setActiveTxn] = useState<{
    id: string;
    amount: number;
    signature: string;
  } | null>(null);

  // Active QR Verification Hash State
  const [verifyHash, setVerifyHash] = useState<string>('');

  // Logo secret click counter for accessing Admin
  const [logoClicks, setLogoClicks] = useState<number>(0);

  const handleLogoClick = () => {
    setView('search');
    setSelectedStudent(null);
    setLogoClicks((prev) => {
      const nextCount = prev + 1;
      if (nextCount >= 10) {
        setView('admin');
        return 0; // Reset counter on success
      }
      return nextCount;
    });
  };

  const handleKashierCallbackSuccess = async (merchantOrderId: string, paymentStatus: string, signature: string) => {
    try {
      const response = await fetch('/api/payments/kashier-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantOrderId,
          paymentStatus,
          signature
        })
      });
      const data = await response.json();
      if (response.ok && data.success && data.student) {
        setSelectedStudent(data.student);
        setView('certificate');
      } else {
        alert('تم الدفع بنجاح ولكن فشل تحديث قاعدة البيانات الرقمية للشهادة، الرجاء مراجعة الدعم.');
        setView('search');
        setSelectedStudent(null);
      }
    } catch (e) {
      alert('حدث خطأ أثناء الاتصال بالخادم للتحقق من السداد.');
      setView('search');
      setSelectedStudent(null);
    }
  };

  // Handle Scan QR / Deep Linking natively on mount
  useEffect(() => {
    const handleUrlRouting = () => {
      const path = window.location.pathname;
      const searchParams = new URLSearchParams(window.location.search);
      
      // 1. Kashier Redirection Callback Check
      const kashierCallback = searchParams.get('kashier_callback') === 'true';
      const paymentStatus = searchParams.get('paymentStatus');
      const merchantOrderId = searchParams.get('merchantOrderId');
      const kashierSignature = searchParams.get('signature');

      if (kashierCallback && merchantOrderId && paymentStatus) {
        // Clear query parameters from address bar to keep it clean
        window.history.pushState({}, '', '/');
        
        if (paymentStatus.toUpperCase() === 'SUCCESS') {
          handleKashierCallbackSuccess(merchantOrderId, paymentStatus, kashierSignature || '');
        } else {
          alert('عذراً، تم إلغاء أو فشلت عملية الدفع عبر كاشير. يرجى المحاولة مجدداً.');
          setView('search');
          setSelectedStudent(null);
        }
        return;
      }

      // 2. Direct Webhook Callback Redirect from Cashier Gateway
      const transactionId = searchParams.get('transactionId');
      const status = searchParams.get('status');
      
      if (view === 'gateway' && transactionId && status === 'success') {
        handlePaymentVerification(transactionId);
        return;
      }

      // 3. Direct QR code / Verify Path Routing
      if (path.startsWith('/verify/')) {
        const hash = path.split('/verify/')[1];
        if (hash) {
          setVerifyHash(hash);
          setView('verify');
        }
      } else if (path === '/payment-gateway') {
        // Fallback for gateway parameters
        const txnId = searchParams.get('transactionId');
        const amt = searchParams.get('amount');
        const sig = searchParams.get('signature');
        if (txnId && amt && sig) {
          setActiveTxn({
            id: txnId,
            amount: Number(amt),
            signature: sig
          });
          setView('gateway');
        }
      }
    };

    handleUrlRouting();
    
    // Add dynamic listeners for back/forward browser history
    window.addEventListener('popstate', handleUrlRouting);
    return () => window.removeEventListener('popstate', handleUrlRouting);
  }, [view]);

  // Safe Server-Side Payment Status verification
  const handlePaymentVerification = async (transactionId: string) => {
    try {
      // Direct inquiry to server DB instead of frontend query param!
      const response = await fetch(`/api/payments/verify?transactionId=${encodeURIComponent(transactionId)}`);
      const data = await response.json();
      
      if (response.ok && data.status === 'success' && data.studentId) {
        // Fetch student again - now updated to PAID
        const studentRes = await fetch(`/api/student/search?query=${encodeURIComponent(data.studentId)}`);
        const studentData = await studentRes.json();
        
        if (studentRes.ok) {
          setSelectedStudent(studentData.student);
          setView('certificate');
        } else {
          alert('تم السداد ولكن حدث خطأ أثناء تحميل بيانات الشهادة المحدثة.');
          setView('search');
          setSelectedStudent(null);
        }
      } else {
        alert('فشلت عملية التحقق من صحة المعاملة من خادم الدفع.');
        setView('search');
        setSelectedStudent(null);
      }
    } catch (e) {
      alert('حدث خطأ أثناء فحص سجل المعاملات بالسيرفر.');
      setView('search');
      setSelectedStudent(null);
    }
  };

  const handleSearchResult = (student: Student) => {
    setSelectedStudent(student);
    setView('certificate');
  };

  const handlePayRedirect = (checkoutUrl: string, initData?: any) => {
    // Parse query params from generated URL to load simulator in-app cleanly
    const urlObj = new URL(checkoutUrl, window.location.origin);
    const txnId = urlObj.searchParams.get('transactionId');
    const amt = urlObj.searchParams.get('amount');
    const sig = urlObj.searchParams.get('signature');

    if (txnId && amt && sig) {
      const mode = initData?.mode || 'simulator';
      if (mode === 'sandbox' || mode === 'production') {
        const baseUrl = mode === 'production' 
          ? 'https://checkout.kashier.co' 
          : 'https://test-checkout.kashier.co';
          
        const params = new URLSearchParams({
          merchantId: initData.merchantId || '',
          merchantOrderId: txnId,
          amount: amt,
          currency: 'EGP',
          hash: sig,
          mode: mode === 'production' ? 'live' : 'test',
          redirectUrl: `${window.location.origin}/?kashier_callback=true`
        });
        
        // Actually redirect the page!
        window.location.href = `${baseUrl}/?${params.toString()}`;
        return;
      }

      setActiveTxn({
        id: txnId,
        amount: Number(amt),
        signature: sig,
        mode: mode,
        merchantId: initData?.merchantId || '8e688370b0ecea73ff706a8aac9e3843',
        apiKey: initData?.apiKey || '55ea9130-fb8a-4d9e-953a-285b680b85e1'
      });
      // Set current URL state to mock real portal redirection
      window.history.pushState({}, '', checkoutUrl);
      setView('gateway');
    }
  };

  const handlePaymentComplete = async (success: boolean, transactionId: string) => {
    if (success) {
      // Clear URL state back to primary
      window.history.pushState({}, '', '/');
      await handlePaymentVerification(transactionId);
    } else {
      handleCancelPayment();
    }
  };

  const handleCancelPayment = () => {
    window.history.pushState({}, '', '/');
    setActiveTxn(null);
    setView('search');
    setSelectedStudent(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans text-gray-800">
      {/* 1. PUBLIC GOVERNMENT SITE HEADER */}
      {view !== 'gateway' && (
        <header className="bg-emerald-900 text-white shadow-md border-b-4 border-emerald-950 no-print">
          <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-3 cursor-pointer select-none" onClick={handleLogoClick}>
              <div className="w-10 h-10 rounded-full bg-emerald-800 flex items-center justify-center border border-emerald-700 shadow-inner">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-right">
                <span className="block font-black text-xs text-emerald-300 tracking-wide uppercase">معهد عبد الفتاح عزام بنين</span>
                <span className="block font-bold text-sm tracking-tight">نظام الاستعلام الرقمي والتوثيق المعتمد</span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold">
              <button
                onClick={() => { setView('search'); setSelectedStudent(null); }}
                className={`hover:text-emerald-300 transition-colors cursor-pointer ${view === 'search' || view === 'certificate' ? 'text-emerald-300 border-b-2 border-emerald-300 pb-0.5' : ''}`}
              >
                الاستعلام والنتائج
              </button>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 font-mono px-2 py-1 rounded-full border border-emerald-800">
                SSL SECURE
              </span>
            </div>
          </div>
        </header>
      )}

      {/* 2. DYNAMIC VIEW CONTAINER */}
      <main className="flex-1">
        {view === 'search' && (
          <StudentSearch
            onSearchResult={handleSearchResult}
            onNavigateToVerify={(hash) => {
              setVerifyHash(hash);
              setView('verify');
            }}
          />
        )}

        {view === 'certificate' && selectedStudent && (
          <StudentCertificate
            student={selectedStudent}
            onBack={() => {
              setView('search');
              setSelectedStudent(null);
            }}
            onPayRedirect={handlePayRedirect}
          />
        )}

        {view === 'gateway' && activeTxn && (
          <PaymentGateway
            transactionId={activeTxn.id}
            amount={activeTxn.amount}
            signature={activeTxn.signature}
            mode={activeTxn.mode}
            merchantId={activeTxn.merchantId}
            apiKey={activeTxn.apiKey}
            onPaymentComplete={handlePaymentComplete}
            onCancel={handleCancelPayment}
          />
        )}

        {view === 'verify' && (
          <CertificateVerify
            hash={verifyHash}
            onBackToHome={() => {
              setView('search');
              setSelectedStudent(null);
              window.history.pushState({}, '', '/');
            }}
          />
        )}

        {view === 'admin' && (
          <AdminPanel
            onBackToSearch={() => {
              setView('search');
              setSelectedStudent(null);
            }}
          />
        )}
      </main>

      {/* 3. FOOTER */}
      {view !== 'gateway' && (
        <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 text-xs py-6 mt-12 no-print">
          <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-right space-y-1">
              <span className="font-bold text-slate-200 block">نظام توثيق وحماية الشهادات القومي</span>
              <span>جميع الحقوق محفوظة © معهد عبد الفتاح عزام بنين - جمهورية مصر العربية 2026</span>
            </div>
            <div className="flex gap-4 text-[10px] text-slate-500 font-medium">
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-500" />
                تأمين الاتصال SSL/HTTPS فعال
              </span>
              <span>بوابة كاشير مرخصة</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
