#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';

// Ensure public/samples directory exists
const samplesDir = path.join(__dirname, '../public/samples');
if (!fs.existsSync(samplesDir)) {
  fs.mkdirSync(samplesDir, { recursive: true });
}

// ==================== Deterministic utilities ====================

// Simple deterministic "random" number between 0 and 1
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Add days to a date
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ==================== GL CSV Generator ====================

function generateGLCSV(): string {
  const lines: string[] = [];
  const header = 'entry_date,posting_date,account,reference,memo,amount,currency,debit_credit,counterparty';
  lines.push(header);

  const counterparties = ['Acme', 'Beta Ltd', 'Cirrus Inc', 'Delta Co', 'Elm & Co'];
  const accounts = ['2100', '2110', '4000', '5000'];
  const baseDate = new Date(2026, 1, 1); // Feb 1, 2026
  const endDate = new Date(2026, 3, 15); // Apr 15, 2026
  const daysDiff = Math.floor((endDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));

  // Rows 1–160: clean matches
  for (let i = 1; i <= 160; i++) {
    const daysOffset = (i - 1) % (daysDiff + 1);
    const entryDate = addDays(baseDate, daysOffset);
    const postingDate = addDays(entryDate, seededRandom(i * 100) < 0.5 ? 0 : 1);
    const account = accounts[(i - 1) % accounts.length];
    const reference = `INV-${String(i).padStart(3, '0')}`;
    const memo = `Payment from ${counterparties[(i - 1) % counterparties.length]}`;
    const amount = 100 + ((i * 317) % 49900);
    const currency = 'USD';
    const debitCredit = i % 2 === 0 ? 'DR' : 'CR';
    const counterparty = counterparties[(i - 1) % counterparties.length];

    lines.push(
      `${formatDate(entryDate)},${formatDate(postingDate)},${account},${reference},${memo},${amount.toFixed(
        2
      )},${currency},${debitCredit},${counterparty}`
    );
  }

  // Rows 161–165: amount-within-tolerance (GL side, lower amount)
  for (let i = 161; i <= 165; i++) {
    const daysOffset = (i - 1) % (daysDiff + 1);
    const entryDate = addDays(baseDate, daysOffset);
    const postingDate = entryDate;
    const account = accounts[(i - 1) % accounts.length];
    const reference = `INV-${String(i).padStart(3, '0')}`;
    const counterparty = counterparties[(i - 1) % counterparties.length];
    const memo = `Payment from ${counterparty}`;
    const baseAmount = 1000 + (i - 161) * 500;
    // GL amount is lower; sub will be baseAmount + delta (0.25–0.95)
    const amount = baseAmount;
    const currency = 'USD';
    const debitCredit = 'DR';

    lines.push(
      `${formatDate(entryDate)},${formatDate(postingDate)},${account},${reference},${memo},${amount.toFixed(2)},${currency},${debitCredit},${counterparty}`
    );
  }

  // Rows 166–170: date-within-tolerance (GL side)
  for (let i = 166; i <= 170; i++) {
    const daysOffset = (i - 1) % (daysDiff + 1);
    const baseDate2 = addDays(baseDate, daysOffset);
    // GL offset from sub by ±1 or ±2 days
    const offset = (i - 166) % 2 === 0 ? -1 : 2;
    const entryDate = addDays(baseDate2, offset);
    const postingDate = entryDate;
    const account = accounts[(i - 1) % accounts.length];
    const reference = `INV-${String(i).padStart(3, '0')}`;
    const counterparty = counterparties[(i - 1) % counterparties.length];
    const memo = `Payment from ${counterparty}`;
    const amount = 2000 + (i - 166) * 300;
    const currency = 'USD';
    const debitCredit = 'DR';

    lines.push(
      `${formatDate(entryDate)},${formatDate(postingDate)},${account},${reference},${memo},${amount.toFixed(2)},${currency},${debitCredit},${counterparty}`
    );
  }

  // Rows 171–175: fuzzy pairs (GL side FZG-*)
  for (let i = 171; i <= 175; i++) {
    const daysOffset = 69; // 2026-04-10 is ~69 days from Feb 1
    const entryDate = addDays(baseDate, daysOffset);
    const postingDate = entryDate;
    const account = accounts[(i - 1) % accounts.length];
    const reference = `FZG-${String(i).padStart(3, '0')}`;
    const memo = `Acme Corp payment ${i}`;
    const amount = 5000 + (i - 171) * 1000;
    const currency = 'USD';
    const debitCredit = 'DR';
    const counterparty = 'AcmeCorp'; // Different from sub side: "Acme, Inc."

    lines.push(
      `${formatDate(entryDate)},${formatDate(postingDate)},${account},${reference},${memo},${amount.toFixed(2)},${currency},${debitCredit},${counterparty}`
    );
  }

  // Rows 176–185: GL-only breaks (10 rows)
  for (let i = 176; i <= 185; i++) {
    const daysOffset = (i - 1) % (daysDiff + 1);
    const entryDate = addDays(baseDate, daysOffset);
    const postingDate = entryDate;
    const account = accounts[(i - 1) % accounts.length];
    const reference = `INV-${String(i).padStart(3, '0')}`;
    const counterparty = counterparties[(i - 1) % counterparties.length];
    const memo = `Payment from ${counterparty}`;
    const amount = 100 + ((i * 317) % 49900);
    const currency = 'USD';
    const debitCredit = 'DR';

    lines.push(
      `${formatDate(entryDate)},${formatDate(postingDate)},${account},${reference},${memo},${amount.toFixed(2)},${currency},${debitCredit},${counterparty}`
    );
  }

  // Rows 186–195: clean matches paired with sub rows
  for (let i = 186; i <= 195; i++) {
    const daysOffset = (i - 1) % (daysDiff + 1);
    const entryDate = addDays(baseDate, daysOffset);
    const postingDate = entryDate;
    const account = accounts[(i - 1) % accounts.length];
    const reference = `INV-${String(i).padStart(3, '0')}`;
    const counterparty = counterparties[(i - 1) % counterparties.length];
    const memo = `Payment from ${counterparty}`;
    const amount = 100 + ((i * 317) % 49900);
    const currency = 'USD';
    const debitCredit = i % 2 === 0 ? 'DR' : 'CR';

    lines.push(
      `${formatDate(entryDate)},${formatDate(postingDate)},${account},${reference},${memo},${amount.toFixed(2)},${currency},${debitCredit},${counterparty}`
    );
  }

  // Rows 196–200: FX entries (EUR & GBP)
  const fxEntries = [
    { reference: 'INV-196', amount: 1000, currency: 'EUR', date: '2026-03-15', counterparty: 'Acme' },
    { reference: 'INV-197', amount: 2500, currency: 'EUR', date: '2026-03-20', counterparty: 'Beta Ltd' },
    { reference: 'INV-198', amount: 800, currency: 'GBP', date: '2026-03-25', counterparty: 'Cirrus Inc' },
    { reference: 'INV-199', amount: 1500, currency: 'GBP', date: '2026-04-01', counterparty: 'Delta Co' },
    { reference: 'INV-200', amount: 5000, currency: 'EUR', date: '2026-04-05', counterparty: 'Elm & Co' },
  ];

  for (const entry of fxEntries) {
    const entryDate = new Date(entry.date);
    const postingDate = entryDate;
    const account = '2100';
    const memo = `Payment from ${entry.counterparty}`;
    const debitCredit = 'DR';

    lines.push(
      `${formatDate(entryDate)},${formatDate(postingDate)},${account},${entry.reference},${memo},${entry.amount.toFixed(
        2
      )},${entry.currency},${debitCredit},${entry.counterparty}`
    );
  }

  return lines.join('\n');
}

