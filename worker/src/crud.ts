import { Env, json, newId } from './lib';

// Generic-ish CRUD for the sandbox's own D1-backed data — properties, units,
// tenants, leases, vendors, maintenance requests, and message history.
// Kept intentionally simple (no auth) since this is a personal single-user
// sandbox, not the multi-tenant client product.

export async function listProperties(env: Env): Promise<Response> {
  const rows = await env.DB.prepare(`SELECT * FROM properties ORDER BY created_at`).all();
  return json({ ok: true, properties: rows.results }, env);
}

export async function createProperty(req: Request, env: Env): Promise<Response> {
  const body: any = await req.json().catch(() => ({}));
  if (!body.label) return json({ ok: false, error: 'label is required' }, env, { status: 400 });
  const id = body.id || newId('prop');
  await env.DB.prepare(`INSERT INTO properties (id, label, unit_label, tenant_label) VALUES (?, ?, ?, ?)`)
    .bind(id, body.label, body.unitLabel || 'Unit', body.tenantLabel || 'Tenant')
    .run();
  return json({ ok: true, id }, env);
}

export async function listUnits(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const propertyId = url.searchParams.get('propertyId');
  const rows = propertyId
    ? await env.DB.prepare(`SELECT * FROM units WHERE property_id = ? ORDER BY created_at`).bind(propertyId).all()
    : await env.DB.prepare(`SELECT * FROM units ORDER BY created_at`).all();
  return json({ ok: true, units: rows.results }, env);
}

export async function createUnit(req: Request, env: Env): Promise<Response> {
  const body: any = await req.json().catch(() => ({}));
  if (!body.propertyId || !body.unitNumber) {
    return json({ ok: false, error: 'propertyId and unitNumber are required' }, env, { status: 400 });
  }
  const id = body.id || newId('unit');
  await env.DB.prepare(`INSERT INTO units (id, property_id, unit_number, rent, parking, owner_name) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(id, body.propertyId, body.unitNumber, body.rent || 0, body.parking || null, body.ownerName || null)
    .run();
  return json({ ok: true, id }, env);
}

export async function listTenants(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const unitId = url.searchParams.get('unitId');
  const rows = unitId
    ? await env.DB.prepare(`SELECT * FROM tenants WHERE unit_id = ? ORDER BY created_at`).bind(unitId).all()
    : await env.DB.prepare(`SELECT * FROM tenants ORDER BY created_at`).all();
  return json({ ok: true, tenants: rows.results }, env);
}

// Used both for manual entry and for saving a reviewed lease-scan result.
export async function createTenant(req: Request, env: Env): Promise<Response> {
  const body: any = await req.json().catch(() => ({}));
  if (!body.unitId || !body.name) {
    return json({ ok: false, error: 'unitId and name are required' }, env, { status: 400 });
  }
  const id = body.id || newId('ten');
  await env.DB.prepare(
    `INSERT INTO tenants (id, unit_id, name, age, phone, email, is_primary, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, body.unitId, body.name, body.age ?? null, body.phone || null, body.email || null, body.isPrimary ? 1 : 0, body.source || 'manual')
    .run();
  return json({ ok: true, id }, env);
}

export async function listLeases(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const unitId = url.searchParams.get('unitId');
  const rows = unitId
    ? await env.DB.prepare(`SELECT * FROM leases WHERE unit_id = ? ORDER BY created_at DESC`).bind(unitId).all()
    : await env.DB.prepare(`SELECT * FROM leases ORDER BY created_at DESC`).all();
  return json({ ok: true, leases: rows.results }, env);
}

export async function createLease(req: Request, env: Env): Promise<Response> {
  const body: any = await req.json().catch(() => ({}));
  if (!body.unitId || !body.documentText) {
    return json({ ok: false, error: 'unitId and documentText are required' }, env, { status: 400 });
  }
  const id = body.id || newId('lease');
  await env.DB.prepare(`INSERT INTO leases (id, unit_id, lease_end, document_text, status) VALUES (?, ?, ?, ?, 'draft')`)
    .bind(id, body.unitId, body.leaseEnd || null, body.documentText)
    .run();
  return json({ ok: true, id }, env);
}

export async function listVendors(env: Env): Promise<Response> {
  const rows = await env.DB.prepare(`SELECT * FROM vendors ORDER BY created_at`).all();
  return json({ ok: true, vendors: rows.results }, env);
}

export async function createVendor(req: Request, env: Env): Promise<Response> {
  const body: any = await req.json().catch(() => ({}));
  if (!body.name) return json({ ok: false, error: 'name is required' }, env, { status: 400 });
  const id = body.id || newId('vendor');
  await env.DB.prepare(`INSERT INTO vendors (id, name, category, phone, email) VALUES (?, ?, ?, ?, ?)`)
    .bind(id, body.name, body.category || null, body.phone || null, body.email || null)
    .run();
  return json({ ok: true, id }, env);
}

export async function listMaintenance(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const unitId = url.searchParams.get('unitId');
  const rows = unitId
    ? await env.DB.prepare(`SELECT * FROM maintenance_requests WHERE unit_id = ? ORDER BY created_at DESC`).bind(unitId).all()
    : await env.DB.prepare(`SELECT * FROM maintenance_requests ORDER BY created_at DESC`).all();
  return json({ ok: true, requests: rows.results }, env);
}

export async function createMaintenance(req: Request, env: Env): Promise<Response> {
  const body: any = await req.json().catch(() => ({}));
  if (!body.unitId || !body.description) {
    return json({ ok: false, error: 'unitId and description are required' }, env, { status: 400 });
  }
  const id = body.id || newId('maint');
  await env.DB.prepare(
    `INSERT INTO maintenance_requests (id, unit_id, vendor_id, description, urgency, status) VALUES (?, ?, ?, ?, ?, 'open')`,
  )
    .bind(id, body.unitId, body.vendorId || null, body.description, body.urgency || null)
    .run();
  return json({ ok: true, id }, env);
}

export async function listMessages(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const unitId = url.searchParams.get('unitId');
  const rows = unitId
    ? await env.DB.prepare(`SELECT * FROM messages WHERE unit_id = ? ORDER BY created_at DESC`).bind(unitId).all()
    : await env.DB.prepare(`SELECT * FROM messages ORDER BY created_at DESC LIMIT 200`).all();
  return json({ ok: true, messages: rows.results }, env);
}
