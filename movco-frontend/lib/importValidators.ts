// lib/importValidators.ts

export type ImportType = 'customers' | 'quotes' | 'jobs' | 'leads';

export interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  type: 'text' | 'email' | 'phone' | 'date' | 'number' | 'postcode';
  synonyms: string[];
}

export interface ValidationError {
  row: number;
  field: string;
  value: string;
  error: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  validRows: Record<string, any>[];
  skippedRows: number;
}

// ─── Fields matching YOUR existing Supabase tables ──────────

export const IMPORT_FIELDS: Record<ImportType, FieldDef[]> = {
  // → inserts into crm_customers
  customers: [
    { key: 'name', label: 'Name', required: true, type: 'text',
      synonyms: ['name','customer','customer name','full name','client','contact','contact name'] },
    { key: 'email', label: 'Email', required: false, type: 'email',
      synonyms: ['email','email address','e-mail','mail'] },
    { key: 'phone', label: 'Phone', required: false, type: 'phone',
      synonyms: ['phone','telephone','tel','mobile','mob','phone number','contact number','cell'] },
    { key: 'address', label: 'Address', required: false, type: 'text',
      synonyms: ['address','full address','street','home address'] },
    { key: 'moving_from', label: 'Moving From', required: false, type: 'text',
      synonyms: ['moving from','from','from address','current address','origin'] },
    { key: 'moving_to', label: 'Moving To', required: false, type: 'text',
      synonyms: ['moving to','to','to address','new address','destination'] },
    { key: 'moving_date', label: 'Moving Date', required: false, type: 'date',
      synonyms: ['moving date','move date','date'] },
    { key: 'source', label: 'Source', required: false, type: 'text',
      synonyms: ['source','lead source','origin','channel','referral','how found'] },
    { key: 'notes', label: 'Notes', required: false, type: 'text',
      synonyms: ['notes','comments','memo','remarks','description','info'] },
  ],

  // → inserts into crm_quotes
  quotes: [
    { key: 'customer_name', label: 'Customer Name', required: true, type: 'text',
      synonyms: ['customer','customer name','client','name','contact'] },
    { key: 'customer_email', label: 'Email', required: false, type: 'email',
      synonyms: ['email','customer email','e-mail'] },
    { key: 'customer_phone', label: 'Phone', required: false, type: 'phone',
      synonyms: ['phone','tel','mobile','customer phone'] },
    { key: 'moving_from', label: 'Moving From', required: false, type: 'text',
      synonyms: ['from','from address','pickup','collection','moving from','current address'] },
    { key: 'moving_to', label: 'Moving To', required: false, type: 'text',
      synonyms: ['to','to address','delivery','destination','moving to','new address'] },
    { key: 'moving_date', label: 'Move Date', required: false, type: 'date',
      synonyms: ['date','move date','moving date','job date'] },
    { key: 'estimated_price', label: 'Price (£)', required: false, type: 'number',
      synonyms: ['price','quote','amount','total','cost','value','estimate','fee'] },
    { key: 'status', label: 'Status', required: false, type: 'text',
      synonyms: ['status','state','stage'] },
    { key: 'notes', label: 'Notes', required: false, type: 'text',
      synonyms: ['notes','comments','details','remarks'] },
  ],

  // → inserts into crm_diary_events (event_type: 'job') + optionally crm_deals
  jobs: [
    { key: 'customer_name', label: 'Customer Name', required: true, type: 'text',
      synonyms: ['customer','customer name','client','name'] },
    { key: 'job_date', label: 'Job Date', required: true, type: 'date',
      synonyms: ['date','job date','move date','moving date','booked date'] },
    { key: 'start_time', label: 'Start Time', required: false, type: 'text',
      synonyms: ['start time','time','start','arrival'] },
    { key: 'location', label: 'Location / From', required: false, type: 'text',
      synonyms: ['from','from address','pickup','location','address','collection'] },
    { key: 'moving_to', label: 'Moving To', required: false, type: 'text',
      synonyms: ['to','to address','delivery','destination','moving to'] },
    { key: 'estimated_value', label: 'Value (£)', required: false, type: 'number',
      synonyms: ['value','price','quote','amount','total','cost'] },
    { key: 'notes', label: 'Notes', required: false, type: 'text',
      synonyms: ['notes','comments','details','description'] },
  ],

  // → inserts into removals_leads
  leads: [
    { key: 'name', label: 'Name', required: true, type: 'text',
      synonyms: ['name','customer','lead name','contact','full name'] },
    { key: 'email', label: 'Email', required: false, type: 'email',
      synonyms: ['email','e-mail','email address'] },
    { key: 'phone', label: 'Phone', required: false, type: 'phone',
      synonyms: ['phone','tel','mobile','telephone'] },
    { key: 'moving_from', label: 'Moving From', required: false, type: 'text',
      synonyms: ['from','from address','current address','origin'] },
    { key: 'moving_to', label: 'Moving To', required: false, type: 'text',
      synonyms: ['to','to address','new address','destination'] },
    { key: 'moving_date', label: 'Move Date', required: false, type: 'date',
      synonyms: ['date','move date','moving date'] },
    { key: 'notes', label: 'Notes', required: false, type: 'text',
      synonyms: ['notes','comments','message','details'] },
  ],
};

