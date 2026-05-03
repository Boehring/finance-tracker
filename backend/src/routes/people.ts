import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest, authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const people = await prisma.person.findMany({
      where: { userId: req.userId },
      orderBy: { name: 'asc' },
    });
    res.json(people);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const person = await prisma.person.create({
      data: { name, userId: req.userId! },
    });
    res.status(201).json(person);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    const person = await prisma.person.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const updated = await prisma.person.update({
      where: { id: req.params.id },
      data: { name },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const person = await prisma.person.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    await prisma.person.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
