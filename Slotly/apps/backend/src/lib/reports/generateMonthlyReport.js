import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

export const generateMonthlyReport = async (businessId, period = null) => {

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new Error('Business not found');

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const periodLabel = period || `${year}-${String(month + 1).padStart(2, '0')}`;

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);

  const bookings = await prisma.booking.findMany({
    where: {
      businessId,
      startTime: { gte: start, lt: end },
      status: 'COMPLETED',
    },
    include: { service: true },
  });

  const revenue = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: {
      businessId,
      createdAt: { gte: start, lt: end },
      status: 'SUCCESS',
    },
  });

  const reportsDir = path.resolve('public/reports');
  fs.mkdirSync(reportsDir, { recursive: true });

 
  const doc = new PDFDocument();
  const filename = `${businessId}-${periodLabel}.pdf`;
  const filepath = path.join(reportsDir, filename);
  const fileStream = fs.createWriteStream(filepath);
  doc.pipe(fileStream);

 
  doc.fontSize(20).text('Slotly Monthly Report', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Business: ${business.name}`);
  doc.text(`Period: ${periodLabel}`);
  doc.text(`Total Completed Bookings: ${bookings.length}`);
  doc.text(`Total Revenue: KES ${revenue._sum.amount || 0}`);

  doc.moveDown();
  doc.fontSize(14).text('Bookings:');

  bookings.forEach((b, idx) => {
    doc
      .fontSize(10)
      .text(`${idx + 1}. ${b.service?.name || 'Unknown'} - ${new Date(b.startTime).toLocaleDateString()}`);
  });

  doc.end();

  return `/reports/${filename}`;
};
