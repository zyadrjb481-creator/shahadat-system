import React, { useState, useEffect } from 'react';
import { ShieldAlert, CreditCard, Lock, ArrowLeft, Smartphone, Check, Loader2, Sparkles, Building2 } from 'lucide-react';
import { getApiUrl } from '../config';

interface PaymentGatewayProps {
  transactionId: string;
  amount: number;
  signature: string;
  mode?: string;
  merchantId?: string;
  apiKey?: string;
  onPaymentComplete: (success: boolean, transactionId: string) => void;
  onCancel: () => void;
}

export default function PaymentGateway({ transactionId, amount, signature, mode = 'simulator', merchantId, apiKey, onPaymentComplete, onCancel }: PaymentGatewayProps) {
  const [method] = useState<'wallet'>('wallet');
  const [processing, setProcessing] = useState(false);
  const [walletPhone, setWalletPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPaidSuccess, setIsPaidSuccess] = useState(false);

  // Form validations
  const validateForm = () => {
    if (!walletPhone.trim() || walletPhone.length < 11) {
      return 'الرجاء إدخال رقم محفظة هاتف محمول صحيح (11 رقماً)';
    }
    return null;
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setProcessing(true);

    // Process the payment
    try {
      // SECURITY ENFORCEMENT DEMO:
      // We send a mock secure callback to the backend server's Webhook (simulating Cashier's server-to-server Webhook).
      // The server will verify the HMAC signature to ensure it's not a spoof.
      const response = await fetch(getApiUrl('/api/payments/webhook'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId,
          amount,
          status: 'success',
          signature
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'فشلت معالجة المعاملة على خادم البوابة');
      }

      // Successful payment cycle
      setIsPaidSuccess(true);
      setProcessing(false);

    } catch (err: any) {
      setError(err.message || 'فشلت عملية الدفع، يرجى التحقق من المدخلات.');
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between py-8 px-4" dir="rtl">
      {/* Header Info */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <Building2 className={`w-5 h-5 ${mode === 'production' ? 'text-red-500' : mode === 'sandbox' ? 'text-amber-500' : 'text-emerald-500'}`} />
          <span className="font-black text-sm tracking-widest text-slate-200">
            {mode === 'production' ? 'بوابة كاشير الحية | KASHIER PRODUCTION' : mode === 'sandbox' ? 'بوابة كاشير التجريبية | KASHIER SANDBOX' : 'محاكي كاشير الآمن | KASHIER SIMULATOR'}
          </span>
        </div>
        <button
          onClick={onCancel}
          className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-xs cursor-pointer"
        >
          <span>إلغاء المعاملة</span>
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Main Body */}
      <div className="max-w-md w-full mx-auto my-auto bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl p-6 sm:p-8 space-y-6">
        {isPaidSuccess ? (
          <div className="text-center space-y-6 py-4">
            <div className="w-16 h-16 bg-emerald-500/10 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <Check className="w-8 h-8 animate-bounce" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-white">تم الدفع بنجاح!</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                تم استلام رسوم توثيق الشهادة وقدرها {amount} ج.م بنجاح عبر محفظتك الإلكترونية، وتم تفعيل الشهادة فوراً في قاعدة بيانات الوزارة.
              </p>
            </div>

            <div className="bg-slate-900 rounded-xl p-4 border border-slate-750 space-y-2.5 text-right text-xs">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">حالة المعاملة</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>مقبولة ومكتملة</span>
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">قيمة المبلغ</span>
                <span className="font-bold text-white">{amount} ج.م</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">رقم العملية (TXN)</span>
                <span className="font-mono text-slate-300">{transactionId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">محفظة المحمول</span>
                <span className="font-mono text-slate-300">{walletPhone}</span>
              </div>
            </div>

            <button
              onClick={() => onPaymentComplete(true, transactionId)}
              className="w-full flex items-center justify-center gap-2.5 px-5 py-4 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg transition-all cursor-pointer animate-pulse"
            >
              <Sparkles className="w-5 h-5" />
              <span>عرض وتحميل الشهادة المعتمدة الآن</span>
            </button>
          </div>
        ) : (
          <>
            {/* Transaction Brief */}
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-750 flex flex-col gap-2 text-sm">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-400 block">رقم العملية (Transaction ID)</span>
                  <span className="font-mono text-slate-200 font-semibold">{transactionId}</span>
                </div>
                <div className="text-left">
                  <span className="text-xs text-slate-400 block">المبلغ الإجمالي</span>
                  <span className="text-lg font-black text-emerald-400">{amount} ج.م</span>
                </div>
              </div>
              {merchantId && (
                <div className="pt-2 border-t border-slate-800 flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>Merchant ID: {merchantId.substring(0, 8)}...</span>
                  {apiKey && <span>API Key: {apiKey.substring(0, 8)}...</span>}
                </div>
              )}
            </div>

            {/* Security Badge */}
            <div className={`flex items-center gap-2.5 border rounded-lg p-3 text-xs ${mode === 'production' ? 'bg-red-500/10 border-red-500/20 text-red-400' : mode === 'sandbox' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
              <Lock className="w-5 h-5 flex-shrink-0" />
              <span>
                {mode === 'production' 
                  ? 'إنك في وضع التحصيل الحي الحقيقي للشهادات المعتمدة. سيتم توثيق وتوقيع المعاملة رقمياً باستخدام HMAC-SHA256.' 
                  : mode === 'sandbox' 
                  ? 'إنك تتصل الآن ببيئة كاشير الاختبارية الحقيقية (Sandbox). جميع معاملاتك موثقة وموقعة بشفرات التاجر المدخلة.'
                  : 'هذه محاكاة تجريبية آمنة تحاكي بوابة دفع كاشير الفعلية. يتم توقيع المعاملة والتحقق منها عبر بروتوكول HMAC-SHA256 من السيرفر فقط.'}
              </span>
            </div>

            {/* Mobile Wallet Static Info Header */}
            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-750 text-right space-y-1">
              <span className="text-[10px] text-emerald-400 font-extrabold tracking-wide block">قناة السداد النشطة</span>
              <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-slate-400" />
                <span>المحافظ الإلكترونية للهاتف المحمول (Vodafone, Orange, Etisalat, WE Cash, Instapay)</span>
              </h4>
            </div>

            {/* Form Details */}
            <form onSubmit={handlePay} className="space-y-4">
              <div className="space-y-3.5 text-right">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">رقم محفظة الموبايل الإلكترونية</label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={11}
                      required
                      placeholder="01012345678"
                      value={walletPhone}
                      onChange={(e) => setWalletPhone(e.target.value.replace(/\D/g, ''))}
                      className="block w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white font-mono text-right focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                    <Smartphone className="w-5 h-5 text-slate-500 absolute left-3 top-2.5" />
                  </div>
                  <span className="block text-[10px] text-slate-400 mt-1">سيتم توجيه طلب الخصم الفوري لمحفظتك لإتمام المعاملة فوراً وتفعيل الشهادة.</span>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 text-red-400 rounded-lg text-xs border border-red-500/25">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={processing}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الاتصال بالسيرفر الشريك...</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4" />
                    <span>إرسال طلب السداد وتفعيل الشهادة</span>
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>

      {/* Footer lock and cert info */}
      <div className="max-w-md w-full mx-auto flex items-center justify-center gap-1.5 text-slate-500 text-xs text-center">
        <Lock className="w-3.5 h-3.5" />
        <span>جميع البيانات مشفرة بقوة ومؤمنة تماماً وفقاً لأحدث معايير الأمان المصرفي PCI-DSS.</span>
      </div>
    </div>
  );
}
