import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { AuthRequest, authenticate } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const identifier = email.split('@')[0];
    const existing = await prisma.user.findUnique({ where: { id: identifier } });
    if (existing) {
      logger.warn('Registration failed: identifier already exists', { identifier });
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { id: identifier, email, password: hashedPassword, name },
    });

    await prisma.person.create({
      data: {
        name: name || identifier,
        identifier,
        userId: user.id,
        linkedUserId: user.id,
      },
    });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    logger.info('User registered', { userId: user.id, email });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error: any) {
    logger.error('Registration error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      logger.warn('Login failed: user not found', { email });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      logger.warn('Login failed: invalid password', { email });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    logger.info('User logged in', { userId: user.id, email });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error: any) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      logger.warn('User not found in /me', { userId: req.userId });
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error: any) {
    logger.error('Error fetching user profile', { userId: req.userId, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.put('/password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Se requiere contraseña actual y nueva contraseña' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      logger.warn('Password change failed: wrong current password', { userId: req.userId });
      return res.status(400).json({ error: 'La contraseña actual no es correcta' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.userId }, data: { password: hashed } });
    logger.info('Password changed', { userId: req.userId });
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error: any) {
    logger.error('Error changing password', { userId: req.userId, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