// ==================== Sub-Ledger CSV Generator ====================

function generateSubLedgerCSV(): string {
  const lines: string[] = [];
  const header = 'entry_date,account,source_module,reference,memo,amount,currency,counterparty';
  lines.push(header);

  const counterparties = ['Acme', 'Beta Ltd', 'Cirrus Inc', 'Delta Co', 'Elm & Co'];
  const accounts = ['2100', '2110', '4000', '5000'];
  const sourceModules = ['AP', 'AR', 'FA'];
  const baseDate = new Date(2026, 1, 1); // Feb 1, 2026
  const endDate = new Date(2026, 3, 15); // Apr 15, 2026
  const daysDiff = Math.floor((endDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));

  // Rows 1–160: exact match to GL rows 1–160
  for (let i = 1; i <= 160; i++) {
    const daysOffset = (i - 1) % (daysDiff + 1);
    const entryDate = addDays(baseDate, daysOffset);
    const account = accounts[(i - 1) % accounts.length];
    const sourceModule = sourceModules[(i - 1) % sourceModules.length];
    const reference = `INV-${String(i).padStart(3, '0')}`;
    const memo = `Received from ${counterparties[(i - 1) % counterparties.length]}`;
    const amount = 100 + ((i * 317) % 49900);
    const currency = 'USD';
    const counterparty = counterparties[(i - 1) % counterparties.length];

    lines.push(
      `${formatDate(entryDate)},${account},${sourceModule},${reference},${memo},${amount.toFixed(2)},${currency},${counterparty}`
    );
  }

  // Rows 161–165: amount-tolerance mates (amount = GL + delta)
  for (let i = 161; i <= 165; i++) {
    const daysOffset = (i - 1) % (daysDiff + 1);
    const entryDate = addDays(baseDate, daysOffset);
    const account = accounts[(i - 1) % accounts.length];
    const sourceModule = sourceModules[(i - 1) % sourceModules.length];
    const reference = `INV-${String(i).padStart(3, '0')}`;
    const counterparty = counterparties[(i - 1) % counterparties.length];
    const memo = `Received from ${counterparty}`;
    const baseAmount = 1000 + (i - 161) * 500;
    const deltas = [0.25, 0.5, 0.75, 0.85, 0.95];
    const amount = baseAmount + deltas[(i - 161) % deltas.length];
    const currency = 'USD';

    lines.push(
      `${formatDate(entryDate)},${account},${sourceModule},${reference},${memo},${amount.toFixed(2)},${currency},${counterparty}`
    );
  }

  // Rows 166–170: date-tolerance mates
  for (let i = 166; i <= 170; i++) {
    const daysOffset = (i - 1) % (daysDiff + 1);
    const baseDate2 = addDays(baseDate, daysOffset);
    // Sub date matches the date WITHOUT offset (GL will have offset)
    const entryDate = baseDate2;
    const account = accounts[(i - 1) % accounts.length];
    const sourceModule = sourceModules[(i - 1) % sourceModules.length];
    const reference = `INV-${String(i).padStart(3, '0')}`;
    const counterparty = counterparties[(i - 1) % counterparties.length];
    const memo = `Received from ${counterparty}`;
    const amount = 2000 + (i - 166) * 300;
    const currency = 'USD';

    lines.push(
      `${formatDate(entryDate)},${account},${sourceModule},${reference},${memo},${amount.toFixed(2)},${currency},${counterparty}`
    );
  }

  // Rows 171–175: fuzzy mates (FZS-* references, different counterparty)
  for (let i = 171; i <= 175; i++) {
    const daysOffset = 69; // 2026-04-10
    const entryDate = addDays(baseDate, daysOffset);
    const account = accounts[(i - 1) % accounts.length];
    const sourceModule = sourceModules[(i - 1) % sourceModules.length];
    const reference = `FZS-${String(i).padStart(3, '0')}`;
    const memo = `ACME PMT #${i}`;
    const amount = 5000 + (i - 171) * 1000;
    const currency = 'USD';
    const counterparty = 'Acme, Inc.'; // Different from GL side

    lines.push(
      `${formatDate(entryDate)},${account},${sourceModule},${reference},${memo},${amount.toFixed(2)},${currency},${counterparty}`
    );
  }

  // Rows 176–185: sub-only breaks
  for (let i = 176; i <= 185; i++) {
    const daysOffset = (i - 1) % (daysDiff + 1);
    const entryDate = addDays(baseDate, daysOffset);
    const account = accounts[(i - 1) % accounts.length];
    const sourceModule = sourceModules[(i - 1) % sourceModules.length];
    const reference = `SUB-ONLY-${String(i - 175).padStart(3, '0')}`;
    const counterparty = counterparties[(i - 1) % counterparties.length];
    const memo = `Sub-only from ${counterparty}`;
    const amount = 100 + ((i * 317) % 49900);
    const currency = 'USD';

    lines.push(
      `${formatDate(entryDate)},${account},${sourceModule},${reference},${memo},${amount.toFixed(2)},${currency},${counterparty}`
    );
  }

  // Rows 186–195: clean matches with GL rows 186–195
  for (let i = 186; i <= 195; i++) {
    const daysOffset = (i - 1) % (daysDiff + 1);
    const entryDate = addDays(baseDate, daysOffset);
    const account = accounts[(i - 1) % accounts.length];
    const sourceModule = sourceModules[(i - 1) % sourceModules.length];
    const reference = `INV-${String(i).padStart(3, '0')}`;
    const counterparty = counterparties[(i - 1) % counterparties.length];
    const memo = `Received from ${counterparty}`;
    const amount = 100 + ((i * 317) % 49900);
    const currency = 'USD';

    lines.push(
      `${formatDate(entryDate)},${account},${sourceModule},${reference},${memo},${amount.toFixed(2)},${currency},${counterparty}`
    );
  }

  // Rows 196–200: FX mates
  const fxEntries = [
    { reference: 'INV-196', amount: 1000, currency: 'EUR', date: '2026-03-15', counterparty: 'Acme' },
    { reference: 'INV-197', amount: 2500, currency: 'EUR', date: '2026-03-20', counterparty: 'Beta Ltd' },
    { reference: 'INV-198', amount: 800, currency: 'GBP', date: '2026-03-25', counterparty: 'Cirrus Inc' },
    { reference: 'INV-199', amount: 1500, currency: 'GBP', date: '2026-04-01', counterparty: 'Delta Co' },
    { reference: 'INV-200', amount: 5000, currency: 'EUR', date: '2026-04-05', counterparty: 'Elm & Co' },
  ];

  for (const entry of fxEntries) {
    const entryDate = new Date(entry.date);
    const account = '2100';
    const sourceModule = 'AP';
    const memo = `Received from ${entry.counterparty}`;

    lines.push(
      `${formatDate(entryDate)},${account},${sourceModule},${entry.reference},${memo},${entry.amount.toFixed(2)},${entry.currency},${entry.counterparty}`
    );
  }

  return lines.join('\n');
}

