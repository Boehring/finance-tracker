# Finance Tracker API Documentation

Base URL: `http://localhost:3001/api`

All authenticated endpoints require header:
```
Authorization: Bearer <token>
```

Tokens expire after **7 days**. Obtain via `/auth/login` or `/auth/register`.

---

## Authentication

### POST /auth/register
Create a new user account. Also auto-creates a Person entry for the user.

**Body**
```json
{
  "email": "user@example.com",
  "password": "secret123",
  "name": "Daniel"
}
```

**Response 200**
```json
{
  "token": "<jwt>",
  "user": { "id": "user", "email": "user@example.com", "name": "Daniel" }
}
```

> Note: `id` is derived from `email.split('@')[0]`. E.g. `user@example.com` → id `user`.

---

### POST /auth/login
Authenticate and receive a JWT token.

**Body**
```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

**Response 200**
```json
{
  "token": "<jwt>",
  "user": { "id": "user", "email": "user@example.com", "name": "Daniel" }
}
```

---

### GET /auth/me 🔒
Get current user profile.

**Response 200**
```json
{ "id": "user", "email": "user@example.com", "name": "Daniel" }
```

---

## People

People are the participants in expenses. Each user has their own set of people.

### GET /people 🔒
List all people for the authenticated user.

**Response 200**
```json
[
  {
    "id": "cuid123",
    "name": "Daniel",
    "lastName": "García",
    "avatarUrl": "/uploads/avatar-xxx.jpg",
    "identifier": "daniel",
    "userId": "user",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

---

### GET /people/:id 🔒
Get a single person by ID.

**Response 200** — same shape as a single item from `GET /people`

---

### GET /people/:id/stats 🔒
Aggregate spending stats for a person.

**Query params**
| Param | Values | Description |
|-------|--------|-------------|
| `period` | `day` `week` `month` `year` `all` | Time window (default: `all`) |
| `date` | `YYYY-MM-DD` | Reference date for the period |

**Response 200**
```json
{
  "totalPaid": 150.00,
  "owedToThem": 75.00,
  "paidForThem": 30.00
}
```

- `totalPaid`: total amount this person paid across all expenses
- `owedToThem`: amount others owe this person (they paid, others participated)
- `paidForThem`: amount this person owes others (they participated, someone else paid)

---

### POST /people 🔒
Create a new person.

**Body**
```json
{
  "name": "Ana",
  "lastName": "López",
  "identifier": "ana"
}
```
Only `name` is required.

**Response 201** — created Person object

---

### PUT /people/:id 🔒
Update a person. Supports `multipart/form-data` for avatar upload.

**Body (JSON or form-data)**
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name |
| `lastName` | string | Last name |
| `avatar` | file | Image file (replaces existing) |

**Response 200** — updated Person object

---

### DELETE /people/:id 🔒
Delete a person. Fails with `409` if the person has any associated expenses.

**Response 204** — no content

---

## Categories

### GET /categories 🔒
List all categories ordered by name.

**Response 200**
```json
[
  {
    "id": "cuid456",
    "name": "Food",
    "color": "#FF5733",
    "icon": "🍕",
    "userId": "user",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

---

### POST /categories 🔒
Create a new category.

**Body**
```json
{
  "name": "Food",
  "color": "#FF5733",
  "icon": "🍕"
}
```
Only `name` is required.

**Response 201** — created Category object

---

### GET /categories/stats 🔒
Spending totals grouped by category.

**Query params**
| Param | Values | Description |
|-------|--------|-------------|
| `period` | `day` `week` `month` `year` `all` | Time window (default: `all`) |
| `date` | `YYYY-MM-DD` | Reference date for the period |

**Response 200**
```json
[
  {
    "id": "cuid456",
    "name": "Food",
    "color": "#FF5733",
    "icon": "🍕",
    "totalAmount": 320.50,
    "expenseCount": 12
  }
]
```

---

### PUT /categories/:id 🔒
Update a category.

**Body**
```json
{ "name": "Groceries", "color": "#00AA00", "icon": "🛒" }
```

**Response 200** — updated Category object

---

### DELETE /categories/:id 🔒
Delete a category.

**Response 204** — no content

---

## Expenses

### GET /expenses 🔒
List all expenses, newest first.

**Query params**
| Param | Values | Description |
|-------|--------|-------------|
| `period` | `day` `week` `month` `year` | Filter by time window |
| `date` | `YYYY-MM-DD` | Reference date (required when `period` is set) |

**Response 200**
```json
[
  {
    "id": "cuid789",
    "title": "Dinner at Mario's",
    "description": "Birthday dinner",
    "amount": "90.00",
    "date": "2024-05-15T20:00:00.000Z",
    "type": "EXPENSE",
    "splitType": "PERCENTAGE",
    "categoryId": "cuid456",
    "payerId": "cuid123",
    "createdById": "user",
    "category": { "id": "cuid456", "name": "Food", "color": "#FF5733", "icon": "🍕" },
    "payer": { "id": "cuid123", "name": "Daniel", ... },
    "participants": [
      {
        "id": "cuidXXX",
        "expenseId": "cuid789",
        "personId": "cuid123",
        "percentage": "50.00",
        "amount": null,
        "share": "45.00",
        "person": { "id": "cuid123", "name": "Daniel", ... }
      }
    ],
    "attachments": []
  }
]
```

---

### GET /expenses/summary 🔒
Expenses grouped by time bucket (for charts).

**Query params** — same as `GET /expenses`

**Response 200** — object keyed by time bucket string:
```json
{
  "2024-05-15": [ ...expense objects... ],
  "2024-05-16": [ ...expense objects... ]
}
```
Bucket key format: `HH:mm` (day), `YYYY-MM-DD` (week/month), `YYYY-MM` (year).

---

### GET /expenses/:id 🔒
Get a single expense with full details.

**Response 200** — same shape as single item from `GET /expenses`

---

### POST /expenses 🔒
Create a new expense.

**Body**
```json
{
  "title": "Dinner at Mario's",
  "description": "Birthday dinner",
  "amount": 90.00,
  "date": "2024-05-15T20:00:00.000Z",
  "categoryId": "cuid456",
  "payerId": "cuid123",
  "splitType": "PERCENTAGE",
  "participants": [
    { "personId": "cuid123", "percentage": 50 },
    { "personId": "cuid999", "percentage": 50 }
  ]
}
```

**Required fields**: `title`, `amount`, `date`, `payerId`

**splitType options**:
- `PERCENTAGE` — each participant has a `percentage` field; must sum to 100
- `AMOUNT` — each participant has an `amount` field; must sum to total expense `amount`

**Response 201** — created expense with full includes

---

### PUT /expenses/:id 🔒
Update an existing expense. Same body shape as POST. If `participants` is included, existing participants are replaced.

**Response 200** — updated expense with full includes

---

### DELETE /expenses/:id 🔒
Delete an expense and all its participants/attachments.

**Response 204** — no content

---

### POST /expenses/:id/attachments 🔒
Upload a file attachment to an expense.

**Body**: `multipart/form-data` with field `file` (max 5MB)

**Response 201**
```json
{
  "id": "attachId",
  "expenseId": "cuid789",
  "filename": "1234567890-abc.jpg",
  "originalName": "receipt.jpg",
  "mimeType": "image/jpeg",
  "path": "./uploads/1234567890-abc.jpg",
  "size": 204800,
  "type": "image",
  "createdAt": "2024-05-15T20:00:00.000Z"
}
```

---

### DELETE /expenses/:expenseId/attachments/:attachmentId 🔒
Delete an attachment and remove the file from disk.

**Response 204** — no content

---

## Debts

Debts are computed on-the-fly from expenses (no stored balance table). Settlements are recorded as `SETTLEMENT` type expenses and excluded from debt calculations.

### GET /debts 🔒
Get current debt balances.

**Response 200**
```json
{
  "summary": [
    {
      "personId": "cuid999",
      "personName": "Ana",
      "owes": 45.00,
      "isOwed": 0,
      "netDebt": 45.00
    }
  ],
  "details": [
    {
      "debtorId": "cuid999",
      "debtorName": "Ana",
      "creditorId": "cuid123",
      "creditorName": "Daniel",
      "amount": 45.00
    }
  ]
}
```

- `summary`: net balance per person (`owes` > 0 means they owe money, `isOwed` > 0 means others owe them)
- `details`: directional debt pairs — who owes whom and how much

---

### POST /debts/settle 🔒
Record a debt settlement (creates a `SETTLEMENT` expense).

**Body**
```json
{
  "debtorId": "cuid999",
  "creditorId": "cuid123",
  "amount": 45.00,
  "date": "2024-05-20T10:00:00.000Z"
}
```
`date` is optional — defaults to now.

**Response 201**
```json
{
  "message": "Debt settled successfully",
  "settlement": {
    "id": "settlementId",
    "title": "Settlement: Ana to Daniel",
    "amount": "45.00",
    "date": "2024-05-20T10:00:00.000Z",
    "type": "SETTLEMENT",
    ...
  }
}
```

---

## Data Types Reference

### Expense type
| Value | Description |
|-------|-------------|
| `EXPENSE` | Regular shared expense (included in debt calculations) |
| `SETTLEMENT` | Debt payment (excluded from debt calculations) |

### splitType
| Value | Description |
|-------|-------------|
| `PERCENTAGE` | Split by percentage (participants have `percentage` field) |
| `AMOUNT` | Split by fixed amount (participants have `amount` field) |

### Period values
| Value | Window |
|-------|--------|
| `day` | Single calendar day |
| `week` | Sunday–Saturday week containing `date` |
| `month` | Full calendar month |
| `year` | Full calendar year |
| `all` | No time filter |

---

## Error Responses

All errors return JSON:
```json
{ "error": "Human-readable message" }
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request / validation error |
| 401 | Missing or invalid JWT |
| 404 | Resource not found (or not owned by user) |
| 409 | Conflict (e.g. deleting person with expenses) |
| 500 | Internal server error |
