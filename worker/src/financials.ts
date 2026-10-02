import { Env, json, newId } from './lib';

// Financial-model routes: loans (mortgage split), expenses (CapEx/OpEx),
// deposits (held liability), unit turns (vacancy), and CapEx reserve
// contributions. Mirrors the simple no-auth CRUD pattern in crud.ts —
// this is still the personal single-user sandbox, not the multi-tenant
// client product (which will need property_id-scoped auth on all of this).

// ---- Loans (one row per property; upsert-by-property semantics) ----

export async function listLoans(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const propertyId = url.searchParams.get('propertyId');
  const rows = propertyId
    ? await env.DB.prepare(`SELECT * FROM loans WHERE property_id = ? ORDER BY created_at DESC`).bind(propertyId).all()
    : await env.DB.prepare(`SELECT * FROM loans ORDER BY created_at DESC`).all();
  return json({ ok: true, loans: rows.results }, env);
}

// POST /api/loans  { propertyId, lender?, originalAmount?, principalBalance,
//                     interestRate?, monthlyPayment, escrowTaxMonthly?,
//                     escrowInsuranceMonthly?, originationDate?, id? }
// If `id` matches an existing loan it's updated in place; otherwise a new
// loan row is created. (Kept as an explicit id-based upsert rather than a
// hidden "one loan per property" constraint, since a property could in
// theory be refinanced and have loan history worth keeping.)
export async function upsertLoan(req: Request, env: Env): Promise<Response> {
  const body: any = await req.json().catch(() => ({}));
  if (!body.propertyId) return json({ ok: false, error: 'propertyId is required' }, env, { status: 400 });

  if (body.id) {
    const existing = await env.DB.prepare(`SELECT id FROM loans WHERE id = ?`).bind(body.id).first();
    if (existing) {
      await env.DB.prepare(
        `UPDATE loans SET lender = ?, original_amount = ?, principal_balance = ?, interest_rate = ?,
           monthly_payment = ?, escrow_tax_monthly = ?, escrow_insurance_monthly = ?, origination_date = ?,
           updated_at = datetime('now')
         WHERE id = ?`,
      )
        .bind(
          body.lender || null,
          body.originalAmount ?? null,
          body.principalBalance ?? 0,
          body.interestRate ?? null,
          body.monthlyPayment ?? 0,
          body.escrowTaxMonthly ?? 0,
          body.escrowInsuranceMonthly ?? 0,
          body.originationDate || null,
          body.id,
        )
        .run();
      return json({ ok: true, id: body.id, updated: true }, env);
    }
  }

  const id = body.id || newId('loan');
  await env.DB.prepare(
    `INSERT INTO loans (id, property_id, lender, original_amount, principal_balance, interest_rate,
       monthly_payment, escrow_tax_monthly, escrow_insurance_monthly, origination_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      body.propertyId,
      body.lender || null,
      body.originalAmount ?? null,
      body.principalBalance ?? 0,
      body.interestRate ?? null,
      body.monthlyPayment ?? 0,
      body.escrowTaxMonthly ?? 0,
      body.escrowInsuranceMonthly ?? 0,
      body.originationDate || null,
    )
    .run();
  return json({ ok: true, id, updated: false }, env);
}

// ---- Expenses (CapEx/OpEx) ----

export async function listExpenses(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const propertyId = url.searchParams.get('propertyId');
  const classification = url.searchParams.get('classification'); // 'opex' | 'capex'
  let query = `SELECT * FROM expenses WHERE 1=1`;
  const binds: any[] = [];
  if (propertyId) { query += ` AND property_id = ?`; binds.push(propertyId); }
  if (classification) { query += ` AND classification = ?`; binds.push(classification); }
  query += ` ORDER BY incurred_date DESC`;
  const rows = await env.DB.prepare(query).bind(...binds).all();
  return json({ ok: true, expenses: rows.results }, env);
}

// POST /api/expenses  { propertyId, category, classification: 'opex'|'capex',
//                        amount, description?, incurredDate?, unitId?, vendorId?, id? }
export async function createExpense(req: Request, env: Env): Promise<Response> {
  const body: any = await req.json().catch(() => ({}));
  if (!body.propertyId || !body.category || !body.classification || body.amount == null) {
    return json({ ok: false, error: 'propertyId, category, classification, and amount are required' }, env, { status: 400 });
  }
  if (body.classification !== 'opex' && body.classification !== 'capex') {
    return json({ ok: false, error: `classification must be "opex" or "capex", got "${body.classification}"` }, env, { status: 400 });
  }
  const id = body.id || newId('exp');
  await env.DB.prepare(
    `INSERT INTO expenses (id, property_id, unit_id, category, classification, amount, description, incurred_date, vendor_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      body.propertyId,
      body.unitId || null,
      body.category,
      body.classification,
      body.amount,
      body.description || null,
      body.incurredDate || new Date().toISOString().slice(0, 10),
      body.vendorId || null,
    )
    .run();
  return json({ ok: true, id }, env);
}

// ---- Deposits (held liability, never revenue) ----

export async function listDeposits(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const unitId = url.searchParams.get('unitId');
  const status = url.searchParams.get('status');
  let query = `SELECT * FROM deposits WHERE 1=1`;
  const binds: any[] = [];
  if (unitId) { query += ` AND unit_id = ?`; binds.push(unitId); }
  if (status) { query += ` AND status = ?`; binds.push(status); }
  query += ` ORDER BY created_at DESC`;
  const rows = await env.DB.prepare(query).bind(...binds).all();
  return json({ ok: true, deposits: rows.results }, env);
}

// POST /api/deposits  { unitId, amountHeld, tenantId?, dateReceived?, id? }
export async function createDeposit(req: Request, env: Env): Promise<Response> {
  const body: any = await req.json().catch(() => ({}));
  if (!body.unitId || body.amountHeld == null) {
    return json({ ok: false, error: 'unitId and amountHeld are required' }, env, { status: 400 });
  }
  const id = body.id || newId('dep');
  await env.DB.prepare(
    `INSERT INTO deposits (id, unit_id, tenant_id, amount_held, date_received, status)
     VALUES (?, ?, ?, ?, ?, 'held')`,
  )
    .bind(id, body.unitId, body.tenantId || null, body.amountHeld, body.dateReceived || new Date().toISOString().slice(0, 10))
    .run();
  return json({ ok: true, id }, env);
}

// POST /api/deposits/close  { id, amountReturned?, amountWithheld?, withholdingReason? }
// Closes out a held deposit at move-out: how much went back to the tenant
// vs. was withheld (and why). Status is derived, not passed in, so the
// numbers and the label can't disagree.
export async function closeDeposit(req: Request, env: Env): Promise<Response> {
  const body: any = await req.json().catch(() => ({}));
  if (!body.id) return json({ ok: false, error: 'id is required' }, env, { status: 400 });

  const amountReturned = body.amountReturned ?? 0;
  const amountWithheld = body.amountWithheld ?? 0;
  let status: string;
  if (amountWithheld > 0 && amountReturned > 0) status = 'partially_withheld';
  else if (amountWithheld > 0) status = 'fully_withheld';
  else status = 'returned';

  await env.DB.prepare(
    `UPDATE deposits SET status = ?, amount_returned = ?, amount_withheld = ?, withholding_reason = ?,
       date_closed = ?, updated_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(status, amountReturned, amountWithheld, body.withholdingReason || null, body.dateClosed || new Date().toISOString().slice(0, 10), body.id)
    .run();
  return json({ ok: true, status }, env);
}

// ---- Unit turns (vacancy tracking) ----

export async function listUnitTurns(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const unitId = url.searchParams.get('unitId');
  const rows = unitId
    ? await env.DB.prepare(`SELECT * FROM unit_turns WHERE unit_id = ? ORDER BY created_at DESC`).bind(unitId).all()
    : await env.DB.prepare(`SELECT * FROM unit_turns ORDER BY created_at DESC`).all();
  return json({ ok: true, unitTurns: rows.results }, env);
}

// POST /api/unit-turns  { unitId, moveOutDate?, moveInDate?, turnCost?, notes?, id? }
export async function createUnitTurn(req: Request, env: Env): Promise<Response> {
  const body: any = await req.json().catch(() => ({}));
  if (!body.unitId) return json({ ok: false, error: 'unitId is required' }, env, { status: 400 });
  const id = body.id || newId('turn');
  await env.DB.prepare(
    `INSERT INTO unit_turns (id, unit_id, move_out_date, move_in_date, turn_cost, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, body.unitId, body.moveOutDate || null, body.moveInDate || null, body.turnCost ?? 0, body.notes || null)
    .run();
  return json({ ok: true, id }, env);
}

// ---- CapEx reserve contributions ----

// POST /api/capex-reserve/contribute  { propertyId, amount, contributionDate?, note? }
export async function contributeCapexReserve(req: Request, env: Env): Promise<Response> {
  const body: any = await req.json().catch(() => ({}));
  if (!body.propertyId || body.amount == null) {
    return json({ ok: false, error: 'propertyId and amount are required' }, env, { status: 400 });
  }
  const id = newId('reserve');
  await env.DB.prepare(
    `INSERT INTO capex_reserve_contributions (id, property_id, amount, contribution_date, note)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, body.propertyId, body.amount, body.contributionDate || new Date().toISOString().slice(0, 10), body.note || null)
    .run();
  return json({ ok: true, id }, env);
}

// ---- Rolled-up summary for the dashboard ----

// GET /api/financials/summary?propertyId=...
// NOI/cash-flow math only — deliberately NO depreciation or taxable-income
// calculations (tax-advice liability risk, deferred per plan).
export async function financialsSummary(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const propertyId = url.searchParams.get('propertyId');
  if (!propertyId) return json({ ok: false, error: 'propertyId is required' }, env, { status: 400 });

  const unitsRow = await env.DB.prepare(`SELECT COUNT(*) as n, COALESCE(SUM(rent), 0) as totalRent FROM units WHERE property_id = ?`)
    .bind(propertyId)
    .first<{ n: number; totalRent: number }>();
  const unitCount = unitsRow?.n ?? 0;
  const grossScheduledRent = unitsRow?.totalRent ?? 0;

  const opexRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE property_id = ? AND classification = 'opex'`,
  ).bind(propertyId).first<{ total: number }>();
  const totalOpex = opexRow?.total ?? 0;

  const capexRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE property_id = ? AND classification = 'capex'`,
  ).bind(propertyId).first<{ total: number }>();
  const totalCapexSpent = capexRow?.total ?? 0;

  const loanRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(monthly_payment), 0) as pi, COALESCE(SUM(escrow_tax_monthly), 0) as tax,
            COALESCE(SUM(escrow_insurance_monthly), 0) as ins, COALESCE(SUM(principal_balance), 0) as balance
     FROM loans WHERE property_id = ?`,
  ).bind(propertyId).first<{ pi: number; tax: number; ins: number; balance: number }>();
  const monthlyDebtService = (loanRow?.pi ?? 0) + (loanRow?.tax ?? 0) + (loanRow?.ins ?? 0);
  const totalLoanBalance = loanRow?.balance ?? 0;

  const reserveRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total FROM capex_reserve_contributions WHERE property_id = ?`,
  ).bind(propertyId).first<{ total: number }>();
  const capexReserveBalance = (reserveRow?.total ?? 0) - totalCapexSpent;

  const depositsRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount_held), 0) as total FROM deposits d
     JOIN units u ON u.id = d.unit_id
     WHERE u.property_id = ? AND d.status = 'held'`,
  ).bind(propertyId).first<{ total: number }>();
  const depositsHeldLiability = depositsRow?.total ?? 0;

  const vacancyRow = await env.DB.prepare(
    `SELECT AVG(julianday(move_in_date) - julianday(move_out_date)) as avgDays
     FROM unit_turns t JOIN units u ON u.id = t.unit_id
     WHERE u.property_id = ? AND t.move_out_date IS NOT NULL AND t.move_in_date IS NOT NULL`,
  ).bind(propertyId).first<{ avgDays: number | null }>();
  const avgVacancyDays = vacancyRow?.avgDays != null ? Math.round(vacancyRow.avgDays) : null;

  // NOI excludes debt service (standard definition); cash flow subtracts it.
  const noi = grossScheduledRent - totalOpex;
  const cashFlowBeforeCapex = noi - monthlyDebtService;

  return json(
    {
      ok: true,
      propertyId,
      unitCount,
      grossScheduledRent,
      totalOpex,
      totalCapexSpent,
      noi,
      monthlyDebtService,
      cashFlowBeforeCapex,
      totalLoanBalance,
      capexReserveBalance,
      depositsHeldLiability,
      avgVacancyDays,
      note: 'Excludes depreciation and taxable-income calculations by design — consult a tax professional for those.',
    },
    env,
  );
}
