'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2, ChevronDown, TrendingUp, BarChart3, Wallet, Users, Bell,
  MessageSquare, Wrench, Star, Zap, CheckCircle2, AlertTriangle,
  Sparkles, FileText, Droplet, Thermometer, Lock, PaintRoller,
  CreditCard, Volume2, CalendarClock, KeyRound, Car, Plus,
  XCircle, Percent, CircleDollarSign, X, Inbox, Eye, Mail, ShieldCheck,
  Menu, ScanLine, Send, Loader2, AlertCircle, FlaskConical, RefreshCw, Upload,
} from 'lucide-react';

// ============================================================
// Design notes for whoever maintains this file:
// - Icons: lucide-react (npm install lucide-react). Typography: Tailwind's
//   default font-sans (no extra package needed for preview compatibility).
// - NEW IN THIS VERSION:
//   * Vendor directory (`vendorDirectory`) - a global, property-independent
//     map of contracted vendors. Each property just lists which vendor IDs
//     apply to it (`vendorIds`). Maps onto the `vendors` table already in
//     schema.sql - this front-end structure is basically that table shape.
//   * Lease documents are generated on the fly (`buildLeaseDocument`) from
//     unit data rather than stored per-unit, since it's placeholder text -
//     in the real build this becomes `leases.document_text` / a Storage
//     file, per the Phase 1 schema.
//   * Message/email "preview" objects ({channel, from, to, subject, body})
//     attached to reminders and activity log entries are exactly what a
//     real Twilio SMS/Email send would be constructed from later.
//   * Occupants (residential) / ownerName (commercial) and `parking` are
//     new per-unit fields - not yet in schema.sql's `units`/`tenants`
//     tables, worth adding before this goes live with a real client.
// ============================================================

function StarRating({ rating, max = 5 }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of ${max} stars`}>
      {Array.from({ length: max }).map((_, i) => (
        <Star key={i} size={13} className={i < rating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'} />
      ))}
    </div>
  );
}

function FadeIn({ children, keyProp }) {
  return <div key={keyProp} className="animate-[fadeIn_200ms_ease-out]">{children}</div>;
}

const maintIconMap = { leak: Droplet, hvac: Thermometer, security: Lock, cosmetic: PaintRoller };
const tenantIconMap = { 'late-fee': CreditCard, noise: Volume2, renewal: CalendarClock, access: KeyRound, parking: Car };

const commsCategoryStyle = {
  Complaint: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  Billing: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  General: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
  Maintenance: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

// ============================================================
// GLOBAL VENDOR DIRECTORY - PropOps' contracted repair network.
// Covers the standard landlord-responsibility categories: Major Systems
// (structural, roofing, plumbing, electrical, HVAC), Appliances, and
// Habitability/code compliance - so managers aren't hunting for a new
// contractor every time something breaks.
// ============================================================
const vendorDirectory = {
  'rapid-drain': { name: 'Rapid Drain Plumbing', category: 'Plumbing', bucket: 'Major Systems', phone: '(305) 555-0142', email: 'dispatch@rapiddrain.com', priorityContract: true, contractNumber: '#482', responseSla: '45 min emergency response, same-day standard', rate: '$95/hr + parts, $150 flat diagnostic', term: 'Jan 2026 – Jan 2027 (auto-renews annually)' },
  'sf-hvac': { name: 'South Florida HVAC', category: 'HVAC', bucket: 'Major Systems', phone: '(305) 555-0198', email: 'service@sfhvac.com', priorityContract: true, contractNumber: '#317', responseSla: 'Same-day for no-cooling calls', rate: '$110/hr + parts', term: 'Mar 2026 – Mar 2027 (auto-renews annually)' },
  'bright-spark-electrical': { name: 'Bright Spark Electrical', category: 'Electrical', bucket: 'Major Systems', phone: '(305) 555-0166', email: 'office@brightsparkelectric.com', priorityContract: true, contractNumber: '#529', responseSla: '2-hour response for active hazards', rate: '$100/hr + materials', term: 'Jun 2026 – Jun 2027 (auto-renews annually)' },
  'apex-roofing': { name: 'Apex Roofing & Structural', category: 'Roofing & Structural', bucket: 'Major Systems', phone: '(305) 555-0184', email: 'contracts@apexroofing.com', priorityContract: true, contractNumber: '#601', responseSla: '24-hour response for active leaks', rate: 'Quoted per job, priority scheduling included', term: 'Feb 2026 – Feb 2027 (auto-renews annually)' },
  'cooltech-appliance': { name: 'CoolTech Appliance Repair', category: 'Appliance Repair', bucket: 'Appliances', phone: '(305) 555-0177', email: 'schedule@cooltechrepair.com', priorityContract: false, contractNumber: '#210', responseSla: '2-3 business days standard', rate: '$85/hr + parts', term: 'Month-to-month' },
  'coastal-pest': { name: 'Coastal Pest Solutions', category: 'Pest & Habitability', bucket: 'Habitability', phone: '(305) 555-0155', email: 'info@coastalpest.com', priorityContract: true, contractNumber: '#398', responseSla: 'Monthly scheduled + 24-hr on-call', rate: '$175/mo per building, on-call billed separately', term: 'Jan 2026 – Dec 2026' },
  'metro-fire-safety': { name: 'Metro Fire & Safety Compliance', category: 'Code & Safety Compliance', bucket: 'Habitability', phone: '(305) 555-0143', email: 'inspections@metrofiresafety.com', priorityContract: true, contractNumber: '#455', responseSla: 'Annual inspection + 48-hr violation response', rate: '$450/inspection', term: 'Jan 2026 – Jan 2027 (auto-renews annually)' },
  'securelock': { name: 'SecureLock 24/7', category: 'Locksmith & Security', bucket: 'Other Services', phone: '(305) 555-0190', email: 'emergency@securelock247.com', priorityContract: true, contractNumber: '#288', responseSla: '30 min emergency response', rate: '$120 emergency call + parts', term: 'Ongoing, cancel anytime' },
  'green-thumb': { name: 'Green Thumb Palms', category: 'Landscaping & Grounds', bucket: 'Other Services', phone: '(305) 555-0121', email: 'crew@greenthumbpalms.com', priorityContract: false, contractNumber: '#150', responseSla: 'Weekly scheduled service', rate: '$800/mo per property', term: 'Month-to-month' },
  'blue-wave-pool': { name: 'Blue Wave Pool Service', category: 'Pool Maintenance', bucket: 'Other Services', phone: '(305) 555-0133', email: 'service@bluewavepool.com', priorityContract: false, contractNumber: '#204', responseSla: 'Weekly scheduled + on-call for equipment failure', rate: '$340/mo', term: 'Month-to-month' },
  'metro-elevator': { name: 'Metro Elevator Services', category: 'Elevator & Structural', bucket: 'Major Systems', phone: '(305) 555-0161', email: 'dispatch@metroelevator.com', priorityContract: true, contractNumber: '#512', responseSla: '2-hour emergency response', rate: '$1,100/mo maintenance contract + repairs', term: 'Jan 2026 – Jan 2027 (auto-renews annually)' },
  'aventura-guard': { name: 'Aventura Guard Services', category: 'Security', bucket: 'Other Services', phone: '(305) 555-0172', email: 'ops@aventuraguard.com', priorityContract: true, contractNumber: '#340', responseSla: 'On-site 24/7', rate: '$2,400/mo', term: 'Jan 2026 – Dec 2026' },
};

function buildVendorContractText(vendorId, propertyLabel) {
  const v = vendorDirectory[vendorId];
  if (!v) return '';
  return `SERVICE AGREEMENT\n\nPropOps AI (on behalf of ${propertyLabel}) and ${v.name}\n\nCategory: ${v.category} (${v.bucket})\nContract Number: ${v.contractNumber}\nStatus: ${v.priorityContract ? 'Priority Contract — first call for this category' : 'Standard Vendor'}\n\nResponse SLA: ${v.responseSla}\nRate: ${v.rate}\nTerm: ${v.term}\n\nContact: ${v.phone} | ${v.email}\n\nScope of Work: ${v.name} is contracted to provide ${v.category.toLowerCase()} services covering the major-systems, appliance, and habitability repairs landlords are responsible for under standard lease terms. Emergency dispatch requests are routed automatically through PropOps AI's maintenance triage system.\n\n[This is a demo contract summary for illustration purposes only.]`;
}

function findVendorIdFromAssignedString(str) {
  if (!str) return null;
  const match = Object.entries(vendorDirectory).find(([, v]) => str.includes(v.name));
  return match ? match[0] : null;
}

function buildLeaseDocument(unit, current) {
  const propName = current.label.replace(/\s*\(.*\)/, '');
  const isCommercial = current.unitLabel === 'Suite';
  const partyLabel = isCommercial ? 'Tenant Business' : 'Tenant(s)';
  const occupantsLine = isCommercial
    ? `Primary Owner/Operator: ${unit.ownerName || 'On file'}`
    : `Registered Occupants: ${(unit.occupants || []).map((o) => `${o.name} (age ${o.age})`).join(', ')}`;

  return `${isCommercial ? 'COMMERCIAL' : 'RESIDENTIAL'} LEASE AGREEMENT\n\n${propName} — ${current.unitLabel} ${unit.id}\n\nThis Agreement is entered into between ${propName} Management ("Landlord") and ${unit.tenant} ("${partyLabel}") for the premises located at ${current.unitLabel} ${unit.id}, ${propName}.\n\n1. TERM & RENT\nMonthly rent of $${unit.rent.toLocaleString()} is due on the 1st of each month, with a grace period through the 3rd. This lease is in effect through ${unit.leaseEnd}.\n\n2. SECURITY DEPOSIT\nA security deposit equal to one month's rent was collected at move-in and is held in a separate escrow account as required by local law.\n\n3. LANDLORD RESPONSIBILITIES\nLandlord shall be responsible for:\n   • Major Systems: Fixing structural damage, leaking roofs, plumbing clogs, electrical wiring, and HVAC (heating and air conditioning) units.\n   • Appliances: Repairing or replacing provided appliances (such as refrigerators or stoves) when they break down from normal use.\n   • Habitability: Keeping the building compliant with local health, safety, and building codes.\n\n4. ${partyLabel.toUpperCase()} RESPONSIBILITIES\n${partyLabel} shall maintain the premises in a clean and sanitary condition, report needed repairs promptly, and comply with all property rules including quiet hours, parking, and guest policies.\n\n5. OCCUPANCY\n${occupantsLine}\n\n6. PARKING\nAssigned parking: ${unit.parking || 'Not assigned'}.\n\n7. GOVERNING LAW\nThis Agreement is governed by the laws of the State of Florida.\n\n[This is placeholder lease text generated for demo purposes only and is not a legally binding document.]`;
}

function generateCommReply(c) {
  const first = c.tenant.split(' ')[0];
  const templates = {
    Complaint: `Hi ${first}, thank you for your patience — we've addressed the issue you reported and it should now be resolved. Please reach out if anything still needs attention.`,
    Billing: `Hi ${first}, we've reviewed your billing question and everything has been squared away on our end. Let us know if you need anything further.`,
    General: `Hi ${first}, thanks for reaching out — we've taken care of this for you.`,
    Maintenance: `Hi ${first}, our maintenance team has completed the requested work. Thank you for reporting it.`,
  };
  return templates[c.category] || templates.General;
}