// ==================== FX Rates CSV Generator ====================

function generateFXRatesCSV(): string {
  const lines: string[] = [];
  const header = 'from_currency,to_currency,rate,as_of';
  lines.push(header);

  const startDate = new Date(2026, 0, 16); // 2026-01-16

  // 90 days for two currency pairs: EUR→USD and GBP→USD
  for (let i = 0; i < 90; i++) {
    const asOfDate = addDays(startDate, i);
    const asOfStr = formatDate(asOfDate);

    // EUR → USD: 1.10 + 0.02 * sin(i / 5)
    const eurRate = 1.1 + 0.02 * Math.sin(i / 5);
    lines.push(`EUR,USD,${eurRate.toFixed(4)},${asOfStr}`);

    // GBP → USD: 1.26 + 0.02 * sin(i / 7)
    const gbpRate = 1.26 + 0.02 * Math.sin(i / 7);
    lines.push(`GBP,USD,${gbpRate.toFixed(4)},${asOfStr}`);
  }

  return lines.join('\n');
}

// ==================== Main ====================

console.log('Generating sample CSVs...');

const glData = generateGLCSV();
const glPath = path.join(samplesDir, 'sample-gl.csv');
fs.writeFileSync(glPath, glData);
console.log(`✓ Created ${glPath} (${glData.split('\n').length} lines)`);

const subData = generateSubLedgerCSV();
const subPath = path.join(samplesDir, 'sample-sub-ledger.csv');
fs.writeFileSync(subPath, subData);
console.log(`✓ Created ${subPath} (${subData.split('\n').length} lines)`);

const fxData = generateFXRatesCSV();
const fxPath = path.join(samplesDir, 'sample-fx-rates.csv');
fs.writeFileSync(fxPath, fxData);
console.log(`✓ Created ${fxPath} (${fxData.split('\n').length} lines)`);

console.log('\nDone!');
