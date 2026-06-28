import React, { useState } from 'react';
import { ChevronRight, CreditCard, Lock, Download, Printer, ShieldCheck, CheckCircle2, QrCode, Smartphone } from 'lucide-react';
import { Student } from '../types';
import { getApiUrl } from '../config';

interface StudentCertificateProps {
  student: Student;
  onBack: () => void;
  onPayRedirect: (checkoutUrl: string, initData?: any) => void;
}

export default function StudentCertificate({ student, onBack, onPayRedirect }: StudentCertificateProps) {
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'vodafone_cash' | 'fawry'>('vodafone_cash');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePaymentInit = async () => {
    setPaying(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl('/api/payments/initialize'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          paymentMethod
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'فشل تهيئة الدفع');
      }

      // Redirect the student to the Cashier Portal
      onPayRedirect(data.checkoutUrl, data);
    } catch (err: any) {
      setError(err.message || 'فشل الاتصال ببوابة الدفع، الرجاء المحاولة مرة أخرى');
    } finally {
      setPaying(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Get verification URL for the QR Code
  const getVerificationUrl = () => {
    if (!student.certificate_hash) return '';
    return `${window.location.origin}/verify/${student.certificate_hash}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8" dir="rtl">
      {/* Back to search */}
      <div className="mb-6 no-print">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
          <span>الرجوع للاستعلام</span>
        </button>
      </div>

      {/* CASE 1: UNPAID CERTIFICATE (LOCKED CONTENT) */}
      {!student.is_paid ? (
        <div className="bg-white rounded-2xl border border-gray-150 shadow-xs overflow-hidden no-print">
          <div className="bg-amber-50 border-b border-amber-100 p-6 flex items-start gap-4">
            <div className="p-3 bg-amber-100 text-amber-800 rounded-xl">
              <Lock className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">بيانات الطالب مستخرجة بنجاح - بانتظار تفعيل الشهادة</h3>
              <p className="mt-1 text-sm text-gray-600">
                لقد وجدنا سجلات الطالب <span className="font-semibold text-amber-800">{student.full_name}</span>. الشهادة الرقمية الرسمية مدفوعة، يرجى سداد رسوم الاستخراج لتفعيل التحميل وعرض النتائج بالتفصيل.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Student Info preview */}
            <div className="space-y-4">
              <h4 className="font-bold text-gray-900 text-base pb-2 border-b border-gray-100">بيانات الشهادة المتاحة</h4>
              <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <span className="block text-gray-400 text-xs">اسم الطالب</span>
                  <span className="font-medium text-gray-800">{student.full_name}</span>
                </div>
                <div>
                  <span className="block text-gray-400 text-xs">رقم الجلوس</span>
                  <span className="font-mono font-semibold text-gray-800">{student.seat_number}</span>
                </div>
                <div>
                  <span className="block text-gray-400 text-xs">المدرسة</span>
                  <span className="font-medium text-gray-800">{student.school_name}</span>
                </div>
                <div>
                  <span className="block text-gray-400 text-xs">العام الدراسي</span>
                  <span className="font-medium text-gray-800">{student.school_year}</span>
                </div>
              </div>

              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex justify-between items-center">
                <div>
                  <span className="text-xs text-emerald-800 block">رسوم استخراج وتحميل الشهادة</span>
                  <span className="text-xl font-black text-emerald-700">{student.price} ج.م</span>
                </div>
                <span className="text-xs text-emerald-600 bg-white border border-emerald-200 rounded-full px-3 py-1 font-semibold">
                  شاملة رمز التحقق QR
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-4">
              <h4 className="font-bold text-gray-900 text-base pb-2 border-b border-gray-100">اختر طريقة الدفع الآمنة</h4>
              
              <div className="grid grid-cols-1 gap-3 text-right">
                <label className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20 cursor-pointer">
                  <input
                    type="radio"
                    name="payment_method"
                    checked={true}
                    readOnly
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex-1">
                    <span className="block font-bold text-gray-900 text-sm">محافظ الهاتف المحمول عبر بوابة كاشير (فودافون كاش / اتصالات / أورانج / Instapay)</span>
                    <span className="block text-xs text-emerald-700 mt-1">سدد فوراً وبسهولة عبر محفظتك الإلكترونية المفضلة</span>
                  </div>
                  <Smartphone className="w-5 h-5 text-emerald-600" />
                </label>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100 font-medium">
                  {error}
                </div>
              )}

              <button
                onClick={handlePaymentInit}
                disabled={paying}
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {paying ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>تحويلك إلى بوابة كاشير المؤمّنة...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    <span>دفع الرسوم عبر كاشير وتفعيل الشهادة</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* CASE 2: PAID CERTIFICATE (SHOW OFFICIAL VIEW) */
        <div className="space-y-6">
          {/* Action Header for Downloading */}
          <div className="flex flex-col sm:flex-row justify-between items-center bg-emerald-50 border border-emerald-150 rounded-xl px-5 py-4 gap-4 no-print">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-emerald-800 block text-sm sm:text-base">تم دفع الرسوم وتفعيل الشهادة بنجاح</span>
                <span className="text-xs text-emerald-600 block">يمكنك الآن طباعة الشهادة أو حفظها كملف PDF معتمد.</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold px-4 py-2 border border-gray-300 rounded-lg text-sm shadow-xs transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة / حفظ PDF</span>
              </button>
            </div>
          </div>

          {/* Certificate Page Visual */}
          <div className="bg-white border-8 border-double border-emerald-800 rounded-xl p-8 sm:p-12 shadow-sm relative overflow-hidden certificate-container">
            {/* Background Watermark/Seal */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
              <ShieldCheck className="w-[450px] h-[450px] text-emerald-800" />
            </div>

            {/* Top Bar of Certificate */}
            <div className="flex justify-between items-start border-b-2 border-emerald-800 pb-6 mb-8 text-sm text-gray-800">
              <div className="text-right space-y-1">
                <span className="block font-bold text-base text-gray-900">جمهورية مصر العربية</span>
                <span className="block">وزارة التربية والتعليم والتعليم الفني</span>
                <span className="block">الإدارة العامة للامتحانات</span>
                <span className="block font-medium">{student.school_name}</span>
              </div>
              <div className="text-left space-y-1">
                <span className="block">العام الدراسي: <strong className="font-medium">{student.school_year}</strong></span>
                <span className="block">كود الشهادة: <strong className="font-mono text-xs">{student.certificate_hash}</strong></span>
                <span className="block">تاريخ التوثيق: <strong className="font-medium">{new Date().toLocaleDateString('ar-EG')}</strong></span>
              </div>
            </div>

            {/* Certificate Core Statement */}
            <div className="text-center space-y-4 my-8">
              <span className="text-emerald-800 font-extrabold text-2xl tracking-widest block border-b border-emerald-100 max-w-xs mx-auto pb-2">
                شهادة نجاح وتوثيق دائم
              </span>
              <p className="text-gray-700 leading-relaxed max-w-2xl mx-auto text-base">
                تشهد وزارة التربية والتعليم بأن الطالب / <strong className="text-lg font-bold text-gray-950 underline decoration-emerald-600 underline-offset-4">{student.full_name}</strong>
              </p>
              <p className="text-gray-700 leading-relaxed text-sm">
                صاحب الرقم القومي <strong className="font-mono text-gray-900 font-bold bg-slate-100 px-2 py-0.5 rounded">{student.national_id}</strong> ورقم الجلوس <strong className="font-mono text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded">{student.seat_number}</strong>
              </p>
              <p className="text-gray-700 leading-relaxed text-base">
                قد اجتاز بنجاح اختبارات شهادة إتمام الدراسة الثانوية للعام الدراسي <strong className="font-bold">{student.school_year}</strong> وحصل على تقدير عام <strong className="text-emerald-800 font-black">{student.grade}</strong> بنسبة مئوية إجمالية بلغت <strong className="text-emerald-800 font-black">{student.percentage}%</strong>.
              </p>
            </div>

            {/* Grades Table */}
            {student.subject_grades && (
              <div className="my-8">
                <h4 className="font-bold text-gray-900 text-sm mb-3 text-right">تفاصيل المواد والدرجات:</h4>
                <div className="overflow-x-auto border border-emerald-800 rounded-lg">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-emerald-800 text-white">
                      <tr>
                        <th className="px-4 py-2 font-semibold">المادة الدراسية</th>
                        <th className="px-4 py-2 text-center font-semibold">الدرجة الحاصل عليها</th>
                        <th className="px-4 py-2 text-center font-semibold">الدرجة العظمى</th>
                        <th className="px-4 py-2 text-center font-semibold">حالة الاجتياز</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150">
                      {Object.entries(student.subject_grades).map(([subjectKey, grade]) => {
                        let subjectName = subjectKey;
                        let maxGrade = subjectKey.includes('اللغة العربية') ? 80 : 60;
                        if (subjectKey.includes('|')) {
                          const parts = subjectKey.split('|');
                          subjectName = parts[0];
                          maxGrade = Number(parts[1]) || 60;
                        }
                        const isPass = grade >= (maxGrade / 2);
                        return (
                          <tr key={subjectKey} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2.5 font-medium text-gray-900">{subjectName}</td>
                            <td className="px-4 py-2.5 text-center font-mono font-bold text-gray-800">{grade}</td>
                            <td className="px-4 py-2.5 text-center font-mono text-gray-500">{maxGrade}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${isPass ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {isPass ? 'مُجتاز' : 'غير مجتاز'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Stamps and QR Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center pt-8 border-t-2 border-emerald-800 mt-8 text-sm">
              {/* QR Code and Direct Scan Check */}
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="bg-slate-50 p-2 border border-slate-200 rounded-lg flex items-center justify-center">
                  {student.certificate_hash && (
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(getVerificationUrl())}`}
                      alt="رمز التحقق السريع"
                      className="w-28 h-28"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
                <div className="text-xs text-gray-500 max-w-[180px]">
                  امسح الـ QR للتحقق الفوري من صحة هذه الشهادة مباشرة من سيرفرات الوزارة.
                </div>
              </div>

              {/* Digital Stamps */}
              <div className="text-center flex flex-col items-center justify-center space-y-2 border-y md:border-y-0 md:border-x border-gray-200 py-4 md:py-0">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs shadow-3xs uppercase">
                  <ShieldCheck className="w-4 h-4" />
                  <span>مُوقّع رقمياً ومعتمد</span>
                </div>
                <p className="text-xs text-gray-400 max-w-[200px]">
                  تحتوي هذه الوثيقة على شهادة توقيع إلكتروني مدمجة وصالحة للتقديم للجهات الحكومية والخاصة.
                </p>
              </div>

              {/* Ministry Seal Mockup */}
              <div className="text-center space-y-4">
                <span className="block text-gray-500 font-bold text-xs uppercase tracking-wide">
                  خاتم شعار الجمهورية الإلكتروني
                </span>
                <div className="w-20 h-20 rounded-full border-4 border-emerald-800/20 bg-emerald-50 flex items-center justify-center mx-auto relative rotate-12">
                  <div className="absolute inset-2 rounded-full border border-dashed border-emerald-800 flex items-center justify-center text-[10px] text-emerald-800 font-black tracking-tighter text-center">
                    وزارة التربية<br />والتعليم
                  </div>
                </div>
                <span className="block text-xs font-bold text-gray-900 underline decoration-emerald-800 decoration-wavy">
                  أمين عام قطاع الامتحانات
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
