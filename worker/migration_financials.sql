-- Additive migration for the financial model + SMS diagnostic triage.
-- Run with: wrangler d1 execute propops_sandbox --remote --file=worker/migration_financials.sql
-- The CREATE TABLE/INDEX statements are safe to re-run (IF NOT EXISTS).
-- The two ALTER TABLE statements at the end are NOT idempotent -- run this
-- file only once. Does NOT touch
-- existing tables/data from schema.sql.

-- Mortgage, split so principal+interest never gets double-counted against
-- escrow taxes/insurance, and so neither gets double-counted against a
-- manually-logged "mortgage" expense row.
CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  lender TEXT,
  original_amount REAL,
  principal_balance REAL NOT NULL DEFAULT 0,
  interest_rate REAL,                 -- annual %, e.g. 6.5
  monthly_payment REAL NOT NULL DEFAULT 0,   -- Principal + Interest ONLY
  escrow_tax_monthly REAL NOT NULL DEFAULT 0,
  escrow_insurance_monthly REAL NOT NULL DEFAULT 0,
  origination_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_loans_property ON loans(property_id);

-- CapEx vs OpEx expense tracking.
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  unit_id TEXT,
  category TEXT NOT NULL,             -- e.g. 'repairs', 'utilities', 'insurance', 'capex_roof', etc.
  classification TEXT NOT NULL CHECK (classification IN ('opex', 'capex')),
  amount REAL NOT NULL,
  description TEXT,
  incurred_date TEXT NOT NULL DEFAULT (date('now')),
  vendor_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_property ON expenses(property_id);
CREATE INDEX IF NOT EXISTS idx_expenses_unit ON expenses(unit_id);
CREATE INDEX IF NOT EXISTS idx_expenses_classification ON expenses(classification);

-- Held security deposits — a liability, never revenue.
CREATE TABLE IF NOT EXISTS deposits (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL,
  tenant_id TEXT,
  amount_held REAL NOT NULL,
  date_received TEXT NOT NULL DEFAULT (date('now')),
  status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'returned', 'partially_withheld', 'fully_withheld')),
  amount_returned REAL DEFAULT 0,
  amount_withheld REAL DEFAULT 0,
  withholding_reason TEXT,
  date_closed TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_deposits_unit ON deposits(unit_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);

-- Unit turnover / vacancy tracking.
CREATE TABLE IF NOT EXISTS unit_turns (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL,
  move_out_date TEXT,
  move_in_date TEXT,
  turn_cost REAL DEFAULT 0,           -- refurb/cleaning/make-ready cost for this turn
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_unit_turns_unit ON unit_turns(unit_id);

-- CapEx reserve contributions (benchmark-driven, e.g. $200-500/unit/year).
CREATE TABLE IF NOT EXISTS capex_reserve_contributions (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  amount REAL NOT NULL,
  contribution_date TEXT NOT NULL DEFAULT (date('now')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_capex_reserve_property ON capex_reserve_contributions(property_id);

-- SMS diagnostic-triage conversation state (multi-turn Q&A before a
-- maintenance ticket/vendor dispatch is created).
CREATE TABLE IF NOT EXISTS sms_conversations (
  id TEXT PRIMARY KEY,
  phone_number TEXT NOT NULL,         -- tenant's E.164 number (the "From" on inbound)
  unit_id TEXT,
  tenant_id TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'expired')),
  stage TEXT NOT NULL DEFAULT 'awaiting_issue', -- awaiting_issue | clarifying | done
  initial_complaint TEXT,
  clarifying_question TEXT,
  clarifying_answer TEXT,
  resulting_maintenance_id TEXT,
  last_message_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sms_conv_phone ON sms_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_conv_status ON sms_conversations(status);

-- Lets a maintenance request record whether it came in via the SMS triage
-- flow, and keep the tenant's original wording alongside the clarified one.
ALTER TABLE maintenance_requests ADD COLUMN source TEXT DEFAULT 'manual';
ALTER TABLE maintenance_requests ADD COLUMN diagnostic_notes TEXT;