export default function PropertyManagementDashboard() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [selectedPropertyId, setSelectedPropertyId] = useState('sunset');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // ============================================================
  // LIVE SANDBOX — talks to the Cloudflare Worker API backend for real
  // Twilio (SMS + Email)/DocuSign/Google Reviews/Workers AI calls. Everything
  // above this stays 100% local mock data; only the "Live Sandbox" tab
  // touches the network. API_BASE comes from an env var so this same file
  // works with no backend configured at all (the tab just explains that).
  // ============================================================
  const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');

  const [integrations, setIntegrations] = useState(null);
  const [healthError, setHealthError] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const refreshHealth = async () => {
    if (!API_BASE) { setHealthError('no-api-base'); return; }
    setHealthLoading(true);
    setHealthError(null);
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      const data = await res.json();
      setIntegrations(data.integrations || null);
    } catch (err) {
      setHealthError(String(err?.message || err));
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => { refreshHealth(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function callApi(path, options = {}) {
    if (!API_BASE) throw new Error('NEXT_PUBLIC_API_BASE is not set — see the setup guide to point this at your deployed Worker.');
    const res = await fetch(`${API_BASE}${path}`, {
      method: options.method || (options.body ? 'POST' : 'GET'),
      headers: { 'Content-Type': 'application/json' },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    let data;
    try { data = await res.json(); } catch { data = { ok: false, error: `Non-JSON response (HTTP ${res.status})` }; }
    return data;
  }

  // --- Live Sandbox: Send real SMS ---
  const [smsTo, setSmsTo] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [smsResult, setSmsResult] = useState(null);
  const [smsSending, setSmsSending] = useState(false);
  const sendLiveSms = async () => {
    setSmsSending(true); setSmsResult(null);
    try { setSmsResult(await callApi('/api/sms/send', { body: { to: smsTo, body: smsBody } })); }
    catch (err) { setSmsResult({ ok: false, error: String(err?.message || err) }); }
    finally { setSmsSending(false); }
  };

  // --- Live Sandbox: Send real Email ---
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailResult, setEmailResult] = useState(null);
  const [emailSending, setEmailSending] = useState(false);
  const sendLiveEmail = async () => {
    setEmailSending(true); setEmailResult(null);
    try { setEmailResult(await callApi('/api/email/send', { body: { to: emailTo, subject: emailSubject, body: emailBody } })); }
    catch (err) { setEmailResult({ ok: false, error: String(err?.message || err) }); }
    finally { setEmailSending(false); }
  };

  // --- Live Sandbox: Google Reviews ---
  const [liveReviews, setLiveReviews] = useState(null);
  const [reviewsFetching, setReviewsFetching] = useState(false);
  const fetchLiveReviews = async () => {
    setReviewsFetching(true); setLiveReviews(null);
    try { setLiveReviews(await callApi('/api/reviews/fetch', { body: { propertyId: selectedPropertyId } })); }
    catch (err) { setLiveReviews({ ok: false, error: String(err?.message || err) }); }
    finally { setReviewsFetching(false); }
  };

  // --- Live Sandbox: DocuSign lease e-signature ---
  const [leaseSignUnitId, setLeaseSignUnitId] = useState('');
  const [leaseSignerName, setLeaseSignerName] = useState('');
  const [leaseSignerEmail, setLeaseSignerEmail] = useState('');
  const [leaseSignResult, setLeaseSignResult] = useState(null);
  const [leaseSignSending, setLeaseSignSending] = useState(false);
  const sendLeaseForSignatureLive = async () => {
    const unit = current.unitLedger.find((u) => u.id === leaseSignUnitId);
    if (!unit) { setLeaseSignResult({ ok: false, error: `Pick a ${current.unitLabel.toLowerCase()} first.` }); return; }
    setLeaseSignSending(true); setLeaseSignResult(null);
    try {
      setLeaseSignResult(await callApi('/api/docusign/lease', {
        body: {
          leaseId: `sandbox-${selectedPropertyId}-${unit.id}`,
          documentText: buildLeaseDocument(unit, current),
          signerEmail: leaseSignerEmail,
          signerName: leaseSignerName || unit.tenant,
          unitLabel: `${current.unitLabel} ${unit.id}`,
        },
      }));
    } catch (err) { setLeaseSignResult({ ok: false, error: String(err?.message || err) }); }
    finally { setLeaseSignSending(false); }
  };

  // --- Live Sandbox: DocuSign vendor service contract ---
  const [vendorSignId, setVendorSignId] = useState('');
  const [vendorSignerName, setVendorSignerName] = useState('');
  const [vendorSignerEmail, setVendorSignerEmail] = useState('');
  const [vendorSignResult, setVendorSignResult] = useState(null);
  const [vendorSignSending, setVendorSignSending] = useState(false);
  const sendVendorContractLive = async () => {
    const v = vendorDirectory[vendorSignId];
    if (!v) { setVendorSignResult({ ok: false, error: 'Pick a vendor first.' }); return; }
    setVendorSignSending(true); setVendorSignResult(null);
    try {
      setVendorSignResult(await callApi('/api/docusign/vendor-contract', {
        body: {
          vendorId: vendorSignId,
          vendorName: v.name,
          contractText: buildVendorContractText(vendorSignId, current.label),
          signerEmail: vendorSignerEmail,
          signerName: vendorSignerName || v.name,
        },
      }));
    } catch (err) { setVendorSignResult({ ok: false, error: String(err?.message || err) }); }
    finally { setVendorSignSending(false); }
  };

  // --- Live Sandbox: lease auto-scan (Workers AI OCR) ---
  const [scanFile, setScanFile] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanFields, setScanFields] = useState(null);
  const [scanSaveResult, setScanSaveResult] = useState(null);

  const handleScanFileChange = (e) => {
    const file = e.target.files?.[0];
    setScanFile(file || null);
    setScanResult(null);
    setScanFields(null);
    setScanSaveResult(null);
  };

  const runLeaseScan = async () => {
    if (!scanFile) return;
    setScanning(true); setScanResult(null); setScanFields(null);
    try {
      const buf = await scanFile.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const imageBase64 = btoa(binary);
      const data = await callApi('/api/lease/scan', { body: { imageBase64, mimeType: scanFile.type } });
      setScanResult(data);
      if (data.ok && data.extracted) setScanFields(data.extracted);
    } catch (err) {
      setScanResult({ ok: false, error: String(err?.message || err) });
    } finally {
      setScanning(false);
    }
  };

  const saveScannedTenant = async () => {
    if (!scanFields) return;
    setScanSaveResult(null);
    try {
      const unitId = `scan-unit-${Date.now()}`;
      await callApi('/api/units', { body: { id: unitId, propertyId: 'sandbox', unitNumber: scanFields.unitNumber || 'Unassigned', rent: scanFields.monthlyRent || 0, parking: scanFields.parkingSpot || null, ownerName: scanFields.ownerOrBusinessName || null } });
      await callApi('/api/tenants', { body: { unitId, name: scanFields.tenantName || 'Unnamed Tenant', age: scanFields.tenantAge || null, isPrimary: true, source: 'lease-scan' } });
      for (const occ of (scanFields.additionalOccupants || [])) {
        await callApi('/api/tenants', { body: { unitId, name: occ.name, age: occ.age || null, source: 'lease-scan' } });
      }
      await callApi('/api/leases', { body: { unitId, leaseEnd: scanFields.leaseEndDate || null, documentText: `Auto-extracted from scanned document.\n\n${JSON.stringify(scanFields, null, 2)}` } });
      setScanSaveResult({ ok: true, unitId });
    } catch (err) {
      setScanSaveResult({ ok: false, error: String(err?.message || err) });
    }
  };

  // --- Live Sandbox: Financial model (loan, expenses, CapEx reserve, deposits, vacancy) ---
  const [financialsSummary, setFinancialsSummary] = useState(null);
  const [financialsLoading, setFinancialsLoading] = useState(false);
  const [financialsError, setFinancialsError] = useState(null);
  const refreshFinancialsSummary = async () => {
    setFinancialsLoading(true); setFinancialsError(null);
    try {
      const data = await callApi(`/api/financials/summary?propertyId=${encodeURIComponent(selectedPropertyId)}`);
      if (data.ok) setFinancialsSummary(data); else setFinancialsError(data.message || data.error);
    } catch (err) { setFinancialsError(String(err?.message || err)); }
    finally { setFinancialsLoading(false); }
  };
  useEffect(() => { if (API_BASE) refreshFinancialsSummary(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selectedPropertyId]);

  const [loanForm, setLoanForm] = useState({ lender: '', principalBalance: '', interestRate: '', monthlyPayment: '', escrowTaxMonthly: '', escrowInsuranceMonthly: '' });
  const [loanSaving, setLoanSaving] = useState(false);
  const [loanResult, setLoanResult] = useState(null);
  const saveLoan = async () => {
    setLoanSaving(true); setLoanResult(null);
    try {
      const data = await callApi('/api/loans', {
        body: {
          propertyId: selectedPropertyId,
          lender: loanForm.lender || null,
          principalBalance: Number(loanForm.principalBalance) || 0,
          interestRate: Number(loanForm.interestRate) || null,
          monthlyPayment: Number(loanForm.monthlyPayment) || 0,
          escrowTaxMonthly: Number(loanForm.escrowTaxMonthly) || 0,
          escrowInsuranceMonthly: Number(loanForm.escrowInsuranceMonthly) || 0,
        },
      });
      setLoanResult(data);
      if (data.ok) refreshFinancialsSummary();
    } catch (err) { setLoanResult({ ok: false, error: String(err?.message || err) }); }
    finally { setLoanSaving(false); }
  };

  const [expenseForm, setExpenseForm] = useState({ category: '', classification: 'opex', amount: '', description: '' });
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseResult, setExpenseResult] = useState(null);
  const saveExpense = async () => {
    setExpenseSaving(true); setExpenseResult(null);
    try {
      const data = await callApi('/api/expenses', {
        body: {
          propertyId: selectedPropertyId,
          category: expenseForm.category,
          classification: expenseForm.classification,
          amount: Number(expenseForm.amount) || 0,
          description: expenseForm.description || null,
        },
      });
      setExpenseResult(data);
      if (data.ok) { refreshFinancialsSummary(); setExpenseForm({ category: '', classification: 'opex', amount: '', description: '' }); }
    } catch (err) { setExpenseResult({ ok: false, error: String(err?.message || err) }); }
    finally { setExpenseSaving(false); }
  };

  const [reserveAmount, setReserveAmount] = useState('');
  const [reserveSaving, setReserveSaving] = useState(false);
  const [reserveResult, setReserveResult] = useState(null);
  const contributeToReserve = async () => {
    setReserveSaving(true); setReserveResult(null);
    try {
      const data = await callApi('/api/capex-reserve/contribute', { body: { propertyId: selectedPropertyId, amount: Number(reserveAmount) || 0 } });
      setReserveResult(data);
      if (data.ok) { refreshFinancialsSummary(); setReserveAmount(''); }
    } catch (err) { setReserveResult({ ok: false, error: String(err?.message || err) }); }
    finally { setReserveSaving(false); }
  };

  const [depositUnitId, setDepositUnitId] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositSaving, setDepositSaving] = useState(false);
  const [depositResult, setDepositResult] = useState(null);
  const saveDeposit = async () => {
    setDepositSaving(true); setDepositResult(null);
    try {
      const data = await callApi('/api/deposits', { body: { unitId: depositUnitId, amountHeld: Number(depositAmount) || 0 } });
      setDepositResult(data);
      if (data.ok) { refreshFinancialsSummary(); setDepositAmount(''); }
    } catch (err) { setDepositResult({ ok: false, error: String(err?.message || err) }); }
    finally { setDepositSaving(false); }
  };

  // --- Live Sandbox: SMS diagnostic-triage conversations ---
  const [smsConversations, setSmsConversations] = useState(null);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const refreshConversations = async () => {
    setConversationsLoading(true);
    try {
      const data = await callApi('/api/sms/conversations');
      if (data.ok) setSmsConversations(data.conversations || []);
    } catch { /* non-fatal, leave prior state */ }
    finally { setConversationsLoading(false); }
  };

  // ============================================================
  // ALL MOCK DATA, KEYED BY PROPERTY
  // ============================================================
  const propertiesData = {
    sunset: {
      id: 'sunset',
      label: 'Sunset Heights (24 Units)',
      unitLabel: 'Unit',
      tenantLabel: 'Tenant',
      vendorIds: ['rapid-drain', 'sf-hvac', 'bright-spark-electrical', 'apex-roofing', 'cooltech-appliance', 'coastal-pest', 'securelock', 'green-thumb'],
      financials: {
        grossRevenue: 34200, operatingExpenses: 9400, netOperatingIncome: 24800,
        occupancyRate: '95.8%', totalUnits: 24, occupiedUnits: 23,
      },
      unitLedger: [
        { id: '101', tenant: 'Marcus Vance', rent: 2200, lateFees: 0, repairs: 150, netIncome: 2050, status: 'Paid', leaseEnd: '2027-04-30', document: 'Lease_101.pdf', occupants: [{ name: 'Marcus Vance', age: 34 }], parking: 'P-101' },
        { id: '102', tenant: 'Sarah Jenkins', rent: 2400, lateFees: 50, repairs: 0, netIncome: 2450, status: 'Late (5 Days)', leaseEnd: '2026-11-15', document: 'Lease_102.pdf', occupants: [{ name: 'Sarah Jenkins', age: 29 }, { name: 'Liam Jenkins', age: 4 }], parking: 'P-102' },
        { id: '201', tenant: 'David Miller', rent: 2100, lateFees: 0, repairs: 620, netIncome: 1480, status: 'Paid', leaseEnd: '2027-01-31', document: 'Lease_201.pdf', occupants: [{ name: 'David Miller', age: 41 }, { name: 'Rebecca Miller', age: 39 }, { name: 'Noah Miller', age: 9 }], parking: 'P-201, P-201B' },
        { id: '202', tenant: 'Elena Rostova', rent: 2350, lateFees: 0, repairs: 0, netIncome: 2350, status: 'Paid', leaseEnd: '2027-08-31', document: 'Lease_202.pdf', occupants: [{ name: 'Elena Rostova', age: 27 }], parking: 'P-202' },
        { id: '301', tenant: 'James Smith', rent: 2500, lateFees: 100, repairs: 80, netIncome: 2520, status: 'Late (3 Days)', leaseEnd: '2026-12-01', document: 'Lease_301.pdf', occupants: [{ name: 'James Smith', age: 52 }, { name: 'Tanya Smith', age: 50 }], parking: 'P-301' },
        { id: '302', tenant: 'Priya Anand', rent: 2300, lateFees: 0, repairs: 0, netIncome: 2300, status: 'Paid', leaseEnd: '2027-02-28', document: 'Lease_302.pdf', occupants: [{ name: 'Priya Anand', age: 31 }, { name: 'Raj Anand', age: 33 }], parking: 'P-302' },
        { id: '401', tenant: 'Carlos Mendoza', rent: 2600, lateFees: 0, repairs: 210, netIncome: 2390, status: 'Paid', leaseEnd: '2026-10-31', document: 'Lease_401.pdf', occupants: [{ name: 'Carlos Mendoza', age: 45 }, { name: 'Sofia Mendoza', age: 12 }, { name: 'Diego Mendoza', age: 8 }], parking: 'P-401' },
        { id: '402', tenant: 'Grace Whitfield', rent: 2250, lateFees: 0, repairs: 0, netIncome: 2250, status: 'Paid', leaseEnd: '2027-05-31', document: 'Lease_402.pdf', occupants: [{ name: 'Grace Whitfield', age: 60 }], parking: 'P-402' },
      ],
      expenses: [
        { id: 1, date: '2026-09-10', category: 'Maintenance', vendor: 'South Florida HVAC', amount: 620, unit: 'Unit 201' },
        { id: 2, date: '2026-09-08', category: 'Plumbing', vendor: 'Rapid Drain Co.', amount: 150, unit: 'Unit 101' },
        { id: 3, date: '2026-09-01', category: 'Utilities', vendor: 'FPL Electric', amount: 1850, unit: 'Building Common' },
        { id: 4, date: '2026-09-01', category: 'Landscaping', vendor: 'Green Thumb Palms', amount: 800, unit: 'Grounds' },
        { id: 5, date: '2026-08-27', category: 'Locksmith', vendor: 'SecureLock 24/7', amount: 210, unit: 'Unit 401' },
        { id: 6, date: '2026-08-22', category: 'Pest Control', vendor: 'Coastal Pest Solutions', amount: 175, unit: 'Building Common' },
      ],
      reminders: [
        { id: 1, title: 'Monthly Rent Reminder', recipient: 'All Tenants', triggerDate: '3 days before 1st', status: 'Scheduled', type: 'SMS & Email', subject: 'Your rent is due soon — Sunset Heights', body: 'Hi there,\n\nThis is a friendly reminder that your rent payment for Sunset Heights is due on the 1st. A brief grace period runs through the 3rd before a late fee applies.\n\nYou can pay online through the tenant portal or drop off payment at the front office.\n\nThank you,\nSunset Heights Management' },
        { id: 2, title: 'Late Rent Warning + $50 Fee', recipient: 'Sarah Jenkins (Unit 102)', triggerDate: '5 days past due', status: 'Active Trigger', type: 'Email', subject: 'Late Payment Notice — Unit 102', body: 'Dear Sarah,\n\nOur records show rent for Unit 102 has not been received as of today, which is 5 days past the due date. Per your lease, a $50 late fee has been applied to your account.\n\nPlease submit payment as soon as possible to avoid further action. If you have questions or need to discuss a payment plan, contact our office directly.\n\nSunset Heights Management' },
        { id: 3, title: 'Lease Renewal Notice', recipient: 'Sarah Jenkins (Unit 102)', triggerDate: '60 days before expiration', status: 'Pending', type: 'Email', subject: 'Your Lease Renewal — Unit 102', body: "Dear Sarah,\n\nYour lease for Unit 102 is set to expire on 2026-11-15. We'd love to have you stay! Please review the enclosed renewal terms and let us know your decision within 30 days.\n\nSunset Heights Management" },
        { id: 4, title: 'Lease Renewal Notice', recipient: 'Carlos Mendoza (Unit 401)', triggerDate: '60 days before expiration', status: 'Pending', type: 'Email', subject: 'Your Lease Renewal — Unit 401', body: 'Dear Carlos,\n\nYour lease for Unit 401 is set to expire on 2026-10-31. Please review the enclosed renewal terms at your convenience.\n\nSunset Heights Management' },
      ],
      activityLog: [
        { id: 1, time: 'Today, 8:02 AM', actor: 'Tenant Message Agent', icon: MessageSquare, action: 'Auto-replied to Sarah Jenkins (Unit 102) re: late fee waiver request', outcome: 'Sent', preview: { channel: 'Email', from: 'Sunset Heights Management', to: 'Sarah Jenkins', subject: 'Re: Late fee waiver request', body: "Dear Sarah,\n\nThank you for reaching out. Per Section 4.2 of your lease, the grace period runs through the 3rd, so the standard $50 late fee has been applied.\n\nWe're unable to waive it, but a split-payment plan is available if requested 10 days in advance.\n\nBest regards,\nSunset Heights Management" } },
        { id: 2, time: 'Today, 6:00 AM', actor: 'Reminder Agent', icon: Bell, action: 'Sent monthly rent reminder to 24 tenants (SMS + Email)', outcome: 'Sent', preview: { channel: 'Email', from: 'Sunset Heights Management', to: 'All Tenants (24)', subject: 'Your rent is due soon — Sunset Heights', body: 'Hi there,\n\nThis is a friendly reminder that your rent payment for Sunset Heights is due on the 1st. A brief grace period runs through the 3rd before a late fee applies.\n\nYou can pay online through the tenant portal or drop off payment at the front office.\n\nThank you,\nSunset Heights Management' } },
        { id: 3, time: 'Yesterday, 4:41 PM', actor: 'Maintenance Triage Agent', icon: Wrench, action: 'Classified Unit 302 A/C outage as P2 - Urgent, dispatched South Florida HVAC', outcome: 'Dispatched' },
        { id: 4, time: 'Yesterday, 11:15 AM', actor: 'Reputation Agent', icon: Star, action: 'Drafted reply to 2-star Google review, held for manager approval', outcome: 'Awaiting Approval' },
        { id: 5, time: '2 days ago, 9:30 AM', actor: 'Reminder Agent', icon: Bell, action: 'Sent late rent warning + $100 fee notice to James Smith (Unit 301)', outcome: 'Sent', preview: { channel: 'Email', from: 'Sunset Heights Management', to: 'James Smith', subject: 'Late Payment Notice — Unit 301', body: 'Dear James,\n\nRent for Unit 301 is 3 days past due. A $100 late fee has been applied per your lease.\n\nPlease submit payment as soon as possible.\n\nSunset Heights Management' } },
        { id: 6, time: '3 days ago, 2:12 PM', actor: 'Tenant Message Agent', icon: MessageSquare, action: 'Auto-replied to Carlos Mendoza (Unit 401) re: parking permit question', outcome: 'Sent', preview: { channel: 'Email', from: 'Sunset Heights Management', to: 'Carlos Mendoza', subject: 'Re: Parking permit question', body: 'Hi Carlos,\n\nYes — visitor parking requires a permit issued through the front office, valid for the visit duration.\n\nI can issue one now if you send over the plate and expected dates.\n\nBest regards,\nSunset Heights Management' } },
      ],
      reviews: [
        { id: 1, author: 'Alex Rivera', rating: 2, date: '2 days ago', comment: 'Elevator in Building B was down for 3 days and maintenance took forever to answer.' },
        { id: 2, author: 'Amanda Blake', rating: 5, date: '1 week ago', comment: 'Loved living at Sunset Heights! Clean grounds and quick management team.' }
      ],
    },
    oceanpalm: {
      id: 'oceanpalm',
      label: 'Ocean Palm Suites (12 Units)',
      unitLabel: 'Unit',
      tenantLabel: 'Tenant',
      vendorIds: ['rapid-drain', 'sf-hvac', 'bright-spark-electrical', 'cooltech-appliance', 'blue-wave-pool', 'green-thumb'],
      financials: {
        grossRevenue: 21600, operatingExpenses: 5200, netOperatingIncome: 16400,
        occupancyRate: '91.7%', totalUnits: 12, occupiedUnits: 11,
      },
      unitLedger: [
        { id: '1A', tenant: 'Natalie Brooks', rent: 1950, lateFees: 0, repairs: 0, netIncome: 1950, status: 'Paid', leaseEnd: '2027-03-15', document: 'Lease_1A.pdf', occupants: [{ name: 'Natalie Brooks', age: 26 }], parking: 'OP-1A' },
        { id: '1B', tenant: 'Omar Farouk', rent: 1900, lateFees: 0, repairs: 340, netIncome: 1560, status: 'Paid', leaseEnd: '2026-12-31', document: 'Lease_1B.pdf', occupants: [{ name: 'Omar Farouk', age: 38 }, { name: 'Layla Farouk', age: 35 }], parking: 'OP-1B' },
        { id: '2A', tenant: 'Lena Kowalski', rent: 2050, lateFees: 75, repairs: 0, netIncome: 2125, status: 'Late (2 Days)', leaseEnd: '2026-10-20', document: 'Lease_2A.pdf', occupants: [{ name: 'Lena Kowalski', age: 44 }, { name: 'Piotr Kowalski', age: 46 }, { name: 'Anna Kowalski', age: 16 }], parking: 'OP-2A' },
        { id: '2B', tenant: 'Trevor Nash', rent: 1900, lateFees: 0, repairs: 0, netIncome: 1900, status: 'Paid', leaseEnd: '2027-06-30', document: 'Lease_2B.pdf', occupants: [{ name: 'Trevor Nash', age: 30 }], parking: 'OP-2B' },
        { id: '3A', tenant: 'Yuki Tanaka', rent: 2100, lateFees: 0, repairs: 0, netIncome: 2100, status: 'Paid', leaseEnd: '2027-01-15', document: 'Lease_3A.pdf', occupants: [{ name: 'Yuki Tanaka', age: 28 }, { name: 'Kenji Tanaka', age: 30 }], parking: 'OP-3A' },
      ],
      expenses: [
        { id: 1, date: '2026-09-09', category: 'Pool Maintenance', vendor: 'Blue Wave Pool Service', amount: 340, unit: 'Building Common' },
        { id: 2, date: '2026-09-05', category: 'Plumbing', vendor: 'Rapid Drain Co.', amount: 340, unit: 'Unit 1B' },
        { id: 3, date: '2026-09-02', category: 'Utilities', vendor: 'FPL Electric', amount: 980, unit: 'Building Common' },
        { id: 4, date: '2026-08-30', category: 'Landscaping', vendor: 'Green Thumb Palms', amount: 450, unit: 'Grounds' },
      ],
      reminders: [
        { id: 1, title: 'Monthly Rent Reminder', recipient: 'All Tenants', triggerDate: '3 days before 1st', status: 'Scheduled', type: 'SMS & Email', subject: 'Your rent is due soon — Ocean Palm Suites', body: 'Hi there,\n\nFriendly reminder that rent for Ocean Palm Suites is due on the 1st, with a grace period through the 3rd.\n\nPay online via the tenant portal or drop off at the office.\n\nThanks,\nOcean Palm Suites Management' },
        { id: 2, title: 'Late Rent Warning + $75 Fee', recipient: 'Lena Kowalski (Unit 2A)', triggerDate: '5 days past due', status: 'Active Trigger', type: 'Email', subject: 'Late Payment Notice — Unit 2A', body: 'Dear Lena,\n\nRent for Unit 2A has not been received as of today, 2 days past due. A $75 late fee has been applied per your lease.\n\nPlease submit payment promptly, or contact us to discuss options.\n\nOcean Palm Suites Management' },
        { id: 3, title: 'Lease Renewal Notice', recipient: 'Lena Kowalski (Unit 2A)', triggerDate: '60 days before expiration', status: 'Pending', type: 'Email', subject: 'Your Lease Renewal — Unit 2A', body: 'Dear Lena,\n\nYour lease for Unit 2A expires 2026-10-20. Please review the enclosed renewal terms.\n\nOcean Palm Suites Management' },
      ],
      activityLog: [
        { id: 1, time: 'Today, 7:45 AM', actor: 'Tenant Message Agent', icon: MessageSquare, action: 'Auto-replied to Omar Farouk (Unit 1B) re: pool hours question', outcome: 'Sent', preview: { channel: 'Email', from: 'Ocean Palm Suites Management', to: 'Omar Farouk', subject: 'Re: Pool hours question', body: 'Hi Omar,\n\nThe pool is open daily from 7am to 10pm. Let us know if you have any other questions!\n\nOcean Palm Suites Management' } },
        { id: 2, time: 'Today, 6:00 AM', actor: 'Reminder Agent', icon: Bell, action: 'Sent monthly rent reminder to 12 tenants (SMS + Email)', outcome: 'Sent', preview: { channel: 'Email', from: 'Ocean Palm Suites Management', to: 'All Tenants (12)', subject: 'Your rent is due soon — Ocean Palm Suites', body: 'Hi there,\n\nFriendly reminder that rent for Ocean Palm Suites is due on the 1st, with a grace period through the 3rd.\n\nPay online via the tenant portal or drop off at the office.\n\nThanks,\nOcean Palm Suites Management' } },
        { id: 3, time: 'Yesterday, 3:20 PM', actor: 'Maintenance Triage Agent', icon: Wrench, action: 'Classified Unit 1B sink leak as P1 - Emergency, dispatched Rapid Drain Co.', outcome: 'Dispatched' },
        { id: 4, time: '2 days ago, 10:05 AM', actor: 'Reminder Agent', icon: Bell, action: 'Sent late rent warning + $75 fee notice to Lena Kowalski (Unit 2A)', outcome: 'Sent', preview: { channel: 'Email', from: 'Ocean Palm Suites Management', to: 'Lena Kowalski', subject: 'Late Payment Notice — Unit 2A', body: 'Dear Lena,\n\nRent for Unit 2A has not been received as of today, 2 days past due. A $75 late fee has been applied per your lease.\n\nPlease submit payment promptly, or contact us to discuss options.\n\nOcean Palm Suites Management' } },
      ],
      reviews: [
        { id: 1, author: 'Devon Michaels', rating: 4, date: '4 days ago', comment: 'Great pool and quiet building, only issue is limited guest parking.' },
        { id: 2, author: 'Farah Haddad', rating: 5, date: '2 weeks ago', comment: 'Management responds fast and the courtyard is beautiful.' }
      ],
    },
    aventura: {
      id: 'aventura',
      label: 'Aventura Commercial Hub',
      unitLabel: 'Suite',
      tenantLabel: 'Business',
      vendorIds: ['metro-elevator', 'sf-hvac', 'bright-spark-electrical', 'apex-roofing', 'rapid-drain', 'aventura-guard', 'metro-fire-safety'],
      financials: {
        grossRevenue: 58500, operatingExpenses: 14200, netOperatingIncome: 44300,
        occupancyRate: '88.9%', totalUnits: 9, occupiedUnits: 8,
      },
      unitLedger: [
        { id: '100', tenant: 'Coastal Dental Group', rent: 7200, lateFees: 0, repairs: 0, netIncome: 7200, status: 'Paid', leaseEnd: '2028-02-28', document: 'Lease_Suite100.pdf', ownerName: 'Dr. Melissa Cho', parking: '4 reserved spaces (A1-A4)' },
        { id: '110', tenant: 'Bright Minds Tutoring', rent: 4800, lateFees: 0, repairs: 300, netIncome: 4500, status: 'Paid', leaseEnd: '2027-09-30', document: 'Lease_Suite110.pdf', ownerName: 'Robert Ellison', parking: '2 reserved spaces (B1-B2)' },
        { id: '120', tenant: 'Vantage Legal Partners', rent: 8100, lateFees: 400, repairs: 0, netIncome: 8500, status: 'Late (7 Days)', leaseEnd: '2026-11-30', document: 'Lease_Suite120.pdf', ownerName: 'Andrea Kim, Esq.', parking: '3 reserved spaces (C1-C3)' },
        { id: '200', tenant: 'Pure Barre Aventura', rent: 6200, lateFees: 0, repairs: 0, netIncome: 6200, status: 'Paid', leaseEnd: '2027-12-31', document: 'Lease_Suite200.pdf', ownerName: 'Nicole Fontaine', parking: '2 reserved spaces (D1-D2)' },
        { id: '210', tenant: 'Sunrise Accounting LLC', rent: 5400, lateFees: 0, repairs: 150, netIncome: 5250, status: 'Paid', leaseEnd: '2027-07-31', document: 'Lease_Suite210.pdf', ownerName: 'Walter Osei', parking: '2 reserved spaces (E1-E2)' },
      ],
      expenses: [
        { id: 1, date: '2026-09-11', category: 'Elevator Maintenance', vendor: 'Metro Elevator Services', amount: 1100, unit: 'Building Common' },
        { id: 2, date: '2026-09-07', category: 'HVAC', vendor: 'South Florida HVAC', amount: 300, unit: 'Suite 110' },
        { id: 3, date: '2026-09-01', category: 'Utilities', vendor: 'FPL Electric', amount: 3200, unit: 'Building Common' },
        { id: 4, date: '2026-08-28', category: 'Security', vendor: 'Aventura Guard Services', amount: 2400, unit: 'Building Common' },
        { id: 5, date: '2026-08-20', category: 'Plumbing', vendor: 'Rapid Drain Co.', amount: 150, unit: 'Suite 210' },
      ],
      reminders: [
        { id: 1, title: 'Monthly Rent Reminder', recipient: 'All Tenants', triggerDate: '3 days before 1st', status: 'Scheduled', type: 'Email', subject: 'Rent Due Soon — Aventura Commercial Hub', body: 'Hello,\n\nThis is a reminder that rent for your suite at Aventura Commercial Hub is due on the 1st.\n\nPlease remit payment via the tenant portal or contact our office with questions.\n\nAventura Commercial Hub Management' },
        { id: 2, title: 'Late Rent Warning + $400 Fee', recipient: 'Vantage Legal Partners (Suite 120)', triggerDate: '7 days past due', status: 'Active Trigger', type: 'Email', subject: 'Late Payment Notice — Suite 120', body: 'Dear Vantage Legal Partners,\n\nOur records show rent for Suite 120 is 7 days past due. Per your lease, a $400 late fee has been applied.\n\nPlease remit payment promptly to avoid further action.\n\nAventura Commercial Hub Management' },
        { id: 3, title: 'Lease Renewal Notice', recipient: 'Vantage Legal Partners (Suite 120)', triggerDate: '90 days before expiration', status: 'Pending', type: 'Email', subject: 'Lease Renewal — Suite 120', body: 'Dear Vantage Legal Partners,\n\nYour lease for Suite 120 expires 2026-11-30. Please review the enclosed renewal terms at your convenience.\n\nAventura Commercial Hub Management' },
      ],
      activityLog: [
        { id: 1, time: 'Today, 9:10 AM', actor: 'Tenant Message Agent', icon: MessageSquare, action: 'Auto-replied to Sunrise Accounting LLC (Suite 210) re: after-hours HVAC access', outcome: 'Sent', preview: { channel: 'Email', from: 'Aventura Commercial Hub Management', to: 'Sunrise Accounting LLC', subject: 'Re: After-hours HVAC access', body: 'Hello,\n\nAfter-hours facility access is available with a registered building fob — please contact the front office to arrange access for your HVAC technician.\n\nAventura Commercial Hub Management' } },
        { id: 2, time: 'Today, 6:00 AM', actor: 'Reminder Agent', icon: Bell, action: 'Sent monthly rent reminder to 9 commercial tenants (Email)', outcome: 'Sent', preview: { channel: 'Email', from: 'Aventura Commercial Hub Management', to: 'All Tenants (9)', subject: 'Rent Due Soon — Aventura Commercial Hub', body: 'Hello,\n\nThis is a reminder that rent for your suite at Aventura Commercial Hub is due on the 1st.\n\nPlease remit payment via the tenant portal or contact our office with questions.\n\nAventura Commercial Hub Management' } },
        { id: 3, time: 'Yesterday, 1:30 PM', actor: 'Maintenance Triage Agent', icon: Wrench, action: 'Classified Building Common elevator fault as P1 - Emergency, dispatched Metro Elevator Services', outcome: 'Dispatched' },
        { id: 4, time: '3 days ago, 8:50 AM', actor: 'Reminder Agent', icon: Bell, action: 'Sent late rent warning + $400 fee notice to Vantage Legal Partners (Suite 120)', outcome: 'Sent', preview: { channel: 'Email', from: 'Aventura Commercial Hub Management', to: 'Vantage Legal Partners', subject: 'Late Payment Notice — Suite 120', body: 'Dear Vantage Legal Partners,\n\nOur records show rent for Suite 120 is 7 days past due. Per your lease, a $400 late fee has been applied.\n\nPlease remit payment promptly to avoid further action.\n\nAventura Commercial Hub Management' } },
      ],
      reviews: [
        { id: 1, author: 'Rachel Kim', rating: 3, date: '5 days ago', comment: 'Parking garage lighting is dim at night, otherwise a solid business location.' },
        { id: 2, author: 'Marcus Feld', rating: 5, date: '3 weeks ago', comment: 'Professional building, responsive management, great foot traffic for our practice.' }
      ],
    },
  };

  const current = propertiesData[selectedPropertyId];

  // --- PAYMENT ACTIVITY ---
  const [paymentActivity, setPaymentActivity] = useState({
    sunset: [
      { id: 's1', time: '2 days ago', type: 'missed', text: 'Missed payment recorded for Unit 301 (James Smith) — $100 late fee applied' },
      { id: 's2', time: '5 days ago', type: 'missed', text: 'Missed payment recorded for Unit 102 (Sarah Jenkins) — $50 late fee applied' },
    ],
    oceanpalm: [
      { id: 'o1', time: '2 days ago', type: 'missed', text: 'Missed payment recorded for Unit 2A (Lena Kowalski) — $75 late fee applied' },
    ],
    aventura: [
      { id: 'a1', time: '7 days ago', type: 'missed', text: 'Missed payment recorded for Suite 120 (Vantage Legal Partners) — $400 late fee applied' },
    ],
  });

  const [unitStatusOverrides, setUnitStatusOverrides] = useState({});
  const getDisplayUnit = (u) => {
    const override = unitStatusOverrides[`${selectedPropertyId}:${u.id}`];
    return override ? { ...u, ...override } : u;
  };

  const [paymentModal, setPaymentModal] = useState(null);
  const [paymentModalAmount, setPaymentModalAmount] = useState('');
  const [paymentModalNote, setPaymentModalNote] = useState('');

  const openPaymentAction = (unit, type) => {
    if (type === 'partial' || type === 'extension') {
      setPaymentModal({ unit, type });
      setPaymentModalAmount('');
      setPaymentModalNote('');
      return;
    }
    applyPaymentAction(unit, type);
  };

  const applyPaymentAction = (unit, type, amount, note) => {
    const key = `${selectedPropertyId}:${unit.id}`;
    let statusUpdate = {};
    let text = '';
    if (type === 'paid') {
      statusUpdate = { status: 'Paid', lateFees: 0 };
      text = `Full rent payment logged for ${current.unitLabel} ${unit.id} (${unit.tenant}) — $${unit.rent.toLocaleString()}`;
    } else if (type === 'missed') {
      statusUpdate = { status: 'Missed Payment', lateFees: (unit.lateFees || 0) + 50 };
      text = `Missed payment recorded for ${current.unitLabel} ${unit.id} (${unit.tenant}) — $50 late fee applied`;
    } else if (type === 'partial') {
      statusUpdate = { status: `Partial Payment ($${amount} of $${unit.rent.toLocaleString()})` };
      text = `Partial payment of $${amount} logged for ${current.unitLabel} ${unit.id} (${unit.tenant})`;
    } else if (type === 'extension') {
      statusUpdate = { status: `Extension Granted${note ? ' — ' + note : ''}` };
      text = `Payment extension granted for ${current.unitLabel} ${unit.id} (${unit.tenant})${note ? ': ' + note : ''}`;
    }
    setUnitStatusOverrides((prev) => ({ ...prev, [key]: statusUpdate }));
    setPaymentActivity((prev) => ({
      ...prev,
      [selectedPropertyId]: [{ id: Date.now(), time: 'Just now', type, text }, ...(prev[selectedPropertyId] || [])],
    }));
    setPaymentModal(null);
  };

  const confirmPaymentModal = () => {
    if (!paymentModal) return;
    const { unit, type } = paymentModal;
    if (type === 'partial' && !paymentModalAmount) return;
    applyPaymentAction(unit, type, paymentModalAmount, paymentModalNote);
  };

  // --- TENANT COMMUNICATIONS ---
  const [tenantComms, setTenantComms] = useState({
    sunset: [
      { id: 'c1', time: '3 days ago', unitId: '201', tenant: 'David Miller', category: 'Complaint', channel: 'Email', message: 'Hallway lighting on the 2nd floor has been flickering for a week.', status: 'Open' },
      { id: 'c2', time: '5 days ago', unitId: '202', tenant: 'Elena Rostova', category: 'Billing', channel: 'SMS', message: "Asked for a copy of last month's itemized charges.", status: 'Resolved', reply: "Hi Elena, we've reviewed your billing question and everything has been squared away on our end. Let us know if you need anything further." },
    ],
    oceanpalm: [
      { id: 'c1', time: '4 days ago', unitId: '1A', tenant: 'Natalie Brooks', category: 'Complaint', channel: 'Email', message: 'Pool gate latch is broken, safety concern for kids in the building.', status: 'Open' },
    ],
    aventura: [
      { id: 'c1', time: '6 days ago', unitId: '200', tenant: 'Pure Barre Aventura', category: 'General', channel: 'Email', message: 'Asked about adding a second reserved parking spot for staff.', status: 'Resolved', reply: 'Hi Pure Barre Aventura, thanks for reaching out — we\'ve taken care of this for you.' },
    ],
  });

  const [showCommsForm, setShowCommsForm] = useState(false);
  const [commsForm, setCommsForm] = useState({ unitId: '', category: 'Complaint', channel: 'Email', message: '' });

  const submitCommsForm = () => {
    if (!commsForm.unitId || !commsForm.message) return;
    const unit = current.unitLedger.find((u) => u.id === commsForm.unitId);
    setTenantComms((prev) => ({
      ...prev,
      [selectedPropertyId]: [
        { id: Date.now(), time: 'Just now', unitId: commsForm.unitId, tenant: unit?.tenant || '—', category: commsForm.category, channel: commsForm.channel, message: commsForm.message, status: 'Open' },
        ...(prev[selectedPropertyId] || []),
      ],
    }));
    setCommsForm({ unitId: '', category: 'Complaint', channel: 'Email', message: '' });
    setShowCommsForm(false);
  };

  const resolveComm = (id) => {
    setTenantComms((prev) => ({
      ...prev,
      [selectedPropertyId]: prev[selectedPropertyId].map((c) => (c.id === id ? { ...c, status: 'Resolved', reply: c.reply || generateCommReply(c) } : c)),
    }));
  };

  // --- LEASE / VENDOR / MESSAGE PREVIEW MODALS ---
  const [leaseModal, setLeaseModal] = useState(null);
  const [vendorModal, setVendorModal] = useState(null);
  const [messagePreview, setMessagePreview] = useState(null);

  const handlePropertyChange = (id) => {
    setSelectedPropertyId(id);
    setActiveScenario(null);
    setTenantInput('');
    setTenantResponse('');
    setActiveMaintScenario(null);
    setMaintInput('');
    setMaintTriage(null);
    setSelectedReview(null);
    setReviewReply('');
    setPaymentModal(null);
    setShowCommsForm(false);
    setLeaseModal(null);
    setVendorModal(null);
    setMessagePreview(null);
  };

  const [tenantInput, setTenantInput] = useState('');
  const [tenantResponse, setTenantResponse] = useState('');
  const [activeScenario, setActiveScenario] = useState(null);
  const [maintInput, setMaintInput] = useState('');
  const [maintTriage, setMaintTriage] = useState(null);
  const [activeMaintScenario, setActiveMaintScenario] = useState(null);
  const [selectedReview, setSelectedReview] = useState(null);
  const [reviewReply, setReviewReply] = useState('');

  const tenantScenarios = useMemo(() => {
    const t = current.unitLedger;
    const pick = (i) => t[i % t.length];
    const propName = current.label.replace(/\s*\(.*\)/, '');
    const unitWord = current.unitLabel;
    const templates = [
      { id: 'late-fee', label: 'Late Fee Waiver Request', buildMessage: () => `Hi, I paid my rent today. Can you waive the late fee please? It was an honest mistake.`, buildReply: (u) => `Dear ${u.tenant.split(' ')[0]},\n\nThank you for reaching out. Per Section 4.2 of your signed lease agreement for ${propName}, rent is due on the 1st with a grace period through the 3rd. As payment was received late, the standard late fee has been applied to your balance for ${unitWord} ${u.id}.\n\nWe're unable to waive the fee, but if this is a one-time circumstance we can set up a split-payment plan for next month if requested at least 10 days in advance.\n\nBest regards,\n${propName} Management` },
      { id: 'noise', label: current.unitLabel === 'Suite' ? 'Shared Space / Noise Complaint' : 'Noise Complaint', buildMessage: () => current.unitLabel === 'Suite' ? `The tenant in the suite next to us has been running loud equipment after hours, it's audible through the wall.` : `The tenants in the unit above me have been extremely loud after 11pm almost every night this week. Can something be done?`, buildReply: (u) => `Hi there,\n\nThank you for letting us know regarding ${unitWord} ${u.id} — quiet hours and shared-space conduct are outlined in Section 7.1 of the lease. We've logged this and will be sending a courtesy notice to the neighboring tenant reminding them of the policy.\n\nIf this continues after the notice, please document dates/times so we can escalate per Section 7.3. We take this seriously.\n\nBest regards,\n${propName} Management` },
      { id: 'renewal', label: 'Lease Renewal Question', buildMessage: (u) => `I noticed our lease for ${unitWord} ${u.id} ends soon. What are our renewal options and will rent be going up?`, buildReply: (u) => `Hi ${u.tenant.split(' ')[0]},\n\nYour current lease for ${unitWord} ${u.id} runs through ${u.leaseEnd}. Per Section 2.4, we're required to provide renewal terms at least 60 days prior to expiration.\n\nBased on current market rates for comparable spaces in this area, expect a modest adjustment, typically in the 3-5% range. We'd love to have you stay — let us know if you'd like to discuss terms before the formal notice goes out.\n\nBest regards,\n${propName} Management` },
      { id: 'access', label: current.unitLabel === 'Suite' ? 'After-Hours Access Question' : 'Pet Policy Question', buildMessage: () => current.unitLabel === 'Suite' ? `A couple of our staff need to work late this week. Is after-hours building access allowed?` : `I am thinking about adopting a cat. Is that allowed under my lease and is there a pet deposit?`, buildReply: (u) => current.unitLabel === 'Suite' ? `Hi ${u.tenant.split(' ')[0]} team,\n\nYes — per Section 8 of your commercial lease, after-hours access is permitted with a registered building fob. Staff working past 8pm should badge in at the rear entrance; security is on-site until midnight.\n\nLet us know if you need additional fobs issued for staff.\n\nBest regards,\n${propName} Management` : `Hi ${u.tenant.split(' ')[0]},\n\nGreat question! Per Section 9 (Pet Policy) of your lease, cats are permitted with a one-time $300 pet deposit and $35/month pet rent. We'll need an updated pet addendum signed before move-in.\n\nBest regards,\n${propName} Management` },
      { id: 'parking', label: 'Parking / Guest Policy', buildMessage: () => current.unitLabel === 'Suite' ? `One of our clients got a warning notice for parking in the visitor lot. Is there a permit process?` : `My guest parked in the visitor lot last night and said there was a warning notice on their windshield. Do they need a permit?`, buildReply: (u) => `Hi ${u.tenant.split(' ')[0]},\n\nYes — per Section 6.3, visitor parking requires a permit issued through the front office, valid for the visit duration. Without one, vehicles in the visitor lot may receive a courtesy warning before towing eligibility on a repeat occurrence.\n\nI can issue a permit now if you send over the plate and expected time.\n\nBest regards,\n${propName} Management` },
    ];
    return templates.map((tpl, i) => { const u = pick(i); return { id: tpl.id, label: tpl.label, message: tpl.buildMessage(u), reply: tpl.buildReply(u) }; });
  }, [current]);

  const handleScenarioSelect = (scenario) => { setActiveScenario(scenario.id); setTenantInput(scenario.message); setTenantResponse(''); };
  const handleTenantAI = () => {
    if (!tenantInput) return;
    const matched = tenantScenarios.find((s) => s.id === activeScenario);
    if (matched) { setTenantResponse(matched.reply); }
    else { setTenantResponse(`Dear Tenant,\n\nThank you for reaching out. We've received your message and are reviewing it against your lease terms for ${current.label.replace(/\s*\(.*\)/, '')}. A member of our team (or the automated lease-aware assistant, once connected to a live model) will follow up shortly with a specific answer.\n\nBest regards,\n${current.label.replace(/\s*\(.*\)/, '')} Management`); }
  };

  const maintScenarios = useMemo(() => {
    const t = current.unitLedger;
    const pick = (i) => t[i % t.length];
    const unitWord = current.unitLabel;
    const templates = [
      { id: 'leak', label: 'Active Water Leak', message: (u) => `There is water leaking heavily from under the sink onto the floor in ${unitWord} ${u.id}.`, result: (u) => ({ urgency: 'P1 - EMERGENCY', category: 'Plumbing / Active Water Leak', action: 'Automated Dispatch Triggered', assignedVendor: 'Rapid Drain Plumbing (Priority Contract #482)', tenantNotice: `Emergency vendor dispatched to ${unitWord} ${u.id}. Please shut off the nearest water valve if accessible. Estimated arrival: 45 mins.` }) },
      { id: 'hvac', label: unitWord === 'Suite' ? 'HVAC Outage (Business Hours)' : 'A/C Out (Florida Heat)', message: (u) => unitWord === 'Suite' ? `The HVAC in ${unitWord} ${u.id} stopped working and it's affecting our staff and customers.` : `My air conditioning stopped working overnight and it is already 95 degrees inside ${unitWord} ${u.id}.`, result: (u) => ({ urgency: 'P2 - URGENT', category: 'HVAC / No Cooling', action: 'Automated Dispatch Triggered (same-day)', assignedVendor: 'South Florida HVAC (Standard Contract)', tenantNotice: `We've dispatched HVAC same-day for ${unitWord} ${u.id}. Estimated arrival window: 1-4pm today.` }) },
      { id: 'security', label: unitWord === 'Suite' ? 'Suite Entry / Lock Issue' : 'Broken Door Lock', message: (u) => `The lock on ${unitWord} ${u.id} is broken and won't latch shut. We're worried about security.`, result: (u) => ({ urgency: 'P1 - EMERGENCY (Security)', category: 'Locksmith / Security', action: 'Automated Dispatch Triggered', assignedVendor: 'SecureLock 24/7 (Emergency Line)', tenantNotice: `A locksmith has been dispatched immediately to ${unitWord} ${u.id} due to the security concern. Estimated arrival: 30 mins.` }) },
      { id: 'cosmetic', label: 'Minor Cosmetic Request', message: (u) => `There is a small paint chip on the wall near ${unitWord} ${u.id}. Not urgent, just wanted to flag it.`, result: (u) => ({ urgency: 'P4 - LOW / SCHEDULED', category: 'Cosmetic / Paint', action: 'Added to Next Scheduled Maintenance Pass', assignedVendor: 'In-house maintenance (batched with next visit)', tenantNotice: `Thanks for flagging! This has been added to our maintenance list for ${unitWord} ${u.id}, typically handled within 2-3 weeks.` }) },
    ];
    return templates.map((tpl, i) => { const u = pick(i); return { id: tpl.id, label: tpl.label, message: tpl.message(u), result: tpl.result(u) }; });
  }, [current]);

  const handleMaintScenarioSelect = (scenario) => { setActiveMaintScenario(scenario.id); setMaintInput(scenario.message); setMaintTriage(null); };
  const handleMaintAI = () => {
    if (!maintInput) return;
    const matched = maintScenarios.find((s) => s.id === activeMaintScenario);
    if (matched) { setMaintTriage({ ...matched.result, scenarioId: matched.id }); }
    else { setMaintTriage({ urgency: 'P3 - STANDARD (Pending Review)', category: 'Uncategorized', action: 'Flagged for Manager Review', assignedVendor: 'Not yet assigned', tenantNotice: 'Thanks for the report. Our team is reviewing the details and will follow up shortly with next steps.' }); }
  };

  const handleReviewAI = (rev) => {
    setSelectedReview(rev);
    if (rev.rating <= 3) { setReviewReply(`Hi ${rev.author.split(' ')[0]}, thank you for taking the time to share this feedback. We're sorry to hear about your experience and would like to make it right — please reach out to our office directly so we can address this further.`); }
    else { setReviewReply(`Thank you so much for the ${rev.rating}-star review, ${rev.author.split(' ')[0]}! We're thrilled to hear about your experience. Best wishes!`); }
  };

  const NAV_ITEMS = [
    { id: 'analytics', label: 'Executive Analytics', Icon: BarChart3 },
    { id: 'ledger', label: 'Unit Ledger & Expenses', Icon: Wallet },
    { id: 'tenants', label: 'Tenants & Leases', Icon: Users },
    { id: 'reminders', label: 'Automated Reminders', Icon: Bell },
    { id: 'tenant-comms', label: 'Tenant Communications', Icon: Inbox },
    { id: 'tenant-ai', label: 'Tenant Message AI', Icon: MessageSquare },
    { id: 'maintenance', label: 'Maintenance Triage', Icon: Wrench },
    { id: 'reputation', label: 'Reputation Manager', Icon: Star },
    { id: 'live-sandbox', label: 'Live Sandbox', Icon: FlaskConical },
  ];

  return (
    <div className="font-sans flex h-screen bg-slate-950 text-slate-100 overflow-hidden selection:bg-indigo-500/30 selection:text-white">
      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }
        * { scrollbar-width: thin; scrollbar-color: rgb(51 65 85) transparent; }
        *::-webkit-scrollbar { width: 8px; height: 8px; }
        *::-webkit-scrollbar-thumb { background-color: rgb(51 65 85); border-radius: 999px; }
        *::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      {/* PAYMENT MODAL */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white text-sm">{paymentModal.type === 'partial' ? 'Log Partial Payment' : 'Grant Payment Extension'}</h3>
              <button onClick={() => setPaymentModal(null)} className="text-slate-500 hover:text-white"><X size={16} /></button>
            </div>
            <p className="text-xs text-slate-400 mb-4">{current.unitLabel} {paymentModal.unit.id} — {paymentModal.unit.tenant}</p>
            {paymentModal.type === 'partial' ? (
              <div className="mb-4">
                <label className="text-xs text-slate-400 block mb-1">Amount received ($)</label>
                <input type="number" value={paymentModalAmount} onChange={(e) => setPaymentModalAmount(e.target.value)} placeholder={`e.g. ${Math.round(paymentModal.unit.rent / 2)}`} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" />
              </div>
            ) : (
              <div className="mb-4">
                <label className="text-xs text-slate-400 block mb-1">Extension note (optional)</label>
                <input type="text" value={paymentModalNote} onChange={(e) => setPaymentModalNote(e.target.value)} placeholder="e.g. new due date 9/15" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setPaymentModal(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-sm font-medium transition-colors">Cancel</button>
              <button onClick={confirmPaymentModal} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-sm font-medium transition-colors">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* VENDOR CONTRACT MODAL */}
      {vendorModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2"><FileText size={15} className="text-indigo-400" /> Vendor Contract</h3>
              <button onClick={() => setVendorModal(null)} className="text-slate-500 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 max-h-[70vh] overflow-y-auto">
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">{buildVendorContractText(vendorModal, current.label)}</pre>
            </div>
          </div>
        </div>
      )}

      {/* LEASE MODAL */}
      {leaseModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0">
              <h3 className="font-semibold text-white text-sm">{current.unitLabel} {leaseModal.id} — {leaseModal.tenant}</h3>
              <button onClick={() => setLeaseModal(null)} className="text-slate-500 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-xs text-slate-500 block">Monthly Rent</span><span className="text-white font-medium">${leaseModal.rent.toLocaleString()}</span></div>
                <div><span className="text-xs text-slate-500 block">Lease End</span><span className="text-white font-medium">{leaseModal.leaseEnd}</span></div>
                <div>
                  <span className="text-xs text-slate-500 block">{current.unitLabel === 'Suite' ? 'Primary Owner' : 'Occupants'}</span>
                  <span className="text-white font-medium">{current.unitLabel === 'Suite' ? leaseModal.ownerName : (leaseModal.occupants || []).map((o) => `${o.name} (${o.age})`).join(', ')}</span>
                </div>
                <div><span className="text-xs text-slate-500 block">Parking</span><span className="text-white font-medium">{leaseModal.parking}</span></div>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex gap-2.5 items-start">
                <ShieldCheck size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-300 leading-relaxed">Stored encrypted in a private document vault, accessible only to authorized managers for this property. Every view is access-logged, and this file is never sent as a plain email attachment — sharing happens via short-lived, expiring secure links only.</p>
              </div>
              <div>
                <span className="text-xs text-slate-500 block mb-1.5">Lease Document</span>
                <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">{buildLeaseDocument(leaseModal, current)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MESSAGE / EMAIL PREVIEW MODAL */}
      {messagePreview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                {messagePreview.channel === 'SMS' ? <MessageSquare size={15} className="text-indigo-400" /> : <Mail size={15} className="text-indigo-400" />}
                {messagePreview.channel === 'SMS' ? 'SMS Preview' : 'Email Preview'}
              </h3>
              <button onClick={() => setMessagePreview(null)} className="text-slate-500 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5">
              {messagePreview.channel === 'SMS' ? (
                <div className="bg-slate-950 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-3">To: {messagePreview.to}</p>
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-indigo-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line">{messagePreview.body}</div>
                  </div>
                </div>
              ) : (
                <div className="bg-white text-slate-800 rounded-xl p-5">
                  <div className="text-xs text-slate-500 space-y-0.5 mb-3 pb-3 border-b border-slate-200">
                    <p><span className="font-medium text-slate-700">From:</span> {messagePreview.from}</p>
                    <p><span className="font-medium text-slate-700">To:</span> {messagePreview.to}</p>
                    {messagePreview.subject && <p><span className="font-medium text-slate-700">Subject:</span> {messagePreview.subject}</p>}
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{messagePreview.body}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MOBILE NAV BACKDROP */}
      {mobileNavOpen && (
        <div onClick={() => setMobileNavOpen(false)} className="fixed inset-0 bg-black/60 z-30 md:hidden" />
      )}

      {/* SIDEBAR NAVIGATION */}
      <aside className={`fixed md:static inset-y-0 left-0 z-40 w-72 sm:w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between shrink-0 transform transition-transform duration-200 ease-out ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div>
          <div className="p-6 border-b border-slate-800/80 flex items-center gap-3">
            <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shrink-0"><Building2 size={18} strokeWidth={2} /></div>
            <div className="min-w-0">
              <h1 className="font-semibold text-[15px] leading-none text-white tracking-tight">PropOps AI</h1>
              <span className="text-[11px] text-slate-500">Enterprise Dashboard</span>
            </div>
            <button onClick={() => setMobileNavOpen(false)} className="ml-auto text-slate-500 hover:text-white md:hidden" aria-label="Close menu"><X size={18} /></button>
          </div>
          <div className="p-4">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block mb-2">Select Property</label>
            <div className="relative">
              <select value={selectedPropertyId} onChange={(e) => handlePropertyChange(e.target.value)} className="w-full appearance-none bg-slate-900 border border-slate-700/80 rounded-lg pl-3 pr-9 py-2 text-sm text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus:border-indigo-500 transition-colors">
                {Object.values(propertiesData).map((p) => (<option key={p.id} value={p.id}>{p.label}</option>))}
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
          </div>
          <nav className="mt-2 px-3 space-y-0.5 overflow-y-auto max-h-[calc(100vh-220px)]">
            {NAV_ITEMS.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => { setActiveTab(id); setMobileNavOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${activeTab === id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}>
                <Icon size={16} strokeWidth={2} className="shrink-0" />{label}
              </button>
            ))}
          </nav>
        </div>
        <div className="p-4 border-t border-slate-800/80 flex items-center gap-3">
          <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse shrink-0"></div>
          <div className="text-xs"><p className="font-medium text-slate-300">Claude AI Connected</p><p className="text-slate-500">Auto-Sync Active</p></div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 w-full min-w-0 overflow-y-auto bg-slate-950 p-4 sm:p-6 md:p-8">
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6 md:mb-8 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileNavOpen(true)} className="md:hidden shrink-0 h-9 w-9 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white" aria-label="Open menu"><Menu size={18} /></button>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight capitalize truncate">{activeTab.replace('-', ' ')}</h2>
              <p className="text-slate-400 text-xs sm:text-sm mt-0.5 truncate">Managing operations for <span className="text-indigo-400 font-medium">{current.label}</span></p>
            </div>
          </div>
          <button className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 shrink-0"><Plus size={15} /> Add New Entry</button>
        </header>

        {/* 1. EXECUTIVE ANALYTICS */}
        {activeTab === 'analytics' && (
          <FadeIn keyProp={selectedPropertyId + '-analytics'}>
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2 bg-indigo-600 rounded-2xl p-6 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-indigo-100/80 uppercase tracking-wide">Net Operating Income</span>
                  <TrendingUp size={16} className="text-indigo-100/70" />
                </div>
                <div className="mt-6">
                  <p className="text-4xl font-semibold text-white tabular-nums">${current.financials.netOperatingIncome.toLocaleString()}</p>
                  <p className="text-xs text-indigo-100/70 mt-1.5">Monthly net cash flow, {current.label.replace(/\s*\(.*\)/, '')}</p>
                </div>
              </div>
              <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-800 bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-5"><p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Gross Revenue</p><p className="text-xl font-semibold text-white mt-1.5 tabular-nums">${current.financials.grossRevenue.toLocaleString()}</p><p className="text-xs text-emerald-400 mt-1">↑ 4.2% vs last month</p></div>
                <div className="p-5"><p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Operating Expenses</p><p className="text-xl font-semibold text-white mt-1.5 tabular-nums">${current.financials.operatingExpenses.toLocaleString()}</p><p className="text-xs text-slate-500 mt-1">Repairs & utilities</p></div>
                <div className="p-5"><p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Occupancy</p><p className="text-xl font-semibold text-white mt-1.5 tabular-nums">{current.financials.occupancyRate}</p><p className="text-xs text-slate-500 mt-1">{current.financials.occupiedUnits} / {current.financials.totalUnits} {current.unitLabel}s occupied</p></div>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Sparkles size={15} className="text-indigo-400" /> AI Portfolio Insights</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-xl"><span className="text-emerald-400 font-medium text-xs uppercase tracking-wide">Revenue Optimization</span><p className="text-slate-300 mt-2 leading-relaxed">{current.unitLedger[0]?.tenant}'s lease ({current.unitLabel} {current.unitLedger[0]?.id}) is one to watch — current market rate for comparable {current.unitLabel.toLowerCase()}s in this area trends above the current rent on file.</p></div>
                <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-xl"><span className="text-rose-400 font-medium text-xs uppercase tracking-wide">Expense Anomaly Alert</span><p className="text-slate-300 mt-2 leading-relaxed">{current.expenses[0]?.unit} shows elevated {current.expenses[0]?.category.toLowerCase()} spend this month relative to the property average — recommend a follow-up inspection.</p></div>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Zap size={15} className="text-amber-400" /> Live Automated Activity
                <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full ml-1">Agents Running</span>
              </h3>
              <div className="space-y-1.5">
                {current.activityLog.map((a) => {
                  const ActorIcon = a.icon;
                  return (
                    <div key={a.id} className="flex items-start gap-3 p-3 bg-slate-900/70 border border-slate-800 rounded-xl text-sm">
                      <div className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 mt-0.5"><ActorIcon size={14} className="text-indigo-300" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200"><span className="font-medium text-indigo-300">{a.actor}:</span> {a.action}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{a.time}</p>
                      </div>
                      {a.preview && (
                        <button onClick={() => setMessagePreview(a.preview)} className="shrink-0 flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"><Eye size={13} /> Preview</button>
                      )}
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${a.outcome === 'Sent' || a.outcome === 'Dispatched' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>{a.outcome}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          </FadeIn>
        )}

        {/* 2. UNIT LEDGER & EXPENSES */}
        {activeTab === 'ledger' && (
          <FadeIn keyProp={selectedPropertyId + '-ledger'}>
          <div className="space-y-6">
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <h3 className="font-semibold text-white text-sm">Income per {current.unitLabel} Breakdown</h3>
                <span className="text-xs text-slate-500">Includes base rent, late fees, and dedicated maintenance</span>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300 min-w-[820px]">
                <thead className="bg-slate-900/80 text-[11px] text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="p-4 font-medium">{current.unitLabel} #</th>
                    <th className="p-4 font-medium">{current.tenantLabel}</th>
                    <th className="p-4 font-medium">Base Rent</th>
                    <th className="p-4 font-medium">Late Fees</th>
                    <th className="p-4 font-medium">Repair Costs</th>
                    <th className="p-4 font-medium">Net Income</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Log Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {current.unitLedger.map((baseUnit) => {
                    const u = getDisplayUnit(baseUnit);
                    return (
                    <tr key={u.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="p-4 font-medium text-white">{current.unitLabel} {u.id}</td>
                      <td className="p-4">{u.tenant}</td>
                      <td className="p-4 tabular-nums">${u.rent.toLocaleString()}</td>
                      <td className="p-4 tabular-nums text-amber-400">${u.lateFees}</td>
                      <td className="p-4 tabular-nums text-rose-400">-${u.repairs}</td>
                      <td className="p-4 tabular-nums font-semibold text-emerald-400">${u.netIncome.toLocaleString()}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${u.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : u.status === 'Missed Payment' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : u.status.startsWith('Partial') ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : u.status.startsWith('Extension') ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>{u.status}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <button title="Log Payment" onClick={() => openPaymentAction(baseUnit, 'paid')} className="h-7 w-7 flex items-center justify-center rounded-md bg-slate-800 hover:bg-emerald-600 text-emerald-400 hover:text-white transition-colors"><CircleDollarSign size={14} /></button>
                          <button title="Log Missed Payment" onClick={() => openPaymentAction(baseUnit, 'missed')} className="h-7 w-7 flex items-center justify-center rounded-md bg-slate-800 hover:bg-rose-600 text-rose-400 hover:text-white transition-colors"><XCircle size={14} /></button>
                          <button title="Log Partial Payment" onClick={() => openPaymentAction(baseUnit, 'partial')} className="h-7 w-7 flex items-center justify-center rounded-md bg-slate-800 hover:bg-amber-600 text-amber-400 hover:text-white transition-colors"><Percent size={14} /></button>
                          <button title="Grant Payment Extension" onClick={() => openPaymentAction(baseUnit, 'extension')} className="h-7 w-7 flex items-center justify-center rounded-md bg-slate-800 hover:bg-indigo-600 text-indigo-300 hover:text-white transition-colors"><CalendarClock size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
              <h3 className="font-semibold text-white text-sm mb-3 px-1">Recent Payment Activity</h3>
              <div className="space-y-1.5">
                {(paymentActivity[selectedPropertyId] || []).length === 0 && (<p className="text-slate-500 text-sm px-1">No payment actions logged yet for this property.</p>)}
                {(paymentActivity[selectedPropertyId] || []).map((p) => (
                  <div key={p.id} className="flex justify-between items-center p-3 bg-slate-900/70 border border-slate-800 rounded-xl text-sm">
                    <div className="flex items-center gap-2.5">
                      <span className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 ${p.type === 'paid' ? 'bg-emerald-500/15 text-emerald-400' : p.type === 'missed' ? 'bg-rose-500/15 text-rose-400' : p.type === 'partial' ? 'bg-amber-500/15 text-amber-400' : 'bg-indigo-500/15 text-indigo-300'}`}>
                        {p.type === 'paid' && <CircleDollarSign size={12} />}
                        {p.type === 'missed' && <XCircle size={12} />}
                        {p.type === 'partial' && <Percent size={12} />}
                        {p.type === 'extension' && <CalendarClock size={12} />}
                      </span>
                      <p className="text-slate-200">{p.text}</p>
                    </div>
                    <span className="text-xs text-slate-500 shrink-0 ml-3">{p.time}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
              <h3 className="font-semibold text-white text-sm mb-3 px-1">Recent Categorized Expenses</h3>
              <div className="space-y-1.5">
                {current.expenses.map((exp) => (
                  <div key={exp.id} className="flex justify-between items-center p-3 bg-slate-900/70 border border-slate-800 rounded-xl text-sm">
                    <div><p className="font-medium text-white">{exp.vendor} <span className="text-slate-500 font-normal">({exp.category})</span></p><p className="text-xs text-slate-500 mt-0.5">{exp.unit} • {exp.date}</p></div>
                    <span className="font-semibold text-rose-400 tabular-nums">-${exp.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </FadeIn>
        )}

        {/* 3. TENANTS & LEASES */}
        {activeTab === 'tenants' && (
          <FadeIn keyProp={selectedPropertyId + '-tenants'}>
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300 min-w-[980px]">
              <thead className="bg-slate-900/80 text-[11px] text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="p-4 font-medium">{current.unitLabel}</th>
                  <th className="p-4 font-medium">{current.tenantLabel} Name</th>
                  <th className="p-4 font-medium">{current.unitLabel === 'Suite' ? 'Primary Owner' : 'Occupants'}</th>
                  <th className="p-4 font-medium">Parking</th>
                  <th className="p-4 font-medium">Lease Expiration</th>
                  <th className="p-4 font-medium">Contract Copy</th>
                  <th className="p-4 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {current.unitLedger.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="p-4 font-medium text-white">{current.unitLabel} {u.id}</td>
                    <td className="p-4">{u.tenant}</td>
                    <td className="p-4 text-xs text-slate-400 max-w-[220px]">
                      {current.unitLabel === 'Suite' ? u.ownerName : (u.occupants || []).map((o) => `${o.name} (${o.age})`).join(', ')}
                    </td>
                    <td className="p-4 text-xs text-slate-400">{u.parking}</td>
                    <td className="p-4 tabular-nums">{u.leaseEnd}</td>
                    <td className="p-4">
                      <button onClick={() => setLeaseModal(u)} className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 hover:underline"><FileText size={14} /> {u.document}</button>
                    </td>
                    <td className="p-4">
                      <button onClick={() => setLeaseModal(u)} className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">Manage Lease</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          </FadeIn>
        )}

        {/* 4. AUTOMATED REMINDERS */}
        {activeTab === 'reminders' && (
          <FadeIn keyProp={selectedPropertyId + '-reminders'}>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {current.reminders.map((r) => (
                <div key={r.id} className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <h4 className="font-semibold text-white text-sm">{r.title}</h4>
                      <span className="text-[11px] font-medium bg-indigo-500/15 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/25 whitespace-nowrap">{r.type}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Target: <span className="text-slate-200">{r.recipient}</span></p>
                    <p className="text-xs text-slate-400">Trigger Rule: <span className="text-slate-200">{r.triggerDate}</span></p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center">
                    <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5"><CheckCircle2 size={13} /> {r.status}</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setMessagePreview({ channel: r.type === 'SMS' ? 'SMS' : 'Email', from: `${current.label.replace(/\s*\(.*\)/, '')} Management`, to: r.recipient, subject: r.subject, body: r.body })} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"><Eye size={13} /> Preview</button>
                      <button className="text-xs text-slate-400 hover:text-white">Edit Rule</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-white mb-3">Recently Sent (Automated)</h3>
              <div className="space-y-1.5">
                {current.activityLog.filter((a) => a.actor === 'Reminder Agent').map((a) => (
                  <div key={a.id} className="flex justify-between items-center p-3 bg-slate-900/70 border border-slate-800 rounded-xl text-sm">
                    <p className="text-slate-200">{a.action}</p>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      {a.preview && <button onClick={() => setMessagePreview(a.preview)} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"><Eye size={13} /> Preview</button>}
                      <span className="text-xs text-slate-500">{a.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </FadeIn>
        )}

        {/* 5. TENANT COMMUNICATIONS LOG */}
        {activeTab === 'tenant-comms' && (
          <FadeIn keyProp={selectedPropertyId + '-tenant-comms'}>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <p className="text-xs text-slate-400 max-w-lg">A running record of tenant complaints and inquiries across every channel — separate from maintenance tickets, so a noise complaint or billing dispute still has a timestamped paper trail.</p>
              <button onClick={() => setShowCommsForm((v) => !v)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors shrink-0 ml-4"><Plus size={14} /> Log Communication</button>
            </div>

            {showCommsForm && (
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">{current.unitLabel} / {current.tenantLabel}</label>
                    <select value={commsForm.unitId} onChange={(e) => setCommsForm((f) => ({ ...f, unitId: e.target.value }))} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                      <option value="">Select...</option>
                      {current.unitLedger.map((u) => (<option key={u.id} value={u.id}>{current.unitLabel} {u.id} — {u.tenant}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Category</label>
                    <select value={commsForm.category} onChange={(e) => setCommsForm((f) => ({ ...f, category: e.target.value }))} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                      <option>Complaint</option><option>Billing</option><option>General</option><option>Maintenance</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Channel</label>
                    <select value={commsForm.channel} onChange={(e) => setCommsForm((f) => ({ ...f, channel: e.target.value }))} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                      <option>Email</option><option>SMS</option><option>Phone</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Message / summary</label>
                  <textarea value={commsForm.message} onChange={(e) => setCommsForm((f) => ({ ...f, message: e.target.value }))} className="w-full h-20 bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" placeholder="What did the tenant say?" />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowCommsForm(false)} className="text-xs px-3 py-2 rounded-lg text-slate-400 hover:text-white transition-colors">Cancel</button>
                  <button onClick={submitCommsForm} className="text-xs px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">Save Entry</button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {(tenantComms[selectedPropertyId] || []).map((c) => (
                <div key={c.id} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
                  <div className="flex justify-between items-start gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white text-sm">{c.tenant}</span>
                      <span className="text-xs text-slate-500">{current.unitLabel} {c.unitId}</span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${commsCategoryStyle[c.category] || commsCategoryStyle.General}`}>{c.category}</span>
                      <span className="text-[11px] text-slate-500 border border-slate-700 rounded-full px-2 py-0.5">{c.channel}</span>
                    </div>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${c.status === 'Open' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>{c.status}</span>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{c.message}</p>
                  <div className="flex justify-between items-center mt-2.5">
                    <span className="text-xs text-slate-500">{c.time}</span>
                    <div className="flex items-center gap-3">
                      {c.status === 'Open' && (<button onClick={() => resolveComm(c.id)} className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"><CheckCircle2 size={13} /> Mark Resolved</button>)}
                      {c.status === 'Resolved' && c.reply && (
                        <button onClick={() => setMessagePreview({ channel: c.channel === 'SMS' ? 'SMS' : 'Email', from: `${current.label.replace(/\s*\(.*\)/, '')} Management`, to: c.tenant, subject: c.channel !== 'SMS' ? `Re: ${c.category}` : undefined, body: c.reply })} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"><Eye size={13} /> View Reply Sent</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {(tenantComms[selectedPropertyId] || []).length === 0 && (<p className="text-slate-500 text-sm">No communications logged yet for this property.</p>)}
            </div>
          </div>
          </FadeIn>
        )}

        {/* 6. TENANT MESSAGE ASSISTANT */}
        {activeTab === 'tenant-ai' && (
          <FadeIn keyProp={selectedPropertyId + '-tenant-ai'}>
          <div className="space-y-6">
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-400 mb-3">Try a realistic {current.tenantLabel.toLowerCase()} message for {current.label} — click one to load it, then generate the reply:</p>
              <div className="flex flex-wrap gap-2">
                {tenantScenarios.map((s) => { const Icon = tenantIconMap[s.id]; return (
                  <button key={s.id} onClick={() => handleScenarioSelect(s)} className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors ${activeScenario === s.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-indigo-500/60'}`}><Icon size={13} /> {s.label}</button>
                );})}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl">
                <h3 className="font-semibold text-white text-sm mb-2 flex items-center gap-2"><MessageSquare size={15} className="text-indigo-400" /> Incoming {current.tenantLabel} Query</h3>
                <p className="text-xs text-slate-400 mb-4">Paste raw text from email or SMS, or use a scenario above. AI cross-references lease terms to generate a policy-compliant reply.</p>
                <textarea value={tenantInput} onChange={(e) => { setTenantInput(e.target.value); setActiveScenario(null); }} placeholder="Example: 'Hi, I paid my rent today. Can you waive the late fee please?'" className="w-full h-36 bg-slate-950 border border-slate-700/80 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus:border-indigo-500 mb-4 transition-colors" />
                <button onClick={handleTenantAI} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"><Sparkles size={15} /> Generate Lease-Aware Reply</button>
              </div>
              <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-white text-sm mb-2">AI Drafted Output</h3>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 h-56 text-sm text-slate-300 whitespace-pre-line overflow-y-auto leading-relaxed">{tenantResponse || <span className="text-slate-600">Generated response will appear here...</span>}</div>
                </div>
                {tenantResponse && (<button className="mt-4 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"><CheckCircle2 size={15} /> Approve & Send to {current.tenantLabel}</button>)}
              </div>
            </div>
          </div>
          </FadeIn>
        )}

        {/* 7. MAINTENANCE TRIAGE */}
        {activeTab === 'maintenance' && (
          <FadeIn keyProp={selectedPropertyId + '-maintenance'}>
          <div className="space-y-6">
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-400 mb-3">Try a realistic maintenance request for {current.label} — click one to load it, then run triage:</p>
              <div className="flex flex-wrap gap-2">
                {maintScenarios.map((s) => { const Icon = maintIconMap[s.id]; return (
                  <button key={s.id} onClick={() => handleMaintScenarioSelect(s)} className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors ${activeMaintScenario === s.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-indigo-500/60'}`}><Icon size={13} /> {s.label}</button>
                );})}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl">
                <h3 className="font-semibold text-white text-sm mb-2 flex items-center gap-2"><Wrench size={15} className="text-indigo-400" /> Maintenance Request Triage</h3>
                <p className="text-xs text-slate-400 mb-4">Input a repair issue to auto-determine severity and assign preferred local vendor.</p>
                <textarea value={maintInput} onChange={(e) => { setMaintInput(e.target.value); setActiveMaintScenario(null); }} placeholder={`Example: 'There is water leaking heavily from under the sink in ${current.unitLabel} ${current.unitLedger[0]?.id}.'`} className="w-full h-36 bg-slate-950 border border-slate-700/80 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus:border-indigo-500 mb-4 transition-colors" />
                <button onClick={handleMaintAI} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"><AlertTriangle size={15} /> Analyze Priority & Dispatch</button>
              </div>
              <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl">
                <h3 className="font-semibold text-white text-sm mb-4">Triage Analysis</h3>
                {maintTriage ? (
                  <div className="space-y-4 text-sm">
                    <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${maintTriage.urgency.startsWith('P1') ? 'bg-rose-500/10 border-rose-500/25' : maintTriage.urgency.startsWith('P2') ? 'bg-amber-500/10 border-amber-500/25' : maintTriage.urgency.startsWith('P3') ? 'bg-indigo-500/10 border-indigo-500/25' : 'bg-slate-800/50 border-slate-700/50'}`}>
                      {maintTriage.scenarioId && maintIconMap[maintTriage.scenarioId] && ((() => { const Icon = maintIconMap[maintTriage.scenarioId]; return <Icon size={18} className="mt-0.5 shrink-0 text-slate-300" />; })())}
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-wide block text-slate-300">Urgency Score</span>
                        <span className="font-semibold text-white">{maintTriage.urgency}</span>
                        <p className="text-xs text-slate-400 mt-1">{maintTriage.category}</p>
                      </div>
                    </div>
                    <div><span className="text-xs text-slate-500 block mb-0.5">System Action</span><span className="text-white font-medium">{maintTriage.action}</span></div>
                    <div>
                      <span className="text-xs text-slate-500 block mb-0.5">Assigned Contractor</span>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-white font-medium">{maintTriage.assignedVendor}</span>
                        {findVendorIdFromAssignedString(maintTriage.assignedVendor) && (
                          <button onClick={() => setVendorModal(findVendorIdFromAssignedString(maintTriage.assignedVendor))} className="shrink-0 flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"><Eye size={13} /> View Contract</button>
                        )}
                      </div>
                    </div>
                    <div><span className="text-xs text-slate-500 block mb-1">Auto-Drafted Notice</span><p className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-300 leading-relaxed">{maintTriage.tenantNotice}</p></div>
                  </div>
                ) : (<p className="text-slate-500 text-sm">Select a scenario above (or type your own) to test triage logic.</p>)}
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
              <h3 className="font-semibold text-white text-sm mb-1 flex items-center gap-2"><Users size={15} className="text-indigo-400" /> PropOps Contracted Vendor Network</h3>
              <p className="text-xs text-slate-400 mb-4">Pre-vetted contractors already under contract for {current.label} — covering major systems, appliances, and habitability</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {current.vendorIds.map((vendorId) => {
                  const v = vendorDirectory[vendorId];
                  return (
                    <div key={vendorId} className="p-4 bg-slate-900/70 border border-slate-800 rounded-xl hover:border-indigo-500/30 transition-colors">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <h4 className="font-semibold text-white text-sm">{v.name}</h4>
                          <p className="text-xs text-slate-400">{v.category}</p>
                        </div>
                        {v.priorityContract && (<span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded whitespace-nowrap">PRIORITY</span>)}
                      </div>
                      <div className="text-xs text-slate-400 space-y-1 mb-3">
                        <p>📞 {v.phone}</p>
                        <p>⏱️ {v.responseSla}</p>
                      </div>
                      <button onClick={() => setVendorModal(vendorId)} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"><FileText size={12} /> View Contract</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          </FadeIn>
        )}

        {/* 8. REPUTATION MANAGER */}
        {activeTab === 'reputation' && (
          <FadeIn keyProp={selectedPropertyId + '-reputation'}>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
                <p className="text-xs text-slate-500 mb-2">Average Rating</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white">4.2</span>
                  <span className="text-sm text-slate-400">/5</span>
                </div>
                <StarRating rating={4} />
                <p className="text-xs text-slate-500 mt-2">Based on {current.reviews.length} total reviews</p>
              </div>
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
                <p className="text-xs text-slate-500 mb-2">Recent Mentions</p>
                <p className="text-2xl font-bold text-white">7</p>
                <p className="text-xs text-slate-400 mt-2">Google, Yelp, Zillow, Apartments.com</p>
              </div>
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
                <p className="text-xs text-slate-500 mb-2">Sentiment</p>
                <div className="flex gap-2 mt-1.5">
                  <span className="inline-block px-2 py-1 bg-emerald-500/15 text-emerald-400 text-xs rounded border border-emerald-500/30">Positive 85%</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Recent Reviews & Responses</h3>
              {current.reviews.map((rev) => (
                <div key={rev.id} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">{rev.author}</span>
                        <StarRating rating={rev.rating} />
                      </div>
                      <p className="text-xs text-slate-500">{rev.date}</p>
                    </div>
                    <button onClick={() => handleReviewAI(rev)} className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${selectedReview?.id === rev.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-indigo-500/40'}`}>Draft Reply</button>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed mb-3">{rev.comment}</p>
                  {selectedReview?.id === rev.id && reviewReply && (
                    <div className="mt-3 pt-3 border-t border-slate-800">
                      <p className="text-xs text-slate-500 mb-2">AI Suggested Response:</p>
                      <p className="text-sm text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800 leading-relaxed mb-3">{reviewReply}</p>
                      <div className="flex gap-2">
                        <button className="text-xs px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors">Post Reply</button>
                        <button onClick={() => setSelectedReview(null)} className="text-xs px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors">Edit</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          </FadeIn>
        )}

        {/* 9. LIVE SANDBOX — real Twilio (SMS+Email)/DocuSign/Google/Workers AI calls */}
        {activeTab === 'live-sandbox' && (
          <FadeIn keyProp="live-sandbox">
          <div className="space-y-6">
            {!API_BASE && (
              <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 flex gap-3 items-start">
                <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-200">
                  <p className="font-medium">No backend connected yet</p>
                  <p className="text-amber-200/80 mt-1">Set <code className="bg-slate-900/60 px-1.5 py-0.5 rounded text-xs">NEXT_PUBLIC_API_BASE</code> to your deployed Worker URL (e.g. https://propops-sandbox-api.&lt;you&gt;.workers.dev) and redeploy, then this whole tab lights up.</p>
                </div>
              </div>
            )}

            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2"><FlaskConical size={15} className="text-indigo-400" /> Integration Status</h3>
                <button onClick={refreshHealth} disabled={healthLoading} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-50">
                  <RefreshCw size={13} className={healthLoading ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { key: 'twilio', label: 'Twilio (SMS)' },
                  { key: 'twilioEmail', label: 'Twilio (Email)' },
                  { key: 'googleReviews', label: 'Google Reviews' },
                  { key: 'docusign', label: 'DocuSign' },
                  { key: 'workersAi', label: 'Workers AI + D1' },
                ].map((row) => {
                  const on = integrations?.[row.key];
                  return (
                    <div key={row.key} className={`p-3 rounded-xl border text-xs ${on ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-slate-900/70 border-slate-800'}`}>
                      <p className={`font-medium ${on ? 'text-emerald-400' : 'text-slate-400'}`}>{row.label}</p>
                      <p className={`mt-1 ${on ? 'text-emerald-300/80' : 'text-slate-500'}`}>{on ? 'Configured' : API_BASE ? 'Not configured' : '—'}</p>
                    </div>
                  );
                })}
              </div>
              {healthError && healthError !== 'no-api-base' && (
                <p className="text-xs text-rose-400 mt-3">Health check failed: {healthError}</p>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* SEND REAL SMS */}
              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl">
                <h3 className="font-semibold text-white text-sm mb-1 flex items-center gap-2"><MessageSquare size={15} className="text-indigo-400" /> Send a Real SMS (Twilio)</h3>
                <p className="text-xs text-slate-400 mb-3">Sends an actual text via your Twilio number. On a trial account, the destination must be a verified number.</p>
                <input value={smsTo} onChange={(e) => setSmsTo(e.target.value)} placeholder="+13055551234" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" />
                <textarea value={smsBody} onChange={(e) => setSmsBody(e.target.value)} placeholder="Your rent is due in 3 days." className="w-full h-20 bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 mb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" />
                <button onClick={sendLiveSms} disabled={smsSending || !smsTo || !smsBody} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                  {smsSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send SMS
                </button>
                {smsResult && (
                  <div className={`mt-3 p-3 rounded-lg text-xs ${smsResult.ok ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25' : 'bg-rose-500/10 text-rose-300 border border-rose-500/25'}`}>
                    {smsResult.ok ? `Sent — Twilio SID ${smsResult.twilioSid || smsResult.id}` : (smsResult.message || smsResult.error)}
                  </div>
                )}
              </div>

              {/* SEND REAL EMAIL */}
              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl">
                <h3 className="font-semibold text-white text-sm mb-1 flex items-center gap-2"><Mail size={15} className="text-indigo-400" /> Send a Real Email (Twilio)</h3>
                <p className="text-xs text-slate-400 mb-3">Sends via Twilio's native Email API from your Verified Sender domain. Delivery is async — a success here means "queued," not "delivered."</p>
                <input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="you@example.com" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" />
                <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Subject" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" />
                <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} placeholder="Message body" className="w-full h-20 bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 mb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" />
                <button onClick={sendLiveEmail} disabled={emailSending || !emailTo || !emailSubject || !emailBody} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                  {emailSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send Email
                </button>
                {emailResult && (
                  <div className={`mt-3 p-3 rounded-lg text-xs ${emailResult.ok ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25' : 'bg-rose-500/10 text-rose-300 border border-rose-500/25'}`}>
                    {emailResult.ok ? `Queued — Operation ID ${emailResult.operationId || emailResult.id}` : (emailResult.message || emailResult.error)}
                  </div>
                )}
              </div>

              {/* GOOGLE REVIEWS */}
              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl">
                <h3 className="font-semibold text-white text-sm mb-1 flex items-center gap-2"><Star size={15} className="text-indigo-400" /> Pull Live Google Reviews</h3>
                <p className="text-xs text-slate-400 mb-3">Fetches real reviews for the Google Place ID you configured, and caches them in D1.</p>
                <button onClick={fetchLiveReviews} disabled={reviewsFetching} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors mb-3">
                  {reviewsFetching ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Fetch Reviews
                </button>
                {liveReviews && !liveReviews.ok && (
                  <div className="p-3 rounded-lg text-xs bg-rose-500/10 text-rose-300 border border-rose-500/25">{liveReviews.message || liveReviews.error}</div>
                )}
                {liveReviews?.ok && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400">{liveReviews.placeName} — {liveReviews.overallRating}★ ({liveReviews.totalRatings} ratings)</p>
                    {(liveReviews.reviews || []).slice(0, 5).map((r, i) => (
                      <div key={i} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                        <p className="text-slate-200 font-medium">{r.author} — {r.rating}★</p>
                        <p className="text-slate-400 mt-0.5">{r.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* DOCUSIGN — LEASE */}
              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl">
                <h3 className="font-semibold text-white text-sm mb-1 flex items-center gap-2"><FileText size={15} className="text-indigo-400" /> Send a Lease for E-Signature</h3>
                <p className="text-xs text-slate-400 mb-3">Builds the lease document for the {current.unitLabel.toLowerCase()} you pick and sends it through DocuSign.</p>
                <select value={leaseSignUnitId} onChange={(e) => setLeaseSignUnitId(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <option value="">Select {current.unitLabel.toLowerCase()}...</option>
                  {current.unitLedger.map((u) => (<option key={u.id} value={u.id}>{current.unitLabel} {u.id} — {u.tenant}</option>))}
                </select>
                <input value={leaseSignerName} onChange={(e) => setLeaseSignerName(e.target.value)} placeholder="Signer name (defaults to tenant on file)" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" />
                <input value={leaseSignerEmail} onChange={(e) => setLeaseSignerEmail(e.target.value)} placeholder="Signer email (required — this is a fake tenant, use your own)" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 mb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" />
                <button onClick={sendLeaseForSignatureLive} disabled={leaseSignSending || !leaseSignUnitId || !leaseSignerEmail} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                  {leaseSignSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send for Signature
                </button>
                {leaseSignResult && (
                  <div className={`mt-3 p-3 rounded-lg text-xs ${leaseSignResult.ok ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25' : 'bg-rose-500/10 text-rose-300 border border-rose-500/25'}`}>
                    {leaseSignResult.ok ? `Envelope sent — ID ${leaseSignResult.envelopeId} (status: ${leaseSignResult.status})` : (leaseSignResult.message || leaseSignResult.error)}
                  </div>
                )}
              </div>

              {/* DOCUSIGN — VENDOR CONTRACT */}
              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl">
                <h3 className="font-semibold text-white text-sm mb-1 flex items-center gap-2"><Wrench size={15} className="text-indigo-400" /> Send a Vendor Contract for E-Signature</h3>
                <p className="text-xs text-slate-400 mb-3">Builds the service agreement for the vendor you pick and sends it through DocuSign.</p>
                <select value={vendorSignId} onChange={(e) => setVendorSignId(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <option value="">Select vendor...</option>
                  {current.vendorIds.map((vid) => (<option key={vid} value={vid}>{vendorDirectory[vid].name}</option>))}
                </select>
                <input value={vendorSignerName} onChange={(e) => setVendorSignerName(e.target.value)} placeholder="Signer name (defaults to vendor name)" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" />
                <input value={vendorSignerEmail} onChange={(e) => setVendorSignerEmail(e.target.value)} placeholder="Signer email (required — use your own to test)" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 mb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" />
                <button onClick={sendVendorContractLive} disabled={vendorSignSending || !vendorSignId || !vendorSignerEmail} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                  {vendorSignSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send for Signature
                </button>
                {vendorSignResult && (
                  <div className={`mt-3 p-3 rounded-lg text-xs ${vendorSignResult.ok ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25' : 'bg-rose-500/10 text-rose-300 border border-rose-500/25'}`}>
                    {vendorSignResult.ok ? `Envelope sent — ID ${vendorSignResult.envelopeId} (status: ${vendorSignResult.status})` : (vendorSignResult.message || vendorSignResult.error)}
                  </div>
                )}
              </div>

              {/* LEASE AUTO-SCAN */}
              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl lg:col-span-2">
                <h3 className="font-semibold text-white text-sm mb-1 flex items-center gap-2"><ScanLine size={15} className="text-indigo-400" /> Auto-Scan a Lease Document</h3>
                <p className="text-xs text-slate-400 mb-3">Upload a photo or PDF page of a (fake) lease. Workers AI reads it and pulls out tenant/unit/parking details for you to review before saving — nothing is saved automatically.</p>
                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                  <input type="file" accept="image/*,application/pdf" onChange={handleScanFileChange} className="flex-1 text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-800 file:text-slate-200 file:text-xs" />
                  <button onClick={runLeaseScan} disabled={!scanFile || scanning} className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shrink-0">
                    {scanning ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Scan
                  </button>
                </div>
                {scanResult && !scanResult.ok && (
                  <div className="p-3 rounded-lg text-xs bg-rose-500/10 text-rose-300 border border-rose-500/25 mb-3">{scanResult.message || scanResult.error}</div>
                )}
                {scanFields && (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                    <p className="text-xs text-amber-300 flex items-center gap-1.5"><AlertCircle size={13} /> Auto-extracted — check every field against the real document before saving.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div><label className="text-[11px] text-slate-500 block mb-1">Tenant Name</label><input value={scanFields.tenantName || ''} onChange={(e) => setScanFields((f) => ({ ...f, tenantName: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200" /></div>
                      <div><label className="text-[11px] text-slate-500 block mb-1">Unit Number</label><input value={scanFields.unitNumber || ''} onChange={(e) => setScanFields((f) => ({ ...f, unitNumber: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200" /></div>
                      <div><label className="text-[11px] text-slate-500 block mb-1">Parking Spot</label><input value={scanFields.parkingSpot || ''} onChange={(e) => setScanFields((f) => ({ ...f, parkingSpot: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200" /></div>
                      <div><label className="text-[11px] text-slate-500 block mb-1">Monthly Rent</label><input type="number" value={scanFields.monthlyRent || ''} onChange={(e) => setScanFields((f) => ({ ...f, monthlyRent: Number(e.target.value) }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200" /></div>
                      <div><label className="text-[11px] text-slate-500 block mb-1">Lease End Date</label><input value={scanFields.leaseEndDate || ''} onChange={(e) => setScanFields((f) => ({ ...f, leaseEndDate: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200" /></div>
                      <div><label className="text-[11px] text-slate-500 block mb-1">Owner/Business (commercial)</label><input value={scanFields.ownerOrBusinessName || ''} onChange={(e) => setScanFields((f) => ({ ...f, ownerOrBusinessName: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200" /></div>
                    </div>
                    <button onClick={saveScannedTenant} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                      <CheckCircle2 size={15} /> Save to Sandbox Database
                    </button>
                    {scanSaveResult && (
                      <div className={`p-2.5 rounded-lg text-xs ${scanSaveResult.ok ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25' : 'bg-rose-500/10 text-rose-300 border border-rose-500/25'}`}>
                        {scanSaveResult.ok ? `Saved to D1 as unit ${scanSaveResult.unitId}` : (scanSaveResult.message || scanSaveResult.error)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* FINANCIAL SUMMARY — NOI/cash flow, excludes depreciation & taxable income by design */}
              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl lg:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-white text-sm flex items-center gap-2"><CircleDollarSign size={15} className="text-indigo-400" /> Financial Summary</h3>
                  <button onClick={refreshFinancialsSummary} disabled={financialsLoading} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-50">
                    <RefreshCw size={13} className={financialsLoading ? 'animate-spin' : ''} /> Refresh
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-3">NOI and cash flow for {current.label.split(' (')[0]}. Deliberately excludes depreciation and taxable-income math — talk to a tax professional for those.</p>
                {financialsError && (
                  <div className="p-3 rounded-lg text-xs bg-rose-500/10 text-rose-300 border border-rose-500/25 mb-3">{financialsError}</div>
                )}
                {financialsSummary && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <p className="text-[11px] text-slate-500">Gross Scheduled Rent</p>
                      <p className="text-sm font-semibold text-white mt-1">${financialsSummary.grossScheduledRent?.toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <p className="text-[11px] text-slate-500">Total OpEx</p>
                      <p className="text-sm font-semibold text-white mt-1">${financialsSummary.totalOpex?.toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                      <p className="text-[11px] text-emerald-300/80">NOI</p>
                      <p className="text-sm font-semibold text-emerald-300 mt-1">${financialsSummary.noi?.toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <p className="text-[11px] text-slate-500">Monthly Debt Service</p>
                      <p className="text-sm font-semibold text-white mt-1">${financialsSummary.monthlyDebtService?.toLocaleString()}</p>
                    </div>
                    <div className={`p-3 rounded-xl border ${financialsSummary.cashFlowBeforeCapex >= 0 ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-rose-500/10 border-rose-500/25'}`}>
                      <p className={`text-[11px] ${financialsSummary.cashFlowBeforeCapex >= 0 ? 'text-emerald-300/80' : 'text-rose-300/80'}`}>Cash Flow (pre-CapEx)</p>
                      <p className={`text-sm font-semibold mt-1 ${financialsSummary.cashFlowBeforeCapex >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>${financialsSummary.cashFlowBeforeCapex?.toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <p className="text-[11px] text-slate-500">CapEx Reserve Balance</p>
                      <p className="text-sm font-semibold text-white mt-1">${financialsSummary.capexReserveBalance?.toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <p className="text-[11px] text-slate-500">Deposits Held (liability)</p>
                      <p className="text-sm font-semibold text-white mt-1">${financialsSummary.depositsHeldLiability?.toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <p className="text-[11px] text-slate-500">Avg Vacancy Days</p>
                      <p className="text-sm font-semibold text-white mt-1">{financialsSummary.avgVacancyDays ?? '—'}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-4 border-t border-slate-800">
                  {/* Loan details */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-300 mb-2">Loan Details</h4>
                    <input value={loanForm.lender} onChange={(e) => setLoanForm((f) => ({ ...f, lender: e.target.value }))} placeholder="Lender" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 mb-1.5" />
                    <input type="number" value={loanForm.principalBalance} onChange={(e) => setLoanForm((f) => ({ ...f, principalBalance: e.target.value }))} placeholder="Principal balance" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 mb-1.5" />
                    <input type="number" value={loanForm.interestRate} onChange={(e) => setLoanForm((f) => ({ ...f, interestRate: e.target.value }))} placeholder="Interest rate %" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 mb-1.5" />
                    <input type="number" value={loanForm.monthlyPayment} onChange={(e) => setLoanForm((f) => ({ ...f, monthlyPayment: e.target.value }))} placeholder="Monthly P&I" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 mb-1.5" />
                    <input type="number" value={loanForm.escrowTaxMonthly} onChange={(e) => setLoanForm((f) => ({ ...f, escrowTaxMonthly: e.target.value }))} placeholder="Escrow — tax / mo" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 mb-1.5" />
                    <input type="number" value={loanForm.escrowInsuranceMonthly} onChange={(e) => setLoanForm((f) => ({ ...f, escrowInsuranceMonthly: e.target.value }))} placeholder="Escrow — insurance / mo" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 mb-2" />
                    <button onClick={saveLoan} disabled={loanSaving} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 rounded-lg text-xs font-medium">
                      {loanSaving ? 'Saving...' : 'Save Loan'}
                    </button>
                    {loanResult && <p className={`text-[11px] mt-1.5 ${loanResult.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{loanResult.ok ? 'Saved' : (loanResult.message || loanResult.error)}</p>}
                  </div>

                  {/* Log a CapEx/OpEx expense */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-300 mb-2">Log an Expense</h4>
                    <input value={expenseForm.category} onChange={(e) => setExpenseForm((f) => ({ ...f, category: e.target.value }))} placeholder="Category (e.g. roof repair)" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 mb-1.5" />
                    <select value={expenseForm.classification} onChange={(e) => setExpenseForm((f) => ({ ...f, classification: e.target.value }))} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 mb-1.5">
                      <option value="opex">OpEx (operating)</option>
                      <option value="capex">CapEx (capital)</option>
                    </select>
                    <input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Amount" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 mb-1.5" />
                    <input value={expenseForm.description} onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 mb-2" />
                    <button onClick={saveExpense} disabled={expenseSaving || !expenseForm.category || !expenseForm.amount} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 rounded-lg text-xs font-medium">
                      {expenseSaving ? 'Saving...' : 'Log Expense'}
                    </button>
                    {expenseResult && <p className={`text-[11px] mt-1.5 ${expenseResult.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{expenseResult.ok ? 'Logged' : (expenseResult.message || expenseResult.error)}</p>}

                    <h4 className="text-xs font-semibold text-slate-300 mb-2 mt-4">CapEx Reserve Contribution</h4>
                    <div className="flex gap-1.5">
                      <input type="number" value={reserveAmount} onChange={(e) => setReserveAmount(e.target.value)} placeholder="Amount" className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200" />
                      <button onClick={contributeToReserve} disabled={reserveSaving || !reserveAmount} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 rounded-lg text-xs font-medium shrink-0">Add</button>
                    </div>
                    {reserveResult && <p className={`text-[11px] mt-1.5 ${reserveResult.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{reserveResult.ok ? 'Added to reserve' : (reserveResult.message || reserveResult.error)}</p>}
                  </div>

                  {/* Deposits held */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-300 mb-2">Record a Held Deposit</h4>
                    <select value={depositUnitId} onChange={(e) => setDepositUnitId(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 mb-1.5">
                      <option value="">Select {current.unitLabel.toLowerCase()}...</option>
                      {current.unitLedger.map((u) => (<option key={u.id} value={u.id}>{current.unitLabel} {u.id} — {u.tenant}</option>))}
                    </select>
                    <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="Amount held" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 mb-2" />
                    <button onClick={saveDeposit} disabled={depositSaving || !depositUnitId || !depositAmount} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 rounded-lg text-xs font-medium">
                      {depositSaving ? 'Saving...' : 'Record Deposit'}
                    </button>
                    {depositResult && <p className={`text-[11px] mt-1.5 ${depositResult.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{depositResult.ok ? 'Recorded (held as liability)' : (depositResult.message || depositResult.error)}</p>}
                    <p className="text-[11px] text-slate-500 mt-2">Held deposits are tracked as a liability, never counted as revenue. Closing out a deposit at move-out (return vs. withhold) is available via the API (<code className="bg-slate-900/60 px-1 rounded">/api/deposits/close</code>) — a UI for that can be added once you're handling real move-outs.</p>
                  </div>
                </div>
              </div>

              {/* SMS DIAGNOSTIC TRIAGE */}
              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl lg:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-white text-sm flex items-center gap-2"><MessageSquare size={15} className="text-indigo-400" /> SMS Diagnostic Triage</h3>
                  <button onClick={refreshConversations} disabled={conversationsLoading} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-50">
                    <RefreshCw size={13} className={conversationsLoading ? 'animate-spin' : ''} /> Refresh
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-3">When a tenant texts your Twilio number with a complaint, this asks one clarifying question (e.g. "AC is broken" → thermostat dial vs. the unit itself) before a maintenance ticket is created — all over SMS, no extra vendor needed. Point your Twilio number's "A message comes in" webhook at <code className="bg-slate-950/60 px-1.5 py-0.5 rounded text-[11px]">{API_BASE || '<your-worker-url>'}/api/sms/webhook</code> to turn this on.</p>
                {(!smsConversations || smsConversations.length === 0) ? (
                  <p className="text-xs text-slate-500">{smsConversations ? 'No SMS conversations yet — text your Twilio number to try it.' : 'Click Refresh to load recent diagnostic conversations.'}</p>
                ) : (
                  <div className="space-y-2">
                    {smsConversations.slice(0, 8).map((c) => (
                      <div key={c.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                        <div className="flex items-center justify-between">
                          <p className="text-slate-200 font-medium">{c.phone_number}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${c.status === 'closed' ? 'bg-emerald-500/10 text-emerald-300' : c.status === 'expired' ? 'bg-slate-700 text-slate-400' : 'bg-amber-500/10 text-amber-300'}`}>{c.status}</span>
                        </div>
                        <p className="text-slate-400 mt-1">Reported: "{c.initial_complaint}"</p>
                        {c.clarifying_question && <p className="text-slate-500 mt-0.5">Asked: "{c.clarifying_question}"</p>}
                        {c.clarifying_answer && <p className="text-slate-500 mt-0.5">Answer: "{c.clarifying_answer}"</p>}
                        {c.resulting_maintenance_id && <p className="text-indigo-400 mt-0.5">→ Maintenance ticket {c.resulting_maintenance_id}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          </FadeIn>
        )}
      </main>
    </div>
  );
}
