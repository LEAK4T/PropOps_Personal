-- PropOps AI Sandbox — D1 schema
-- Personal playground data store. Everything here is meant to hold fake/demo
-- data you create yourself while testing the live integrations. Separate
-- entirely from the client-facing demo's mock in-memory data and from the
-- real Supabase schema used for actual paying clients.

DROP TABLE IF EXISTS docusign_envelopes;
DROP TABLE IF EXISTS reviews_cache;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS maintenance_requests;
DROP TABLE IF EXISTS leases;
DROP TABLE IF EXISTS tenants;
DROP TABLE IF EXISTS units;
DROP TABLE IF EXISTS vendors;
DROP TABLE IF EXISTS properties;

CREATE TABLE properties (
  id TEXT PRIMARY KEY,               -- slug, e.g. 'my-test-property'
  label TEXT NOT NULL,
  unit_label TEXT NOT NULL DEFAULT 'Unit',   -- 'Unit' or 'Suite'
  tenant_label TEXT NOT NULL DEFAULT 'Tenant', -- 'Tenant' or 'Business'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE units (
  id TEXT PRIMARY KEY,               -- e.g. 'sandbox-101'
  property_id TEXT NOT NULL REFERENCES properties(id),
  unit_number TEXT NOT NULL,
  rent REAL NOT NULL DEFAULT 0,
  parking TEXT,
  owner_name TEXT,                   -- commercial: primary owner/operator
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id),
  name TEXT NOT NULL,
  age INTEGER,
  phone TEXT,                        -- E.164 format for Twilio, e.g. +13055550123
  email TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual', -- 'manual' or 'lease-scan'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE leases (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id),
  lease_end TEXT,
  document_text TEXT,                -- raw extracted/generated lease text
  docusign_envelope_id TEXT,         -- set once sent for signature
  status TEXT NOT NULL DEFAULT 'draft', -- draft | sent | signed | declined
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  phone TEXT,
  email TEXT,
  contract_id TEXT,                  -- docusign envelope id for service contract
  contract_status TEXT NOT NULL DEFAULT 'none', -- none | sent | signed
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE maintenance_requests (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id),
  vendor_id TEXT REFERENCES vendors(id),
  description TEXT NOT NULL,
  urgency TEXT,                      -- P1..P4
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  unit_id TEXT REFERENCES units(id),
  vendor_id TEXT REFERENCES vendors(id),
  channel TEXT NOT NULL,              -- 'sms' | 'email'
  direction TEXT NOT NULL DEFAULT 'outbound',
  to_address TEXT NOT NULL,           -- phone or email
  subject TEXT,
  body TEXT NOT NULL,
  provider TEXT,                      -- 'twilio' | 'twilio_email'
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued', -- queued | sent | failed | delivered
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE reviews_cache (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id),
  author TEXT,
  rating INTEGER,
  comment TEXT,
  relative_time TEXT,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE docusign_envelopes (
  id TEXT PRIMARY KEY,                -- DocuSign envelope id
  kind TEXT NOT NULL,                 -- 'lease' | 'vendor_contract'
  related_id TEXT NOT NULL,           -- lease id or vendor id
  status TEXT NOT NULL DEFAULT 'sent', -- sent | delivered | completed | declined | voided
  last_event_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_units_property ON units(property_id);
CREATE INDEX idx_tenants_unit ON tenants(unit_id);
CREATE INDEX idx_leases_unit ON leases(unit_id);
CREATE INDEX idx_maint_unit ON maintenance_requests(unit_id);
CREATE INDEX idx_messages_unit ON messages(unit_id);

-- Seed one sandbox property + unit so the dashboard has something to point at
-- on first load, before you add your own fake data through the UI.
INSERT INTO properties (id, label, unit_label, tenant_label) VALUES
  ('sandbox', 'My Sandbox Property', 'Unit', 'Tenant');

INSERT INTO units (id, property_id, unit_number, rent, parking) VALUES
  ('sandbox-101', 'sandbox', '101', 1800, 'S-101');
