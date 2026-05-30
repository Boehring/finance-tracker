#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  setToken,
  handleApiError,
  apiLogin,
  apiListPeople,
  apiListCategories,
  apiListExpenses,
  apiCreateExpense,
  apiGetDebts,
  apiSettleDebt,
} from "./services/api.js";

const server = new McpServer({
  name: "finance-tracker-mcp-server",
  version: "1.0.0",
});

// ── finance_login ─────────────────────────────────────────────────────────────

server.registerTool(
  "finance_login",
  {
    title: "Login to Finance Tracker",
    description: `Authenticate with the Finance Tracker API using email and password.
Stores the JWT token in memory for subsequent calls. Token is valid for 7 days per session.

Must be called before any other finance_* tool.

Args:
  - email (string): User email address
  - password (string): User password

Returns:
  Confirmation with the logged-in user ID and name.

Examples:
  - "login with user@example.com" → finance_login({ email: "user@example.com", password: "..." })`,
    inputSchema: z.object({
      email: z.string().email().describe("User email address"),
      password: z.string().min(1).describe("User password"),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ email, password }) => {
    try {
      const result = await apiLogin(email, password);
      setToken(result.token);
      const text = `Logged in as ${result.user.name ?? result.user.id} (${result.user.email}). Ready to use finance tools.`;
      return { content: [{ type: "text", text }] };
    } catch (error) {
      return { content: [{ type: "text", text: handleApiError(error) }] };
    }
  }
);

// ── finance_list_people ───────────────────────────────────────────────────────

server.registerTool(
  "finance_list_people",
  {
    title: "List People",
    description: `List all people (participants) registered in the Finance Tracker.
Use this to get person IDs before creating expenses — payerId and participant personId fields require these IDs.

Returns:
  Array of people with schema:
  {
    "id": string,        // Use this as payerId or participant personId
    "name": string,
    "lastName": string | null
  }

Examples:
  - "who are the people?" → finance_list_people()
  - Before creating an expense, call this to resolve names to IDs`,
    inputSchema: z.object({}),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => {
    try {
      const people = await apiListPeople();
      const output = people.map((p) => ({
        id: p.id,
        name: p.name,
        lastName: p.lastName ?? null,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: { people: output } as Record<string, unknown>,
      };
    } catch (error) {
      return { content: [{ type: "text", text: handleApiError(error) }] };
    }
  }
);

// ── finance_list_categories ───────────────────────────────────────────────────

server.registerTool(
  "finance_list_categories",
  {
    title: "List Categories",
    description: `List all expense categories defined in the Finance Tracker.
Use this to get category IDs when creating or filtering expenses.

Returns:
  Array of categories with schema:
  {
    "id": string,       // Use this as categoryId when creating an expense
    "name": string,
    "color": string | null,
    "icon": string | null
  }

Examples:
  - "what categories exist?" → finance_list_categories()
  - Before categorising an expense, call this to resolve the category name to its ID`,
    inputSchema: z.object({}),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => {
    try {
      const categories = await apiListCategories();
      const output = categories.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color ?? null,
        icon: c.icon ?? null,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: { categories: output } as Record<string, unknown>,
      };
    } catch (error) {
      return { content: [{ type: "text", text: handleApiError(error) }] };
    }
  }
);

// ── finance_create_expense ────────────────────────────────────────────────────

const ParticipantSchema = z.union([
  z.object({
    personId: z.string().describe("Person ID from finance_list_people"),
    percentage: z.number().min(0).max(100).describe("Share percentage (0-100). Must sum to 100 across all participants."),
  }),
  z.object({
    personId: z.string().describe("Person ID from finance_list_people"),
    amount: z.number().min(0).describe("Fixed amount this person owes. Must sum to total expense amount."),
  }),
]);

server.registerTool(
  "finance_create_expense",
  {
    title: "Create Expense",
    description: `Register a new shared expense in the Finance Tracker.

IMPORTANT:
- Resolve person names to IDs via finance_list_people before calling this tool.
- splitType PERCENTAGE (default): participants need 'percentage' field, values must sum to 100.
- splitType AMOUNT: participants need 'amount' field, values must sum to the total expense amount.
- The payer (payerId) should typically also appear in participants with their share.
- date must be ISO 8601 format (e.g., "2024-05-15T20:00:00.000Z" or "2024-05-15").

Args:
  - title (string): Short description of the expense (e.g., "Dinner at Mario's")
  - amount (number): Total amount of the expense
  - date (string): Date of the expense in ISO 8601 format
  - payerId (string): ID of the person who paid
  - participants (array): Who shares the expense and how much each owes
    - For PERCENTAGE split: [{ personId, percentage }, ...]
    - For AMOUNT split: [{ personId, amount }, ...]
  - splitType (string, optional): "PERCENTAGE" (default) or "AMOUNT"
  - categoryId (string, optional): ID from finance_list_categories
  - description (string, optional): Additional notes

Returns:
  The created expense with full participant and category details.

Examples:
  - "Dinner €90, paid by Daniel, split 50/50 with Ana":
    finance_create_expense({
      title: "Dinner", amount: 90, date: "2024-05-15",
      payerId: "<daniel_id>", splitType: "PERCENTAGE",
      participants: [
        { personId: "<daniel_id>", percentage: 50 },
        { personId: "<ana_id>", percentage: 50 }
      ]
    })`,
    inputSchema: z.object({
      title: z.string().min(1).max(200).describe("Short description of the expense"),
      amount: z.number().positive().describe("Total amount of the expense"),
      date: z.string().describe("Date in ISO 8601 format (e.g., 2024-05-15 or 2024-05-15T20:00:00Z)"),
      payerId: z.string().describe("Person ID of who paid — use finance_list_people to get IDs"),
      participants: z.array(ParticipantSchema).min(1).describe(
        "People sharing this expense with their share (percentage or fixed amount)"
      ),
      splitType: z
        .enum(["PERCENTAGE", "AMOUNT"])
        .default("PERCENTAGE")
        .describe("How the expense is split: PERCENTAGE (default) or AMOUNT"),
      categoryId: z.string().optional().describe("Category ID from finance_list_categories (optional)"),
      description: z.string().optional().describe("Additional notes about the expense (optional)"),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  async ({ title, amount, date, payerId, participants, splitType, categoryId, description }) => {
    try {
      const expense = await apiCreateExpense({
        title,
        amount,
        date,
        payerId,
        participants,
        splitType,
        categoryId,
        description,
      });

      const payerName = expense.payer.name;
      const participantLines = expense.participants.map((p) => {
        const share = Number(p.share).toFixed(2);
        const pct = p.percentage ? ` (${Number(p.percentage).toFixed(1)}%)` : "";
        return `  - ${p.person.name}: €${share}${pct}`;
      });

      const text = [
        `✓ Expense created: "${expense.title}"`,
        `  ID: ${expense.id}`,
        `  Amount: €${Number(expense.amount).toFixed(2)}`,
        `  Paid by: ${payerName}`,
        `  Date: ${expense.date}`,
        `  Participants:`,
        ...participantLines,
        expense.category ? `  Category: ${expense.category.name}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      return {
        content: [{ type: "text", text }],
        structuredContent: { expense } as Record<string, unknown>,
      };
    } catch (error) {
      return { content: [{ type: "text", text: handleApiError(error) }] };
    }
  }
);

// ── finance_list_expenses ─────────────────────────────────────────────────────

server.registerTool(
  "finance_list_expenses",
  {
    title: "List Expenses",
    description: `List recorded expenses, optionally filtered by time period.

Args:
  - period (string, optional): "day" | "week" | "month" | "year" — filter by time window
  - date (string, optional): Reference date for the period in YYYY-MM-DD format (defaults to today)

Returns:
  Array of expenses (simplified) with schema:
  {
    "id": string,
    "title": string,
    "amount": number,
    "date": string,
    "payer": string,         // Payer name
    "category": string | null,
    "participants": [{ "name": string, "share": number }]
  }

Examples:
  - "show this month's expenses" → finance_list_expenses({ period: "month", date: "2024-05-01" })
  - "all expenses" → finance_list_expenses()`,
    inputSchema: z.object({
      period: z
        .enum(["day", "week", "month", "year"])
        .optional()
        .describe("Time window to filter by (optional — omit for all expenses)"),
      date: z
        .string()
        .optional()
        .describe("Reference date in YYYY-MM-DD format (optional — defaults to today)"),
    }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ period, date }) => {
    try {
      const expenses = await apiListExpenses(period, date);

      const output = expenses.map((e) => ({
        id: e.id,
        title: e.title,
        amount: Number(e.amount),
        date: e.date,
        type: e.type,
        payer: e.payer.name,
        category: e.category?.name ?? null,
        participants: e.participants.map((p) => ({
          name: p.person.name,
          share: Number(p.share),
        })),
      }));

      const total = output
        .filter((e) => e.type === "EXPENSE")
        .reduce((s, e) => s + e.amount, 0);

      const header = period
        ? `${output.length} expenses (${period}${date ? ` of ${date}` : ""}) — total: €${total.toFixed(2)}`
        : `${output.length} expenses — total: €${total.toFixed(2)}`;

      return {
        content: [
          { type: "text", text: `${header}\n\n${JSON.stringify(output, null, 2)}` },
        ],
        structuredContent: { expenses: output, total } as Record<string, unknown>,
      };
    } catch (error) {
      return { content: [{ type: "text", text: handleApiError(error) }] };
    }
  }
);

// ── finance_get_debts ─────────────────────────────────────────────────────────

server.registerTool(
  "finance_get_debts",
  {
    title: "Get Debt Balances",
    description: `Get current debt balances calculated from all recorded expenses.
Debts are computed on-the-fly — no stored balance table.
Settlements (from finance_settle_debt) reduce the balances automatically.

Returns:
  {
    "summary": [{ "personName", "owes", "isOwed", "netDebt" }],
    "details": [{ "debtorName", "creditorName", "amount" }]
  }
  - summary: net balance per person (owes > 0 means they owe, isOwed > 0 means others owe them)
  - details: directional pairs showing who owes whom exactly how much

Examples:
  - "who owes what?" → finance_get_debts()
  - "how much does Ana owe?" → finance_get_debts() then filter by Ana in summary`,
    inputSchema: z.object({}),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => {
    try {
      const debts = await apiGetDebts();

      const summaryLines = debts.summary.map((s) => {
        if (s.owes > 0) return `  ${s.personName} owes €${s.owes.toFixed(2)}`;
        return `  ${s.personName} is owed €${s.isOwed.toFixed(2)}`;
      });

      const detailLines = debts.details.map(
        (d) => `  ${d.debtorName} → ${d.creditorName}: €${d.amount.toFixed(2)}`
      );

      const text =
        debts.summary.length === 0
          ? "No outstanding debts."
          : [
              "Summary:",
              ...summaryLines,
              "",
              "Breakdown:",
              ...detailLines,
            ].join("\n");

      return {
        content: [{ type: "text", text }],
        structuredContent: debts as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return { content: [{ type: "text", text: handleApiError(error) }] };
    }
  }
);

// ── finance_settle_debt ───────────────────────────────────────────────────────

server.registerTool(
  "finance_settle_debt",
  {
    title: "Settle a Debt",
    description: `Record a debt payment between two people. Creates a SETTLEMENT expense that reduces the outstanding balance.

IMPORTANT:
- Use finance_get_debts first to confirm who owes whom and how much.
- Use finance_list_people to get person IDs (debtorId, creditorId).
- Partial settlements are allowed (amount can be less than total debt).

Args:
  - debtorId (string): ID of the person making the payment (who owes)
  - creditorId (string): ID of the person receiving the payment (who is owed)
  - amount (number): Amount being settled
  - date (string, optional): Settlement date in ISO 8601 format (defaults to now)

Returns:
  Confirmation with the settlement record ID and details.

Examples:
  - "Ana pays Daniel back €45":
    finance_settle_debt({ debtorId: "<ana_id>", creditorId: "<daniel_id>", amount: 45 })`,
    inputSchema: z.object({
      debtorId: z.string().describe("ID of the person paying (who owes) — use finance_list_people"),
      creditorId: z.string().describe("ID of the person receiving payment (who is owed) — use finance_list_people"),
      amount: z.number().positive().describe("Amount being settled"),
      date: z.string().optional().describe("Settlement date in ISO 8601 format (optional — defaults to now)"),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  async ({ debtorId, creditorId, amount, date }) => {
    try {
      const result = await apiSettleDebt({ debtorId, creditorId, amount, date });
      const text = [
        `✓ Debt settled`,
        `  Settlement ID: ${result.settlement.id}`,
        `  Amount: €${Number(result.settlement.amount).toFixed(2)}`,
        `  Date: ${result.settlement.date}`,
        `  ${result.message}`,
      ].join("\n");
      return {
        content: [{ type: "text", text }],
        structuredContent: { settlement: result.settlement } as Record<string, unknown>,
      };
    } catch (error) {
      return { content: [{ type: "text", text: handleApiError(error) }] };
    }
  }
);

// ── Start server ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Finance Tracker MCP server running via stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
