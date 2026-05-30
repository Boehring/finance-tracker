import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest, authenticate } from '../middleware/auth';
import logger from '../utils/logger';
import dayjs from 'dayjs';

const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const people = await prisma.person.findMany({
      where: { userId: req.userId },
    });

    const debts: any[] = [];

    for (const person of people) {
      const expensesAsPayer = await prisma.expense.findMany({
        where: {
          payerId: person.id,
          createdById: req.userId,
          type: 'EXPENSE',
        },
        include: {
          participants: { include: { person: true } },
        },
      });

      const paidForOthers = expensesAsPayer.reduce((acc, expense) => {
        const payerParticipation = expense.participants.find(p => p.personId === person.id);
        const payerShare = payerParticipation ? parseFloat(payerParticipation.share.toString()) : 0;
        return acc + (parseFloat(expense.amount.toString()) - payerShare);
      }, 0);

      const participations = await prisma.expenseParticipant.findMany({
        where: {
          personId: person.id,
          expense: {
            createdById: req.userId,
            type: 'EXPENSE',
          },
        },
        include: {
          expense: { include: { payer: true } },
        },
      });

      const owesToOthers = participations.reduce((acc, part) => {
        if (part.expense.payerId !== person.id) {
          return acc + parseFloat(part.share.toString());
        }
        return acc;
      }, 0);

      const netDebt = owesToOthers - paidForOthers;

      if (netDebt !== 0) {
        debts.push({
          personId: person.id,
          personName: person.name,
          owes: netDebt > 0 ? netDebt : 0,
          isOwed: netDebt < 0 ? Math.abs(netDebt) : 0,
          netDebt,
        });
      }
    }

    const detailedDebts: any[] = [];

    for (const person of people) {
      const participations = await prisma.expenseParticipant.findMany({
        where: {
          personId: person.id,
          expense: {
            createdById: req.userId,
            type: 'EXPENSE',
          },
        },
        include: {
          expense: { include: { payer: true } },
        },
      });

      for (const part of participations) {
        if (part.expense.payerId !== person.id) {
          const existing = detailedDebts.find(
            d => d.debtorId === person.id && d.creditorId === part.expense.payerId
          );

          if (existing) {
            existing.amount += parseFloat(part.share.toString());
          } else {
            detailedDebts.push({
              debtorId: person.id,
              debtorName: person.name,
              creditorId: part.expense.payerId,
              creditorName: part.expense.payer.name,
              amount: parseFloat(part.share.toString()),
            });
          }
        }
      }
    }

    logger.info('Debts calculated', { userId: req.userId, peopleCount: people.length, debtsCount: detailedDebts.length });
    res.json({ summary: debts, details: detailedDebts });
  } catch (error: any) {
    logger.error('Error calculating debts', { userId: req.userId, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/settle', async (req: AuthRequest, res: Response) => {
  try {
    const { debtorId, creditorId, amount, date } = req.body;

    if (!debtorId || !creditorId || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const debtor = await prisma.person.findFirst({
      where: { id: debtorId, userId: req.userId },
    });
    if (!debtor) return res.status(404).json({ error: 'Debtor not found' });

    const creditor = await prisma.person.findFirst({
      where: { id: creditorId, userId: req.userId },
    });
    if (!creditor) return res.status(404).json({ error: 'Creditor not found' });

    const result = await prisma.$transaction(async (prisma) => {
      const settlementExpense = await prisma.expense.create({
        data: {
          title: `Settlement: ${debtor.name} to ${creditor.name}`,
          amount: parseFloat(amount),
          date: date ? new Date(date) : new Date(),
          type: 'SETTLEMENT',
          payerId: debtorId,
          createdById: req.userId!,
        },
      });

      await prisma.expenseParticipant.create({
        data: {
          expenseId: settlementExpense.id,
          personId: creditorId,
          share: parseFloat(amount),
        },
      });

      return settlementExpense;
    });

    logger.info('Debt settled', {
      userId: req.userId,
      settlementId: result.id,
      debtor: debtor.name,
      creditor: creditor.name,
      amount: parseFloat(amount),
    });
    res.status(201).json({ message: 'Debt settled successfully', settlement: result });
  } catch (error: any) {
    logger.error('Error settling debt', { userId: req.userId, error: error.message });
    res.status(400).json({ error: error.message });
  }
});

export default router;
