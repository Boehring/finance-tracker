export interface Person {
  id: string;
  name: string;
  lastName?: string | null;
  avatarUrl?: string | null;
  identifier?: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseParticipant {
  id: string;
  expenseId: string;
  personId: string;
  percentage?: string | null;
  amount?: string | null;
  share: string;
  person: Person;
}

export interface Expense {
  id: string;
  title: string;
  description?: string | null;
  amount: string;
  date: string;
  type: "EXPENSE" | "SETTLEMENT";
  splitType: "PERCENTAGE" | "AMOUNT";
  categoryId?: string | null;
  payerId: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  category?: Category | null;
  payer: Person;
  participants: ExpenseParticipant[];
}

export interface DebtSummaryItem {
  personId: string;
  personName: string;
  owes: number;
  isOwed: number;
  netDebt: number;
}

export interface DebtDetailItem {
  debtorId: string;
  debtorName: string;
  creditorId: string;
  creditorName: string;
  amount: number;
}

export interface DebtsResponse {
  summary: DebtSummaryItem[];
  details: DebtDetailItem[];
}

export interface ParticipantByPercentage {
  personId: string;
  percentage: number;
}

export interface ParticipantByAmount {
  personId: string;
  amount: number;
}
