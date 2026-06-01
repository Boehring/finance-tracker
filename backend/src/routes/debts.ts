import { Router, Response } from 'express';
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

    // Phase 1: load all expense participations
    const expenseParticipations = await prisma.expenseParticipant.findMany({
      where: { expense: { createdById: req.userId!, type: 'EXPENSE' } },
      include: {
        expense: { include: { payer: { select: { id: true, name: true } } } },
        person: { select: { id: true, name: true } },
      },
    });

    // Phase 2: load all settlement participations
    const settlementParticipations = await prisma.expenseParticipant.findMany({
      where: { expense: { createdById: req.userId!, type: 'SETTLEMENT' } },
      include: { expense: { select: { payerId: true } } },
    });

    // Build directional flow matrix: flow[debtorId][creditorId] = gross amount
    const flow: Record<string, Record<string, number>> = {};
    const addFlow = (from: string, to: string, amount: number) => {
      if (!flow[from]) flow[from] = {};
      flow[from][to] = (flow[from][to] ?? 0) + amount;
    };

    for (const part of expenseParticipations) {
      // Participant is not the payer → participant owes payer their share
      if (part.person.id !== part.expense.payer.id) {
        addFlow(part.person.id, part.expense.payer.id, parseFloat(part.share.toString()));
      }
    }

    for (const settlement of settlementParticipations) {
      // Settlement: payer=debtor, participant=creditor → reduces debtor→creditor flow
      addFlow(settlement.expense.payerId, settlement.personId, -parseFloat(settlement.share.toString()));
    }

    // Phase 3: net opposing flows per pair → final debts
    const detailedDebts: {
      debtorId: string;
      debtorName: string;
      creditorId: string;
      creditorName: string;
      amount: number;
    }[] = [];

    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        const personA = people[i];
        const personB = people[j];

        const AowesB = flow[personA.id]?.[personB.id] ?? 0;
        const BowesA = flow[personB.id]?.[personA.id] ?? 0;
        const net = AowesB - BowesA;

        if (net > 0.005) {
          detailedDebts.push({ debtorId: personA.id, debtorName: personA.name, creditorId: personB.id, creditorName: personB.name, amount: net });
        } else if (net < -0.005) {
          detailedDebts.push({ debtorId: personB.id, debtorName: personB.name, creditorId: personA.id, creditorName: personA.name, amount: -net });
        }
      }
    }

    // Derive summary directly from netted debts for consistency
    const summaryMap: Record<string, { personId: string; personName: string; owes: number; isOwed: number }> = {};
    for (const debt of detailedDebts) {
      if (!summaryMap[debt.debtorId]) summaryMap[debt.debtorId] = { personId: debt.debtorId, personName: debt.debtorName, owes: 0, isOwed: 0 };
      if (!summaryMap[debt.creditorId]) summaryMap[debt.creditorId] = { personId: debt.creditorId, personName: debt.creditorName, owes: 0, isOwed: 0 };
      summaryMap[debt.debtorId].owes += debt.amount;
      summaryMap[debt.creditorId].isOwed += debt.amount;
    }
    const summary = Object.values(summaryMap).map(s => ({ ...s, netDebt: s.owes - s.isOwed }));

    // Monthly breakdown: gross debts per month (no cross-month netting)
    const monthlyDetailsMap: Record<string, { debtorId: string; debtorName: string; creditorId: string; creditorName: string; amount: number }[]> = {};

    for (const part of expenseParticipations) {
      if (part.person.id !== part.expense.payer.id) {
        const month = dayjs(part.expense.date).format('YYYY-MM');
        if (!monthlyDetailsMap[month]) monthlyDetailsMap[month] = [];
        const share = parseFloat(part.share.toString());
        const existing = monthlyDetailsMap[month].find(
          d => d.debtorId === part.person.id && d.creditorId === part.expense.payer.id
        );
        if (existing) {
          existing.amount += share;
        } else {
          monthlyDetailsMap[month].push({
            debtorId: part.person.id,
            debtorName: part.person.name,
            creditorId: part.expense.payer.id,
            creditorName: part.expense.payer.name,
            amount: share,
          });
        }
      }
    }

    const monthlyDetails = Object.entries(monthlyDetailsMap)
      .map(([month, debts]) => ({ month, debts }))
      .sort((a, b) => b.month.localeCompare(a.month));

    logger.info('Debts calculated', { userId: req.userId, peopleCount: people.length, debtsCount: detailedDebts.length });
    res.json({ summary, details: detailedDebts, monthlyDetails });
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
