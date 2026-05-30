# finance-tracker-mcp-server

MCP server for the Finance Tracker API. Lets AI assistants (OpenClaw, Claude Code, etc.) register expenses, check debt balances, and manage shared finances via natural language.

## Tools

| Tool | Description |
|------|-------------|
| `finance_login` | Authenticate and store JWT token in memory |
| `finance_list_people` | List people with their IDs (required before creating expenses) |
| `finance_list_categories` | List categories with their IDs |
| `finance_create_expense` | Create a new shared expense |
| `finance_list_expenses` | List expenses, optionally filtered by period |
| `finance_get_debts` | Get current debt balances (summary + directional detail) |
| `finance_settle_debt` | Record a debt payment between two people |

## Setup

### 1. Build

```bash
cd mcp-skill
npm install
npm run build
```

### 2. Configure environment

```bash
# Optional — defaults to http://localhost:3001/api
export FINANCE_TRACKER_URL=http://localhost:3001/api
```

### 3. Connect to OpenClaw (or Claude Code)

Add to your MCP client config (e.g., `claude_desktop_config.json` or OpenClaw settings):

```json
{
  "mcpServers": {
    "finance-tracker": {
      "command": "node",
      "args": ["/absolute/path/to/finance-tracker/mcp-skill/dist/index.js"],
      "env": {
        "FINANCE_TRACKER_URL": "http://localhost:3001/api"
      }
    }
  }
}
```

For Claude Code (`~/.claude/settings.json`):
```json
{
  "mcpServers": {
    "finance-tracker": {
      "command": "node",
      "args": ["/Users/danielgarciafernandez/projects/finance-tracker/mcp-skill/dist/index.js"]
    }
  }
}
```

## Typical workflow

```
1. finance_login(email, password)
2. finance_list_people()              → get IDs
3. finance_list_categories()          → get category IDs (optional)
4. finance_create_expense(...)        → register the expense
5. finance_get_debts()                → check balances
6. finance_settle_debt(...)           → when someone pays back
```

## Notes

- Token lives in memory — re-authenticate if the server process restarts.
- `participants` percentages must sum to 100 when `splitType = PERCENTAGE`.
- `participants` amounts must sum to the total when `splitType = AMOUNT`.
- The payer should typically be included in `participants` with their own share.
- Settlements are excluded from debt calculations automatically.
