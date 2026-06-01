import { Router, Response } from 'express';
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
    const dir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880') },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const people = await prisma.person.findMany({
      where: {
        OR: [
          { userId: req.userId },
          { linkedUserId: { not: null }, userId: { not: req.userId } },
        ],
      },
      orderBy: { name: 'asc' },
    });
    res.json(people);
  } catch (error: any) {
    logger.error('Error fetching people', { userId: req.userId, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const person = await prisma.person.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { userId: req.userId },
          { linkedUserId: { not: null } },
        ],
      },
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });
    res.json(person);
  } catch (error: any) {
    logger.error('Error fetching person', { userId: req.userId, personId: req.params.id, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/stats', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { period = 'all', date } = req.query as { period?: string; date?: string };

    const person = await prisma.person.findFirst({
      where: { id, OR: [{ userId: req.userId }, { linkedUserId: { not: null } }] },
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    let dateFilter: any = {};
    if (period !== 'all' && date) {
      const d = dayjs(date);
      let start: Date, end: Date;
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
      dateFilter = { date: { gte: start, lte: end } };
    }

    const baseExpenseWhere = { type: 'EXPENSE', ...dateFilter };

    const [totalPaidResult, owedResult, paidForResult] = await Promise.all([
      prisma.expense.aggregate({
        where: { payerId: id, ...baseExpenseWhere },
        _sum: { amount: true },
      }),
      prisma.expenseParticipant.aggregate({
        where: {
          personId: { not: id },
          expense: { payerId: id, ...baseExpenseWhere },
        },
        _sum: { share: true },
      }),
      prisma.expenseParticipant.aggregate({
        where: {
          personId: id,
          expense: { payerId: { not: id }, ...baseExpenseWhere },
        },
        _sum: { share: true },
      }),
    ]);

    res.json({
      totalPaid: Number(totalPaidResult._sum.amount || 0),
      owedToThem: Number(owedResult._sum.share || 0),
      paidForThem: Number(paidForResult._sum.share || 0),
    });
  } catch (error: any) {
    logger.error('Error fetching person stats', { userId: req.userId, personId: req.params.id, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, lastName, identifier } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const person = await prisma.person.create({
      data: { name, lastName, identifier, userId: req.userId! },
    });
    logger.info('Person created', { userId: req.userId, personId: person.id, name });
    res.status(201).json(person);
  } catch (error: any) {
    logger.error('Error creating person', { userId: req.userId, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  try {
    const person = await prisma.person.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const { name, lastName } = req.body;
    let avatarUrl = person.avatarUrl;

    if (req.file) {
      if (person.avatarUrl) {
        const oldPath = path.join(process.env.UPLOAD_DIR || './uploads', path.basename(person.avatarUrl));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      avatarUrl = `/uploads/${req.file.filename}`;
    }

    const updated = await prisma.person.update({
      where: { id: req.params.id },
      data: { name: name || person.name, lastName, avatarUrl },
    });
    logger.info('Person updated', { userId: req.userId, personId: req.params.id });
    res.json(updated);
  } catch (error: any) {
    logger.error('Error updating person', { userId: req.userId, personId: req.params.id, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/chart', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { period = 'week', date } = req.query as { period?: string; date?: string };

    const person = await prisma.person.findFirst({
      where: { id, OR: [{ userId: req.userId }, { linkedUserId: { not: null } }] },
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const d = dayjs(date || dayjs().format('YYYY-MM-DD'));

    // Determine date range and bucket labels
    let start: dayjs.Dayjs;
    let end: dayjs.Dayjs;
    let buckets: { label: string; start: dayjs.Dayjs; end: dayjs.Dayjs }[] = [];

    if (period === 'day') {
      start = d.startOf('day');
      end = d.endOf('day');
      buckets.push({ label: d.format('DD/MM'), start, end });
    } else if (period === 'week') {
      start = d.startOf('week');
      end = d.endOf('week');
      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      for (let i = 0; i < 7; i++) {
        const day = start.add(i, 'day');
        buckets.push({ label: dayNames[day.day()], start: day.startOf('day'), end: day.endOf('day') });
      }
    } else if (period === 'month') {
      start = d.startOf('month');
      end = d.endOf('month');
      let weekStart = start.startOf('week');
      let weekNum = 1;
      while (weekStart.isBefore(end) || weekStart.isSame(end, 'day')) {
        const weekEnd = weekStart.endOf('week');
        const clampedStart = weekStart.isBefore(start) ? start : weekStart;
        const clampedEnd = weekEnd.isAfter(end) ? end : weekEnd;
        buckets.push({ label: `Sem ${weekNum}`, start: clampedStart, end: clampedEnd });
        weekStart = weekStart.add(1, 'week');
        weekNum++;
        if (weekNum > 6) break;
      }
    } else if (period === 'year') {
      start = d.startOf('year');
      end = d.endOf('year');
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      for (let m = 0; m < 12; m++) {
        const monthDay = start.add(m, 'month');
        buckets.push({ label: monthNames[m], start: monthDay.startOf('month'), end: monthDay.endOf('month') });
      }
    } else {
      // all — group by year from first expense to current year
      const firstExpense = await prisma.expense.findFirst({
        where: { type: 'EXPENSE' },
        orderBy: { date: 'asc' },
        select: { date: true },
      });
      const firstYear = firstExpense ? dayjs(firstExpense.date).year() : d.year();
      const currentYear = d.year();
      start = dayjs(`${firstYear}-01-01`).startOf('year');
      end = dayjs(`${currentYear}-12-31`).endOf('year');
      for (let y = firstYear; y <= currentYear; y++) {
        const yearDay = dayjs(`${y}-01-01`);
        buckets.push({ label: String(y), start: yearDay.startOf('year'), end: yearDay.endOf('year') });
      }
    }

    // Fetch all paid expenses in range (with participants)
    const paidExpenses = await prisma.expense.findMany({
      where: {
        payerId: id,
        type: 'EXPENSE',
        date: { gte: start.toDate(), lte: end.toDate() },
      },
      include: { participants: true },
    });

    // Fetch participations where this person is NOT the payer
    const participations = await prisma.expenseParticipant.findMany({
      where: {
        personId: id,
        expense: {
          payerId: { not: id },
          type: 'EXPENSE',
          date: { gte: start.toDate(), lte: end.toDate() },
        },
      },
      include: { expense: { select: { date: true } } },
    });

    // Map to buckets
    const result = buckets.map(({ label, start: bs, end: be }) => {
      let totalPaid = 0;
      let owedToThem = 0;
      let paidForThem = 0;

      for (const exp of paidExpenses) {
        const expDate = dayjs(exp.date);
        if ((expDate.isAfter(bs) || expDate.isSame(bs, 'minute')) &&
            (expDate.isBefore(be) || expDate.isSame(be, 'minute'))) {
          totalPaid += Number(exp.amount);
          for (const p of exp.participants) {
            if (p.personId !== id) owedToThem += Number(p.share);
          }
        }
      }

      for (const part of participations) {
        const expDate = dayjs(part.expense.date);
        if ((expDate.isAfter(bs) || expDate.isSame(bs, 'minute')) &&
            (expDate.isBefore(be) || expDate.isSame(be, 'minute'))) {
          paidForThem += Number(part.share);
        }
      }

      return { label, totalPaid, owedToThem, paidForThem };
    });

    res.json(result);
  } catch (error: any) {
    logger.error('Error fetching person chart', { userId: req.userId, personId: req.params.id, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const person = await prisma.person.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const expenseCount = await prisma.expense.count({
      where: {
        OR: [
          { payerId: req.params.id },
          { participants: { some: { personId: req.params.id } } },
        ],
      },
    });
    if (expenseCount > 0) {
      return res.status(409).json({ error: 'No se puede eliminar una persona con gastos asociados' });
    }

    if (person.avatarUrl) {
      const oldPath = path.join(process.env.UPLOAD_DIR || './uploads', path.basename(person.avatarUrl));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await prisma.person.delete({ where: { id: req.params.id } });
    logger.info('Person deleted', { userId: req.userId, personId: req.params.id, name: person.name });
    res.status(204).send();
  } catch (error: any) {
    logger.error('Error deleting person', { userId: req.userId, personId: req.params.id, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
