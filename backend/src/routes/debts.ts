import { Router, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest, authenticate } from '../middleware/auth';
import logger from '../utils/logger';
import dayjs from 'dayjs';

const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const myPersons = await prisma.person.findMany({
      where: { userId: req.userId },
      select: { id: true },
    });
    const myPersonIds = myPersons.map(p => p.id);

    const expenseParticipations = await prisma.expenseParticipant.findMany({
      where: {
        expense: {
          type: 'EXPENSE',
          OR: [
            { createdById: req.userId! },
            ...(myPersonIds.length > 0 ? [
              { payerId: { in: myPersonIds } },
              { participants: { some: { personId: { in: myPersonIds } } } },
            ] : []),
          ],
        },
      },
      include: {
        expense: { include: { payer: { select: { id: true, name: true } } } },
        person: { select: { id: true, name: true } },
      },
    });

    const peopleMap: Record<string, { id: string; name: string }> = {};
    for (const part of expenseParticipations) {
      if (!peopleMap[part.person.id]) peopleMap[part.person.id] = part.person;
      if (!peopleMap[part.expense.payer.id]) peopleMap[part.expense.payer.id] = part.expense.payer;
    }
    const people = Object.values(peopleMap);

    // Load all settlements, including date for monthly grouping
    const settlementParticipations = await prisma.expenseParticipant.findMany({
      where: {
        expense: {
          type: 'SETTLEMENT',
          OR: [
            { createdById: req.userId! },
            ...(myPersonIds.length > 0 ? [
              { payerId: { in: myPersonIds } },
              { participants: { some: { personId: { in: myPersonIds } } } },
            ] : []),
          ],
        },
      },
      include: { expense: { select: { payerId: true, date: true } } },
    });

    // Build global directional flow matrix
    const flow: Record<string, Record<string, number>> = {};
    const addFlow = (from: string, to: string, amount: number) => {
      if (!flow[from]) flow[from] = {};
      flow[from][to] = (flow[from][to] ?? 0) + amount;
    };

    for (const part of expenseParticipations) {
      if (part.person.id !== part.expense.payer.id) {
        addFlow(part.person.id, part.expense.payer.id, parseFloat(part.share.toString()));
      }
    }
    for (const settlement of settlementParticipations) {
      addFlow(settlement.expense.payerId, settlement.personId, -parseFloat(settlement.share.toString()));
    }

    // Net global debts
    const detailedDebts: {
      debtorId: string; debtorName: string; creditorId: string; creditorName: string; amount: number;
    }[] = [];

    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        const pA = people[i];
        const pB = people[j];
        const AowesB = flow[pA.id]?.[pB.id] ?? 0;
        const BowesA = flow[pB.id]?.[pA.id] ?? 0;
        const net = AowesB - BowesA;
        if (net > 0.005) {
          detailedDebts.push({ debtorId: pA.id, debtorName: pA.name, creditorId: pB.id, creditorName: pB.name, amount: net });
        } else if (net < -0.005) {
          detailedDebts.push({ debtorId: pB.id, debtorName: pB.name, creditorId: pA.id, creditorName: pA.name, amount: -net });
        }
      }
    }

    const summaryMap: Record<string, { personId: string; personName: string; owes: number; isOwed: number }> = {};
    for (const debt of detailedDebts) {
      if (!summaryMap[debt.debtorId]) summaryMap[debt.debtorId] = { personId: debt.debtorId, personName: debt.debtorName, owes: 0, isOwed: 0 };
      if (!summaryMap[debt.creditorId]) summaryMap[debt.creditorId] = { personId: debt.creditorId, personName: debt.creditorName, owes: 0, isOwed: 0 };
      summaryMap[debt.debtorId].owes += debt.amount;
      summaryMap[debt.creditorId].isOwed += debt.amount;
    }
    const summary = Object.values(summaryMap).map(s => ({ ...s, netDebt: s.owes - s.isOwed }));

    // Monthly breakdown: gross expense debts per month netted with settlements dated in that month
    // expenseFlow[month][debtor][creditor] = amount
    const expenseFlow: Record<string, Record<string, Record<string, number>>> = {};
    for (const part of expenseParticipations) {
      if (part.person.id !== part.expense.payer.id) {
        const month = dayjs(part.expense.date).format('YYYY-MM');
        if (!expenseFlow[month]) expenseFlow[month] = {};
        const from = part.person.id;
        const to = part.expense.payer.id;
        if (!expenseFlow[month][from]) expenseFlow[month][from] = {};
        expenseFlow[month][from][to] = (expenseFlow[month][from][to] ?? 0) + parseFloat(part.share.toString());
      }
    }

    // settleFlow[month][debtor][creditor] = amount (settlements grouped by their date month)
    const settleFlow: Record<string, Record<string, Record<string, number>>> = {};
    for (const settlement of settlementParticipations) {
      const month = dayjs(settlement.expense.date).format('YYYY-MM');
      if (!settleFlow[month]) settleFlow[month] = {};
      const from = settlement.expense.payerId;
      const to = settlement.personId;
      if (!settleFlow[month][from]) settleFlow[month][from] = {};
      settleFlow[month][from][to] = (settleFlow[month][from][to] ?? 0) + parseFloat(settlement.share.toString());
    }

    // For each expense-month, net with same-month settlements and build monthly debts
    const monthlyDetails = Object.entries(expenseFlow)
      .map(([month, mExpFlow]) => {
        const mSettleFlow = settleFlow[month] ?? {};

        const monthPeople = new Set<string>();
        for (const [from, tos] of Object.entries(mExpFlow)) {
          monthPeople.add(from);
          for (const to of Object.keys(tos)) monthPeople.add(to);
        }
        const monthPeopleArr = Array.from(monthPeople);

        const debts: { debtorId: string; debtorName: string; creditorId: string; creditorName: string; amount: number }[] = [];

        for (let i = 0; i < monthPeopleArr.length; i++) {
          for (let j = i + 1; j < monthPeopleArr.length; j++) {
            const pA = monthPeopleArr[i];
            const pB = monthPeopleArr[j];

            const AowesBExp = mExpFlow[pA]?.[pB] ?? 0;
            const BowesAExp = mExpFlow[pB]?.[pA] ?? 0;
            const AowesBSettle = mSettleFlow[pA]?.[pB] ?? 0;
            const BowesASettle = mSettleFlow[pB]?.[pA] ?? 0;

            const net = (AowesBExp - AowesBSettle) - (BowesAExp - BowesASettle);

            const nameA = peopleMap[pA]?.name ?? pA;
            const nameB = peopleMap[pB]?.name ?? pB;

            if (net > 0.005) {
              debts.push({ debtorId: pA, debtorName: nameA, creditorId: pB, creditorName: nameB, amount: net });
            } else if (net < -0.005) {
              debts.push({ debtorId: pB, debtorName: nameB, creditorId: pA, creditorName: nameA, amount: -net });
            }
          }
        }

        return { month, debts };
      })
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
    const { debtorId, creditorId, amount, date, month } = req.body;

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

    // When month is provided, validate against that month's net debt only
    let monthDateFilter: { gte: Date; lte: Date } | undefined;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      monthDateFilter = {
        gte: dayjs(month + '-01').startOf('month').toDate(),
        lte: dayjs(month + '-01').endOf('month').toDate(),
      };
    }

    const [expParts, settleParts] = await Promise.all([
      prisma.expenseParticipant.findMany({
        where: {
          expense: {
            type: 'EXPENSE',
            payerId: { in: [debtorId, creditorId] },
            ...(monthDateFilter ? { date: monthDateFilter } : {}),
          },
          personId: { in: [debtorId, creditorId] },
        },
        include: { expense: { select: { payerId: true } } },
      }),
      prisma.expenseParticipant.findMany({
        where: {
          expense: {
            type: 'SETTLEMENT',
            payerId: { in: [debtorId, creditorId] },
            ...(monthDateFilter ? { date: monthDateFilter } : {}),
          },
          personId: { in: [debtorId, creditorId] },
        },
        include: { expense: { select: { payerId: true } } },
      }),
    ]);

    let debtorToCreditor = 0;
    let creditorToDebtor = 0;
    for (const p of expParts) {
      if (p.personId !== p.expense.payerId) {
        if (p.personId === debtorId) debtorToCreditor += parseFloat(p.share.toString());
        else creditorToDebtor += parseFloat(p.share.toString());
      }
    }
    for (const s of settleParts) {
      if (s.expense.payerId === debtorId && s.personId === creditorId)
        debtorToCreditor -= parseFloat(s.share.toString());
      else if (s.expense.payerId === creditorId && s.personId === debtorId)
        creditorToDebtor -= parseFloat(s.share.toString());
    }
    const netDebt = debtorToCreditor - creditorToDebtor;
    if (parseFloat(amount) > netDebt + 0.01) {
      return res.status(400).json({
        error: `Settlement amount exceeds current net debt of ${Math.max(0, netDebt).toFixed(2)}`,
      });
    }

    // Date: explicit > end-of-month (when month provided) > today
    const settlementDate = date
      ? new Date(date)
      : month && /^\d{4}-\d{2}$/.test(month)
        ? dayjs(month + '-01').endOf('month').toDate()
        : new Date();

    const result = await prisma.$transaction(async (prisma) => {
      const settlementExpense = await prisma.expense.create({
        data: {
          title: `Settlement: ${debtor.name} to ${creditor.name}`,
          amount: parseFloat(amount),
          date: settlementDate,
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
      month: month || 'global',
    });
    res.status(201).json({ message: 'Debt settled successfully', settlement: result });
  } catch (error: any) {
    logger.error('Error settling debt', { userId: req.userId, error: error.message });
    res.status(400).json({ error: error.message });
  }
});

export default router;
