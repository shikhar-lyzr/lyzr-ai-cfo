import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseCSV, autoDetectColumns, parseRows } from "@/lib/csv/variance-parser";
import { parseArCsv } from "@/lib/csv/ar-parser";
import { detectCsvShape } from "@/lib/csv/detect-shape";
import { analyzeUpload, analyzeArUpload } from "@/lib/agent";

function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { url, shape } = (await request.json()) as {
    url: string;
    shape: "variance" | "ar";
  };

  const sheetId = extractSheetId(url);
  if (!sheetId) {
    return NextResponse.json({ error: "Invalid Google Sheets URL" }, { status: 400 });
  }

  // Google Sheets CSV export — no API key needed, sheet must be "Anyone with link"
  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
  let csvText: string;
  try {
    const res = await fetch(exportUrl, { redirect: "follow" });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Could not access sheet. Make sure it is shared with 'Anyone with link'." },
        { status: 422 }
      );
    }
    csvText = await res.text();
  } catch {
    return NextResponse.json(
      { error: "Could not access sheet. Make sure it is shared with 'Anyone with link'." },
      { status: 422 }
    );
  }

  const { headers, rows } = parseCSV(csvText);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Sheet is empty or has no data rows" }, { status: 422 });
  }

  // Verify shape matches what was claimed by the tab, or auto-detect
  const detectedShape = await detectCsvShape(headers);
  const effectiveShape = detectedShape !== "unknown" ? detectedShape : shape;

  const dataSource = await prisma.dataSource.create({
    data: {
      userId: session.userId,
      type: "sheets",
      name: `Google Sheet (${sheetId.slice(0, 8)}...)`,
      status: "processing",
      recordCount: rows.length,
      metadata: JSON.stringify({ shape: effectiveShape, headers, sheetId }),
    },
  });

  if (effectiveShape === "ar") {
    const parseResult = await parseArCsv(headers, rows);
    if (parseResult.invoices.length > 0) {
      for (const inv of parseResult.invoices) {
        await prisma.invoice.upsert({
          where: {
            dataSourceId_invoiceNumber: {
              dataSourceId: dataSource.id,
              invoiceNumber: inv.invoiceNumber,
            },
          },
          create: {
            dataSourceId: dataSource.id,
            invoiceNumber: inv.invoiceNumber,
            customer: inv.customer,
            customerEmail: inv.customerEmail,
            amount: inv.amount,
            invoiceDate: inv.invoiceDate,
            dueDate: inv.dueDate,
          },
          update: {
            customer: inv.customer,
            customerEmail: inv.customerEmail,
            amount: inv.amount,
            invoiceDate: inv.invoiceDate,
            dueDate: inv.dueDate,
          },
        });
      }
    }

    await prisma.dataSource.update({
      where: { id: dataSource.id },
      data: { status: "ready", recordCount: parseResult.invoices.length },
    });

    analyzeArUpload(session.userId, dataSource.id, dataSource.name, parseResult.invoices.length)
      .catch((err) => console.error("[link-sheet] AR agent failed:", err));
  } else {
    const mapping = autoDetectColumns(headers);
    const parsedRows = parseRows(rows, mapping);

    for (const row of parsedRows) {
      await prisma.financialRecord.create({
        data: { dataSourceId: dataSource.id, ...row },
      });
    }

    await prisma.dataSource.update({
      where: { id: dataSource.id },
      data: { status: "ready", recordCount: parsedRows.length },
    });

    analyzeUpload(session.userId, dataSource.id, dataSource.name, parsedRows.length)
      .catch((err) => console.error("[link-sheet] Variance agent failed:", err));
  }

  return NextResponse.json(
    { dataSource: { id: dataSource.id, name: dataSource.name, recordCount: dataSource.recordCount }, analysisStatus: "processing" },
    { status: 201 }
  );
}
