import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Calendar, GraduationCap, Building, Hash, Loader2, Search, ArrowRight } from 'lucide-react';

interface CertificateVerifyProps {
  hash: string;
  onBackToHome: () => void;
}

interface VerificationResult {
  verified: boolean;
  student?: {
    seat_number: string;
    full_name: string;
    grade: string;
    percentage: number;
    school_name: string;
    school_year: string;
    verification_date: string;
    certificate_hash: string;
  };
  error?: string;
}

export default function CertificateVerify({ hash, onBackToHome }: CertificateVerifyProps) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerificationResult | null>(null);

  useEffect(() => {
    const fetchVerification = async () => {
      try {
        const response = await fetch(`/api/student/verify/${encodeURIComponent(hash)}`);
        const data = await response.json();
        if (response.ok) {
          setResult({ verified: true, student: data.student });
        } else {
          setResult({ verified: false, error: data.error });
        }
      } catch (err) {
        setResult({ verified: false, error: 'فشل الاتصال بخادم التحقق الرقمي' });
      } finally {
        setLoading(false);
      }
    };

    fetchVerification();
  }, [hash]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12" dir="rtl">
      {/* Brand Watermark */}
      <div className="text-center mb-8">
        <h1 className="text-xl font-bold text-gray-900">نظام التحقق القومي من صحة الشهادات</h1>
        <p className="text-xs text-gray-400 mt-1">المنصة الموحدة للاعتماد والتوثيق الإلكتروني</p>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-150 p-12 text-center space-y-4">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-gray-600">جاري قراءة كود التوقيع والتحقق من سجلات الخادم الآمن...</p>
        </div>
      ) : result?.verified && result.student ? (
        /* CASE 1: VERIFIED SUCCESSFULLY */
        <div className="space-y-6">
          <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-6 sm:p-8 text-center space-y-4 relative overflow-hidden">
            {/* Background seal water */}
            <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 opacity-5 pointer-events-none">
              <ShieldCheck className="w-64 h-64 text-emerald-800" />
            </div>

            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mx-auto">
              <ShieldCheck className="w-10 h-10" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl font-black text-emerald-800">شهادة معتمدة وموثقة رقمياً</h2>
              <p className="text-xs text-emerald-600 max-w-md mx-auto font-medium">
                تم التحقق من صحة هذه الوثيقة وتوقيعها الإلكتروني. هذا التقرير يطابق السجلات الرسمية لإدارة الامتحانات بمعهد عبد الفتاح عزام بنين بنسبة 100%.
              </p>
            </div>

            {/* Student Info Details */}
            <div className="bg-white rounded-xl border border-emerald-150 p-5 text-right space-y-4 shadow-3xs">
              <div className="pb-3 border-b border-gray-100 flex justify-between items-center">
                <span className="font-bold text-gray-900 text-sm">بيانات الطالب المعتمد:</span>
                <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
                  {result.student.certificate_hash}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-800">
                <div className="flex items-start gap-2.5">
                  <GraduationCap className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <div>
                    <span className="block text-xs text-gray-400">الاسم بالكامل</span>
                    <strong className="font-bold text-gray-950">{result.student.full_name}</strong>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Hash className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <div>
                    <span className="block text-xs text-gray-400">رقم الجلوس</span>
                    <strong className="font-bold font-mono text-gray-950">{result.student.seat_number}</strong>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Building className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <div>
                    <span className="block text-xs text-gray-400">المعهد والجهة التعليمية</span>
                    <span className="font-medium">{result.student.school_name}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <div>
                    <span className="block text-xs text-gray-400">العام الدراسي والامتحان</span>
                    <span className="font-medium">{result.student.school_year}</span>
                  </div>
                </div>
              </div>

              {/* Total percentage */}
              <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                <div>
                  <span className="block text-xs text-gray-400">النتيجة والتقدير العام</span>
                  <strong className="text-base text-gray-950 font-extrabold">
                    {result.student.grade} ({result.student.percentage}%)
                  </strong>
                </div>
                <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-emerald-200 flex items-center justify-center font-bold text-xs font-mono text-emerald-800 bg-emerald-50">
                  {Math.round(result.student.percentage)}%
                </div>
              </div>
            </div>

            <div className="text-[10px] text-gray-400 flex items-center justify-center gap-1">
              <span>تاريخ إجراء هذا الاستعلام الآمن للتحقق:</span>
              <strong className="font-bold">{result.student.verification_date}</strong>
            </div>
          </div>
        </div>
      ) : (
        /* CASE 2: INVALID OR STAMPER FAILED */
        <div className="bg-red-50 border-2 border-red-500 rounded-2xl p-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-700 mx-auto">
            <ShieldAlert className="w-10 h-10 animate-bounce" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-red-800">تحذير: شهادة غير صالحة أو ملغاة</h2>
            <p className="text-sm text-red-600 max-w-md mx-auto leading-relaxed font-medium">
              عذراً، لم نتمكن من مطابقة الرمز <code className="font-mono bg-red-100 px-1.5 py-0.5 rounded text-xs font-bold text-red-900">{hash}</code> مع أي سجل نشط ومصدق عليه في سيرفرات المعهد. قد تكون الوثيقة منسوخة أو معدلة أو تم إلغاؤها لدواعي التوثيق الأمني.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-red-200 p-4 text-xs text-gray-500 text-right space-y-2">
            <span className="font-bold text-gray-900 block">الإجراءات المقترحة:</span>
            <ul className="list-disc list-inside space-y-1 pr-2">
              <li>يرجى التأكد من كتابة الكود بشكل صحيح بدون فراغات أو رموز خاطئة.</li>
              <li>يرجى التواصل مع إدارة الامتحانات بالوزارة في حال تم سداد الرسوم بالفعل ولم تفعل بعد.</li>
              <li>طلب إعادة إصدار الشهادة من لوحة الأدمن لتحديث رموز التوثيق.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Back CTA */}
      <div className="mt-8 text-center">
        <button
          onClick={onBackToHome}
          className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-850 text-white font-semibold text-sm px-5 py-3 rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة لصفحة الاستعلام الرئيسية</span>
        </button>
      </div>
    </div>
  );
}
