import axios, { AxiosError, type AxiosInstance } from "axios";
import type {
  Person,
  Category,
  Expense,
  DebtsResponse,
} from "../types.js";

const BASE_URL = process.env.FINANCE_TRACKER_URL ?? "http://localhost:3001/api";

let authToken: string | null = null;

function buildClient(): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });
}

export function setToken(token: string): void {
  authToken = token;
}

export function isAuthenticated(): boolean {
  return authToken !== null;
}

export function requireAuth(): void {
  if (!authToken) {
    throw new Error(
      "Not authenticated. Call finance_login first with your email and password."
    );
  }
}

export function handleApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    if (error.response) {
      const msg = (error.response.data as { error?: string })?.error;
      switch (error.response.status) {
        case 400:
          return `Error 400: ${msg ?? "Bad request — check the fields you provided."}`;
        case 401:
          return "Error 401: Unauthorized — token expired or invalid. Call finance_login again.";
        case 404:
          return `Error 404: ${msg ?? "Resource not found — check the ID is correct."}`;
        case 409:
          return `Error 409: ${msg ?? "Conflict — operation not allowed in current state."}`;
        case 429:
          return "Error 429: Rate limit exceeded. Wait a moment and retry.";
        default:
          return `Error ${error.response.status}: ${msg ?? "Unexpected API error."}`;
      }
    }
    if (error.code === "ECONNABORTED") {
      return "Error: Request timed out. Is the Finance Tracker backend running?";
    }
    if (error.code === "ECONNREFUSED") {
      return `Error: Cannot connect to ${BASE_URL}. Is the backend running?`;
    }
  }
  return `Error: ${error instanceof Error ? error.message : String(error)}`;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function apiLogin(
  email: string,
  password: string
): Promise<{ token: string; user: { id: string; email: string; name?: string } }> {
  const res = await buildClient().post("/auth/login", { email, password });
  return res.data as { token: string; user: { id: string; email: string; name?: string } };
}

// ── People ────────────────────────────────────────────────────────────────────

export async function apiListPeople(): Promise<Person[]> {
  requireAuth();
  const res = await buildClient().get("/people");
  return res.data as Person[];
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function apiListCategories(): Promise<Category[]> {
  requireAuth();
  const res = await buildClient().get("/categories");
  return res.data as Category[];
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export async function apiListExpenses(
  period?: string,
  date?: string
): Promise<Expense[]> {
  requireAuth();
  const params: Record<string, string> = {};
  if (period) params.period = period;
  if (date) params.date = date;
  const res = await buildClient().get("/expenses", { params });
  return res.data as Expense[];
}

export async function apiCreateExpense(body: {
  title: string;
  amount: number;
  date: string;
  payerId: string;
  participants: Array<{ personId: string; percentage?: number; amount?: number }>;
  categoryId?: string;
  description?: string;
  splitType?: "PERCENTAGE" | "AMOUNT";
}): Promise<Expense> {
  requireAuth();
  const res = await buildClient().post("/expenses", body);
  return res.data as Expense;
}

// ── People (write) ────────────────────────────────────────────────────────────

export async function apiCreatePerson(body: {
  name: string;
  lastName?: string;
  identifier?: string;
}): Promise<Person> {
  requireAuth();
  const res = await buildClient().post("/people", body);
  return res.data as Person;
}

// ── Categories (write) ────────────────────────────────────────────────────────

export async function apiCreateCategory(body: {
  name: string;
  color?: string;
  icon?: string;
}): Promise<Category> {
  requireAuth();
  const res = await buildClient().post("/categories", body);
  return res.data as Category;
}

// ── Context (composite) ───────────────────────────────────────────────────────

export async function apiGetContext(): Promise<{
  people: Person[];
  categories: Category[];
  debts: DebtsResponse;
}> {
  requireAuth();
  const [people, categories, debts] = await Promise.all([
    apiListPeople(),
    apiListCategories(),
    apiGetDebts(),
  ]);
  return { people, categories, debts };
}

// ── Debts ─────────────────────────────────────────────────────────────────────

export async function apiGetDebts(): Promise<DebtsResponse> {
  requireAuth();
  const res = await buildClient().get("/debts");
  return res.data as DebtsResponse;
}

export async function apiSettleDebt(body: {
  debtorId: string;
  creditorId: string;
  amount: number;
  date?: string;
}): Promise<{ message: string; settlement: Expense }> {
  requireAuth();
  const res = await buildClient().post("/debts/settle", body);
  return res.data as { message: string; settlement: Expense };
}