// ─── Auto-match CSV headers to our fields ───────────────────

export function autoMatchColumns(
  csvHeaders: string[],
  importType: ImportType
): Record<string, string> {
  const fields = IMPORT_FIELDS[importType];
  const mapping: Record<string, string> = {};
  const used = new Set<string>();

  for (const field of fields) {
    const norm = csvHeaders.map(h => h.toLowerCase().trim());
    // Exact synonym match first
    let idx = norm.findIndex((h, i) => !used.has(csvHeaders[i]) && field.synonyms.includes(h));
    // Partial match fallback
    if (idx === -1) {
      idx = norm.findIndex((h, i) =>
        !used.has(csvHeaders[i]) && field.synonyms.some(s => h.includes(s) || s.includes(h))
      );
    }
    if (idx !== -1) {
      mapping[csvHeaders[idx]] = field.key;
      used.add(csvHeaders[idx]);
    }
  }
  return mapping;
}

// ─── Validators ─────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

function validateField(value: string, type: FieldDef['type']): string | null {
  if (!value || !value.trim()) return null;
  const v = value.trim();
  switch (type) {
    case 'email': return EMAIL_RE.test(v) ? null : 'Invalid email';
    case 'phone': {
      const c = v.replace(/[\s\-\(\)]/g, '');
      return c.length >= 10 && c.length <= 14 ? null : 'Invalid phone';
    }
    case 'postcode': return POSTCODE_RE.test(v) ? null : 'Invalid UK postcode';
    case 'number': return isNaN(parseFloat(v.replace(/[£$,]/g, ''))) ? 'Must be a number' : null;
    case 'date': return parseDate(v) ? null : 'Invalid date (use DD/MM/YYYY)';
    default: return null;
  }
}

export function parseDate(value: string): Date | null {
  if (!value) return null;
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) { const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
  const m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let yr = parseInt(m[3]); if (yr < 100) yr += 2000;
    const d = new Date(yr, parseInt(m[2]) - 1, parseInt(m[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export function cleanPhone(phone: string): string {
  if (!phone) return '';
  let c = phone.replace(/[\s\-\(\)]/g, '');
  if (c.startsWith('+44')) c = '0' + c.slice(3);
  if (c.startsWith('44') && c.length > 11) c = '0' + c.slice(2);
  return c;
}

export function cleanCurrency(value: string): number | null {
  if (!value) return null;
  const n = parseFloat(value.replace(/[£$€,\s]/g, ''));
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

// ─── Validate all rows ──────────────────────────────────────

export function validateRows(
  rows: Record<string, any>[],
  columnMapping: Record<string, string>,
  importType: ImportType
): ValidationResult {
  const fields = IMPORT_FIELDS[importType];
  const errors: ValidationError[] = [];
  const validRows: Record<string, any>[] = [];

  const reverse: Record<string, string> = {};
  for (const [col, field] of Object.entries(columnMapping)) reverse[field] = col;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const mapped: Record<string, any> = {};
    let ok = true;

    for (const field of fields) {
      const col = reverse[field.key];
      const raw = col ? (row[col] || '').toString().trim() : '';

      if (field.required && !raw) {
        errors.push({ row: rowNum, field: field.label, value: '', error: `${field.label} is required` });
        ok = false; continue;
      }
      if (raw) {
        const err = validateField(raw, field.type);
        if (err) { errors.push({ row: rowNum, field: field.label, value: raw, error: err }); ok = false; continue; }

        switch (field.type) {
          case 'phone': mapped[field.key] = cleanPhone(raw); break;
          case 'number': mapped[field.key] = cleanCurrency(raw); break;
          case 'date': { const d = parseDate(raw); mapped[field.key] = d ? d.toISOString().split('T')[0] : raw; break; }
          case 'postcode': mapped[field.key] = raw.toUpperCase().replace(/\s+/g, ' ').trim(); break;
          default: mapped[field.key] = raw;
        }
      }
    }

    // Customers & leads need email or phone
    if ((importType === 'customers' || importType === 'leads') && !mapped.email && !mapped.phone) {
      errors.push({ row: rowNum, field: 'Contact', value: '', error: 'Email or phone required' });
      ok = false;
    }

    if (ok) validRows.push(mapped);
  }

  return { valid: errors.length === 0, errors, validRows, skippedRows: rows.length - validRows.length };
}
