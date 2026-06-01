import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest, authenticate } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (error: any) {
    logger.error('Error fetching categories', { userId: req.userId, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, color, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const category = await prisma.category.create({
      data: { name, color, icon, userId: req.userId! },
    });
    logger.info('Category created', { userId: req.userId, categoryId: category.id, name });
    res.status(201).json(category);
  } catch (error: any) {
    logger.error('Error creating category', { userId: req.userId, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const period = (req.query.period as string) || 'all';
    const dateParam = req.query.date as string | undefined;

    let startDate: Date | undefined;
    let endDate: Date | undefined;
    const ref = dateParam ? new Date(dateParam) : new Date();

    if (period === 'day') {
      startDate = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
      endDate = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);
    } else if (period === 'week') {
      const weekStart = new Date(ref);
      weekStart.setDate(ref.getDate() - ref.getDay());
      weekStart.setHours(0, 0, 0, 0);
      startDate = weekStart;
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      endDate = weekEnd;
    } else if (period === 'month') {
      startDate = new Date(ref.getFullYear(), ref.getMonth(), 1);
      endDate = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (period === 'year') {
      startDate = new Date(ref.getFullYear(), 0, 1);
      endDate = new Date(ref.getFullYear(), 11, 31, 23, 59, 59, 999);
    }

    const dateFilter = startDate && endDate ? { gte: startDate, lte: endDate } : startDate ? { gte: startDate } : undefined;

    const categories = await prisma.category.findMany({
      where: { userId: req.userId },
      orderBy: { name: 'asc' },
    });

    const grouped = await prisma.expense.groupBy({
      by: ['categoryId'],
      where: {
        createdById: req.userId,
        type: 'EXPENSE',
        ...(dateFilter ? { date: dateFilter } : {}),
        categoryId: { not: null },
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const statsMap = new Map(grouped.map(g => [g.categoryId, g]));

    const stats = categories.map(cat => {
      const g = statsMap.get(cat.id);
      return {
        id: cat.id,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        totalAmount: g?._sum.amount ? Number(g._sum.amount) : 0,
        expenseCount: g?._count?.id ?? 0,
      };
    });

    logger.info('Category stats fetched', { userId: req.userId, period, count: stats.length });
    res.json(stats);
  } catch (error: any) {
    logger.error('Error fetching category stats', { userId: req.userId, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, color, icon } = req.body;
    const category = await prisma.category.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const updated = await prisma.category.update({
      where: { id: req.params.id },
      data: { name, color, icon },
    });
    logger.info('Category updated', { userId: req.userId, categoryId: req.params.id, name });
    res.json(updated);
  } catch (error: any) {
    logger.error('Error updating category', { userId: req.userId, categoryId: req.params.id, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const category = await prisma.category.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    await prisma.category.delete({ where: { id: req.params.id } });
    logger.info('Category deleted', { userId: req.userId, categoryId: req.params.id, name: category.name });
    res.status(204).send();
  } catch (error: any) {
    logger.error('Error deleting category', { userId: req.userId, categoryId: req.params.id, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
