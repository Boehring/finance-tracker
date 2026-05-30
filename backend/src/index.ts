import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import personRoutes from './routes/people';
import categoryRoutes from './routes/categories';
import expenseRoutes from './routes/expenses';
import debtRoutes from './routes/debts';
import { errorHandler } from './middleware/errorHandler';
import logger from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

export const prisma = new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
});

prisma.$on('warn' as any, (e: any) => {
  logger.warn('Prisma warning', { message: e.message, target: e.target });
});

prisma.$on('error' as any, (e: any) => {
  logger.error('Prisma error', { message: e.message, target: e.target });
});

const morganStream = { write: (message: string) => logger.info(message.trim()) };
morgan.token('userId', (req: any) => req.userId || 'anonymous');

app.use(morgan(':method :url :status :response-time ms - userId::userId', { stream: morganStream }));
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/people', personRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/debts', debtRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`, { env: process.env.NODE_ENV || 'development' });
});
