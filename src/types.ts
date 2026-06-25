export interface Student {
  id: string;
  seat_number: string;
  national_id: string;
  full_name: string;
  grade: string;
  percentage: number;
  school_name: string;
  school_year: string;
  price: number;
  is_paid: boolean;
  subject_grades?: Record<string, number>;
  certificate_hash?: string;
}

export interface Payment {
  id: string;
  student_id: string;
  amount: number;
  transaction_id: string;
  status: 'pending' | 'success' | 'failed';
  payment_method: string;
  created_at: string;
  student_name?: string;
  seat_number?: string;
}

export interface AdminStats {
  totalStudents: number;
  paidStudents: number;
  pendingPayments: number;
  totalRevenue: number;
  avgPercentage: number;
}
