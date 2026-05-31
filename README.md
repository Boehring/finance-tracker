# Finance Tracker - Gastos Compartidos

Aplicación para registrar y gestionar gastos compartidos entre diferentes personas.

## Características

- Registro de gastos con múltiples participantes
- División por porcentaje o importe fijo
- Adjuntar imágenes y ficheros a los gastos
- Categorización de gastos con colores e iconos
- Vistas por día, semana, mes y año
- Cálculo automático de deudas entre personas
- Gráficas y estadísticas por persona y categoría
- Funcionalidad para saldar deudas
- Gestión de personas y categorías
- Autenticación de usuarios con JWT
- Persistencia con SQLite (por defecto) o PostgreSQL
- Despliegue con Docker (desarrollo y producción)

## Tecnologías

### Backend

- **Runtime:** Node.js + Express + TypeScript
- **ORM:** Prisma (SQLite por defecto, PostgreSQL opcional)
- **Autenticación:** JWT (jsonwebtoken + bcryptjs)
- **Archivos:** Multer para subida de archivos
- **Logging:** Morgan (HTTP) + Winston (estructurado)
- **Fechas:** dayjs

### Frontend

- **Framework:** React 18 + TypeScript
- **Build tool:** Vite 5
- **Estilos:** Tailwind CSS v4
- **Enrutado:** React Router v6
- **Formularios:** react-hook-form
- **HTTP client:** Axios
- **Gráficas:** Recharts
- **Iconos:** Lucide React
- **Markdown:** react-markdown

### Infraestructura

- **Docker:** Multi-stage builds con Docker Compose
- **Proxy:** Vite proxy `/api` y `/uploads` → backend (`localhost:3001`)

## Requisitos Previos

- Node.js (v18 o superior)
- npm o yarn
- Docker (opcional, para despliegue con contenedores)

## Configuración

### 1. Con Docker (recomendado)

```bash
# Desarrollo (hot-reload)
docker compose up

# Producción
docker compose -f docker-compose.prod.yml up -d
```

El frontend estará disponible en `http://localhost:5173` y el backend en `http://localhost:3001`.

### 2. Sin Docker

#### Backend

```bash
cd backend
npm install
npx prisma migrate dev --name init
npm run dev
```

El backend estará disponible en `http://localhost:3001`

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

El frontend estará disponible en `http://localhost:5173`

### Variables de Entorno

El backend acepta las siguientes variables (`.env` en `backend/`):

```env
DATABASE_URL="file:./dev.db"                                          # SQLite (por defecto)
# DATABASE_URL="postgresql://user:pass@localhost:5432/finance_tracker" # PostgreSQL
JWT_SECRET="tu-clave-secreta-jwt"
PORT=3001
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE=5242880
```

## Uso

1. Regístrate o inicia sesión
2. Añade personas (amigos, familiares, compañeros)
3. Crea categorías para organizar los gastos
4. Registra gastos indicando quién pagó y cómo se reparte
5. Visualiza los gastos por día, semana, mes o año
6. Consulta las deudas entre personas y sus estadísticas
7. Salda deudas cuando sea necesario

## Comandos Útiles

### Backend

```bash
npm run dev              # Iniciar con hot-reload
npm run build            # Compilar TypeScript
npm run start            # Ejecutar compilado
npx prisma studio        # Navegador visual de base de datos
npx prisma generate      # Regenerar cliente Prisma
npx prisma migrate dev   # Crear y aplicar migraciones
```

### Frontend

```bash
npm run dev     # Iniciar servidor Vite
npm run build   # Type-check + build
```

## Estructura del Proyecto

