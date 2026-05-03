# Finance Tracker - Gastos Compartidos

Aplicación para registrar y gestionar gastos compartidos entre diferentes personas.

## Características

- Registro de gastos con múltiples participantes
- Participación por porcentaje o importe fijo
- Adjuntar imágenes y ficheros a los gastos
- Categorización de gastos
- Vistas por día, semana, mes y año
- Cálculo automático de deudas entre personas
- Funcionalidad para saldar deudas
- Gestión de personas
- Autenticación de usuarios
- Persistencia en PostgreSQL

## Tecnologías

### Backend
- Node.js + Express + TypeScript
- PostgreSQL + Prisma ORM
- JWT para autenticación
- Multer para subida de archivos

### Frontend
- React + TypeScript
- Vite
- React Router
- Axios

## Requisitos Previos

- Node.js (v18 o superior)
- PostgreSQL en ejecución
- npm o yarn

## Configuración

### 1. Base de Datos

Asegúrate de que PostgreSQL esté en ejecución y crea una base de datos:

```sql
CREATE DATABASE finance_tracker;
```

### 2. Backend

```bash
cd backend
npm install
```

Edita el archivo `.env` con tus credenciales de PostgreSQL:

```env
DATABASE_URL="postgresql://usuario:password@localhost:5432/finance_tracker?schema=public"
JWT_SECRET="tu-clave-secreta-jwt"
PORT=3001
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE=5242880
```

Ejecuta las migraciones:

```bash
npx prisma migrate dev --name init
```

Inicia el servidor:

```bash
npm run dev
```

El backend estará disponible en `http://localhost:3001`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

El frontend estará disponible en `http://localhost:5173`

## Uso

1. Regístrate o inicia sesión
2. Añade personas (amigos, familiares, compañeros)
3. Crea categorías para organizar los gastos
4. Registra gastos indicando quién pagó y quiénes participan
5. Visualiza los gastos por día, semana, mes o año
6. Consulta las deudas entre personas
7. Salda deudas cuando sea necesario

## Estructura del Proyecto

```
finance-tracker/
├── backend/
│   ├── src/
│   │   ├── routes/       # Rutas de la API
│   │   ├── middleware/   # Middleware (auth, error handler)
│   │   └── index.ts     # Punto de entrada
│   ├── prisma/
│   │   └── schema.prisma # Esquema de base de datos
│   └── uploads/          # Archivos subidos
└── frontend/
    ├── src/
    │   ├── pages/        # Páginas de la aplicación
    │   ├── components/   # Componentes reutilizables
    │   ├── hooks/        # Custom hooks
    │   └── services/     # Servicios (API)
    └── public/
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/login` - Inicio de sesión
- `GET /api/auth/me` - Obtener usuario actual

### Personas
- `GET /api/people` - Listar personas
- `POST /api/people` - Crear persona
- `PUT /api/people/:id` - Actualizar persona
- `DELETE /api/people/:id` - Eliminar persona

### Categorías
- `GET /api/categories` - Listar categorías
- `POST /api/categories` - Crear categoría
- `PUT /api/categories/:id` - Actualizar categoría
- `DELETE /api/categories/:id` - Eliminar categoría

### Gastos
- `GET /api/expenses` - Listar gastos
- `GET /api/expenses/summary` - Resumen agrupado por período
- `GET /api/expenses/:id` - Obtener gasto
- `POST /api/expenses` - Crear gasto
- `PUT /api/expenses/:id` - Actualizar gasto
- `DELETE /api/expenses/:id` - Eliminar gasto
- `POST /api/expenses/:id/attachments` - Adjuntar archivo

### Deudas
- `GET /api/debts` - Consultar deudas
- `POST /api/debts/settle` - Saldar deuda
