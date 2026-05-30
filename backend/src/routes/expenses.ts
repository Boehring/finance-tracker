import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../index';
import { AuthRequest, authenticate } from '../middleware/auth';
import logger from '../utils/logger';
import dayjs from 'dayjs';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880') },
});

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { period, date } = req.query;
    let where: any = { createdBy: { id: req.userId } };

    if (period && date) {
      const d = dayjs(date as string);
      let start, end;

      switch (period) {
        case 'day':
          start = d.startOf('day').toDate();
          end = d.endOf('day').toDate();
          break;
        case 'week':
          start = d.startOf('week').toDate();
          end = d.endOf('week').toDate();
          break;
        case 'month':
          start = d.startOf('month').toDate();
          end = d.endOf('month').toDate();
          break;
        case 'year':
          start = d.startOf('year').toDate();
          end = d.endOf('year').toDate();
          break;
        default:
          start = d.startOf('day').toDate();
          end = d.endOf('day').toDate();
      }

      where.date = { gte: start, lte: end };
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        category: true,
        payer: true,
        participants: { include: { person: true } },
        attachments: true,
      },
      orderBy: { date: 'desc' },
    });

    res.json(expenses);
  } catch (error: any) {
    logger.error('Error fetching expenses', { userId: req.userId, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const { period, date } = req.query;
    const d = dayjs(date as string || undefined);

    let start, end, groupFormat;

    switch (period) {
      case 'day':
        start = d.startOf('day').toDate();
        end = d.endOf('day').toDate();
        groupFormat = 'HH:mm';
        break;
      case 'week':
        start = d.startOf('week').toDate();
        end = d.endOf('week').toDate();
        groupFormat = 'YYYY-MM-DD';
        break;
      case 'month':
        start = d.startOf('month').toDate();
        end = d.endOf('month').toDate();
        groupFormat = 'YYYY-MM-DD';
        break;
      case 'year':
        start = d.startOf('year').toDate();
        end = d.endOf('year').toDate();
        groupFormat = 'YYYY-MM';
        break;
      default:
        start = d.startOf('day').toDate();
        end = d.endOf('day').toDate();
        groupFormat = 'HH:mm';
    }

    const expenses = await prisma.expense.findMany({
      where: {
        createdById: req.userId,
        date: { gte: start, lte: end },
      },
      include: {
        category: true,
        payer: true,
        participants: { include: { person: true } },
        attachments: true,
      },
      orderBy: { date: 'asc' },
    });

    const grouped = expenses.reduce((acc: any, exp) => {
      const key = dayjs(exp.date).format(groupFormat);
      if (!acc[key]) acc[key] = [];
      acc[key].push(exp);
      return acc;
    }, {});

    res.json(grouped);
  } catch (error: any) {
    logger.error('Error fetching expense summary', { userId: req.userId, period: req.query.period, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const expense = await prisma.expense.findFirst({
      where: { id: req.params.id, createdById: req.userId },
      include: {
        category: true,
        payer: true,
        participants: { include: { person: true } },
        attachments: true,
      },
    });

    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json(expense);
  } catch (error: any) {
    logger.error('Error fetching expense', { userId: req.userId, expenseId: req.params.id, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      description,
      amount,
      date,
      categoryId,
      payerId,
      splitType,
      participants,
    } = req.body;

    if (!title || !amount || !date || !payerId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const payer = await prisma.person.findFirst({
      where: { id: payerId, userId: req.userId },
    });
    if (!payer) return res.status(404).json({ error: 'Payer not found' });

    const result = await prisma.$transaction(async (prisma) => {
      const expense = await prisma.expense.create({
        data: {
          title,
          description,
          amount: parseFloat(amount),
          date: new Date(date),
          splitType: splitType || 'PERCENTAGE',
          categoryId,
          payerId,
          createdById: req.userId!,
        },
      });

      if (participants && participants.length > 0) {
        if (splitType === 'PERCENTAGE') {
          const totalPercentage = participants.reduce((sum: number, p: any) => sum + parseFloat(p.percentage), 0);
          if (Math.abs(totalPercentage - 100) > 0.01) {
            throw new Error('Percentages must sum to 100');
          }

          for (const p of participants) {
            const share = (parseFloat(amount) * parseFloat(p.percentage)) / 100;
            await prisma.expenseParticipant.create({
              data: {
                expenseId: expense.id,
                personId: p.personId,
                percentage: parseFloat(p.percentage),
                share,
              },
            });
          }
        } else {
          const totalAmount = participants.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);
          if (Math.abs(totalAmount - parseFloat(amount)) > 0.01) {
            throw new Error('Amounts must sum to total expense');
          }

          for (const p of participants) {
            await prisma.expenseParticipant.create({
              data: {
                expenseId: expense.id,
                personId: p.personId,
                amount: parseFloat(p.amount),
                share: parseFloat(p.amount),
              },
            });
          }
        }
      }

      return expense;
    });

    const created = await prisma.expense.findUnique({
      where: { id: result.id },
      include: {
        category: true,
        payer: true,
        participants: { include: { person: true } },
        attachments: true,
      },
    });

    logger.info('Expense created', {
      userId: req.userId,
      expenseId: result.id,
      amount: parseFloat(amount),
      title,
    });
    res.status(201).json(created);
  } catch (error: any) {
    logger.error('Error creating expense', { userId: req.userId, error: error.message });
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/attachments', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const expense = await prisma.expense.findFirst({
      where: { id: req.params.id, createdById: req.userId },
    });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const attachment = await prisma.attachment.create({
      data: {
        expenseId: req.params.id,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        path: req.file.path,
        size: req.file.size,
        type: req.file.mimetype.startsWith('image/') ? 'image' : 'file',
      },
    });

    logger.info('Attachment uploaded', {
      userId: req.userId,
      expenseId: req.params.id,
      attachmentId: attachment.id,
      originalName: req.file.originalname,
      size: req.file.size,
    });
    res.status(201).json(attachment);
  } catch (error: any) {
    logger.error('Error uploading attachment', { userId: req.userId, expenseId: req.params.id, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:expenseId/attachments/:attachmentId', async (req: AuthRequest, res: Response) => {
  try {
    const expense = await prisma.expense.findFirst({
      where: { id: req.params.expenseId, createdById: req.userId },
    });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    const attachment = await prisma.attachment.findFirst({
      where: { id: req.params.attachmentId, expenseId: req.params.expenseId },
    });
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

    await prisma.attachment.delete({ where: { id: req.params.attachmentId } });

    if (fs.existsSync(attachment.path)) {
      fs.unlinkSync(attachment.path);
    }

    logger.info('Attachment deleted', {
      userId: req.userId,
      expenseId: req.params.expenseId,
      attachmentId: req.params.attachmentId,
    });
    res.status(204).send();
  } catch (error: any) {
    logger.error('Error deleting attachment', { userId: req.userId, expenseId: req.params.expenseId, attachmentId: req.params.attachmentId, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const expense = await prisma.expense.findFirst({
      where: { id: req.params.id, createdById: req.userId },
    });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    const { title, description, amount, date, categoryId, payerId, splitType, participants } = req.body;

    const updated = await prisma.$transaction(async (prisma) => {
      const updatedExpense = await prisma.expense.update({
        where: { id: req.params.id },
        data: {
          title,
          description,
          amount: amount ? parseFloat(amount) : undefined,
          date: date ? new Date(date) : undefined,
          categoryId,
          payerId,
          splitType,
        },
      });

      if (participants) {
        await prisma.expenseParticipant.deleteMany({ where: { expenseId: req.params.id } });

        if (splitType === 'PERCENTAGE') {
          for (const p of participants) {
            const share = (parseFloat(amount || expense.amount.toString()) * parseFloat(p.percentage)) / 100;
            await prisma.expenseParticipant.create({
              data: {
                expenseId: expense.id,
                personId: p.personId,
                percentage: parseFloat(p.percentage),
                share,
              },
            });
          }
        } else {
          for (const p of participants) {
            await prisma.expenseParticipant.create({
              data: {
                expenseId: expense.id,
                personId: p.personId,
                amount: parseFloat(p.amount),
                share: parseFloat(p.amount),
              },
            });
          }
        }
      }

      return updatedExpense;
    });

    const result = await prisma.expense.findUnique({
      where: { id: updated.id },
      include: {
        category: true,
        payer: true,
        participants: { include: { person: true } },
        attachments: true,
      },
    });

    logger.info('Expense updated', { userId: req.userId, expenseId: req.params.id, title });
    res.json(result);
  } catch (error: any) {
    logger.error('Error updating expense', { userId: req.userId, expenseId: req.params.id, error: error.message });
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const expense = await prisma.expense.findFirst({
      where: { id: req.params.id, createdById: req.userId },
    });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    await prisma.expense.delete({ where: { id: req.params.id } });
    logger.info('Expense deleted', { userId: req.userId, expenseId: req.params.id, title: expense.title });
    res.status(204).send();
  } catch (error: any) {
    logger.error('Error deleting expense', { userId: req.userId, expenseId: req.params.id, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