```
finance-tracker/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Punto de entrada, exporta prisma singleton
│   │   ├── middleware/
│   │   │   ├── auth.ts           # Middleware JWT (adjunta req.userId)
│   │   │   └── errorHandler.ts   # Manejador global de errores
│   │   ├── routes/
│   │   │   ├── auth.ts           # Registro, login, perfil, cambio de contraseña
│   │   │   ├── people.ts         # CRUD personas + stats + chart + avatar
│   │   │   ├── categories.ts     # CRUD categorías + stats
│   │   │   ├── expenses.ts       # CRUD gastos + attachments
│   │   │   └── debts.ts          # Cálculo y liquidación de deudas
│   │   └── utils/
│   │       └── logger.ts         # Logger Winston
│   ├── prisma/
│   │   └── schema.prisma         # Modelos: User, Person, Category, Expense,
│   │                             # ExpenseParticipant, Attachment, Debt
│   ├── uploads/                  # Archivos subidos
│   ├── Dockerfile                # Multi-stage (base/dev/builder/prod)
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.tsx              # Punto de entrada
│   │   ├── App.tsx               # React Router v6 (11 rutas)
│   │   ├── index.css             # Import Tailwind CSS
│   │   ├── components/
│   │   │   ├── ConfirmDialog.tsx  # Diálogo de confirmación reutilizable
│   │   │   └── Navbar.tsx        # Barra de navegación
│   │   ├── hooks/
│   │   │   └── useAuth.tsx       # Contexto de autenticación + JWT
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Expenses.tsx
│   │   │   ├── CreateExpense.tsx  # Crear y editar gastos
│   │   │   ├── ExpenseView.tsx
│   │   │   ├── Categories.tsx
│   │   │   ├── People.tsx
│   │   │   ├── PersonView.tsx    # Detalle + estadísticas de persona
│   │   │   └── Debts.tsx
│   │   ├── services/
│   │   │   └── api.ts            # Axios instance (baseURL: /api)
│   │   └── utils/
│   │       └── logger.ts         # Logger frontend
│   ├── vite.config.ts            # Proxy /api y /uploads → backend
│   └── Dockerfile                # Multi-stage (dev/builder/prod con nginx)
├── docker-compose.yml            # Desarrollo (hot-reload)
└── docker-compose.prod.yml       # Producción (nginx, volúmenes persistentes)
```

## API Endpoints

### General

- `GET /api/health` — Estado del servidor

### Auth

- `POST /api/auth/register` — Registro de usuario
- `POST /api/auth/login` — Inicio de sesión
- `GET /api/auth/me` — Obtener usuario actual
- `PUT /api/auth/password` — Cambiar contraseña

### Personas

- `GET /api/people` — Listar personas
- `GET /api/people/:id` — Obtener persona por ID
- `GET /api/people/:id/stats` — Estadísticas de gastos de una persona
- `GET /api/people/:id/chart` — Datos de gráfica histórica de una persona
- `POST /api/people` — Crear persona
- `PUT /api/people/:id` — Actualizar persona (acepta avatar multipart)
- `DELETE /api/people/:id` — Eliminar persona

### Categorías

- `GET /api/categories` — Listar categorías
- `GET /api/categories/stats` — Estadísticas de gasto por categoría
- `POST /api/categories` — Crear categoría
- `PUT /api/categories/:id` — Actualizar categoría
- `DELETE /api/categories/:id` — Eliminar categoría

### Gastos

- `GET /api/expenses` — Listar gastos (con filtros)
- `GET /api/expenses/summary` — Resumen agrupado por período
- `GET /api/expenses/:id` — Obtener gasto detallado
- `POST /api/expenses` — Crear gasto (EXPENSE o SETTLEMENT)
- `PUT /api/expenses/:id` — Actualizar gasto
- `DELETE /api/expenses/:id` — Eliminar gasto
- `POST /api/expenses/:id/attachments` — Adjuntar archivo
- `DELETE /api/expenses/:expenseId/attachments/:attachmentId` — Eliminar adjunto

### Deudas

- `GET /api/debts` — Consultar deudas actuales (calculadas al vuelo)
- `POST /api/debts/settle` — Registrar liquidación de deuda

## Modelo de Datos

- **User** — Usuario autenticado (email, password, name)
- **Person** — Persona asociada a un usuario (name, lastName, avatarUrl, identifier, linkedUserId)
- **Category** — Categoría de gasto (name, color, icon)
- **Expense** — Gasto o liquidación (title, description, amount, date, type, splitType, payerId)
- **ExpenseParticipant** — Participante de un gasto (share, percentage/amount según splitType)
- **Attachment** — Archivo adjunto a un gasto (filename, mimeType, size, type)
- **Debt** — Registro de deuda entre personas (debtorId, creditorId, amount, settled)

Todas las entidades están scoped al `userId` del usuario autenticado.
Las deudas actuales se calculan al vuelo en `GET /api/debts` agregando los `ExpenseParticipant`.
Los gastos tipo `SETTLEMENT` se excluyen del cálculo de deudas.
