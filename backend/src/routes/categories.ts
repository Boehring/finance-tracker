import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest, authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      where: { userId: req.userId },
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (error: any) {
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
    res.status(201).json(category);
  } catch (error: any) {
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
    res.json(updated);
  } catch (error: any) {
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
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
