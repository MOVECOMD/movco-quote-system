// app/company-dashboard/import/page.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  IMPORT_FIELDS, validateRows, parseDate, cleanPhone, cleanCurrency,
  type ImportType, type ValidationResult,
} from '@/lib/importValidators';

/* ─── Types ──────────────────────────────────────────────── */

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  type: 'text' | 'email' | 'phone' | 'date' | 'number' | 'postcode';
}

interface State {
  step: Step;
  importType: ImportType;
  file: File | null;
  fileName: string;
  headers: string[];
  previewRows: Record<string, string>[];
  totalRows: number;
  allRows: Record<string, string>[];
  columnMapping: Record<string, string>;
  validation: ValidationResult | null;
  progress: { total: number; done: number; ok: number; fail: number };
  importErrors: any[];
  companyId: string | null;
  templateType: string | null;
  aiMapping: boolean;
  aiConfidence: string | null;
  duplicateMode: 'skip' | 'update' | 'both';
}

const INIT: State = {
  step: 'upload', importType: 'customers', file: null, fileName: '',
  headers: [], previewRows: [], totalRows: 0, allRows: [],
  columnMapping: {}, validation: null,
  progress: { total: 0, done: 0, ok: 0, fail: 0 },
  importErrors: [], companyId: null, templateType: null,
  aiMapping: false, aiConfidence: null, duplicateMode: 'update',
};

/* ─── Component ──────────────────────────────────────────── */

export default function ImportPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [s, setS] = useState<State>(INIT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const up = useCallback((p: Partial<State>) => setS(prev => ({ ...prev, ...p })), []);

  // Auth guard + load company
  useEffect(() => {
    if (!authLoading && !user) router.push('/auth');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    supabase.from('companies').select('id, template_type').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data) up({ companyId: data.id, templateType: data.template_type || 'removals' });
      });
  }, [user, up]);

  /* ─── File parsing (CSV + Excel) ─────────────────────── */

  const handleFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['csv', 'xlsx', 'xls', 'tsv'].includes(ext)) {
      setError('Please upload a CSV or Excel file (.csv, .xlsx, .xls)'); return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File must be under 10MB'); return;
    }
    setError(null);
    setLoading(true);

    try {
      let headers: string[] = [];
      let rows: Record<string, string>[] = [];

      if (ext === 'csv' || ext === 'tsv') {
        const text = await file.text();
        const parsed = csvParse(text, ext === 'tsv' ? '\t' : ',');
        headers = parsed.headers;
        rows = parsed.rows;
      } else {
        // Excel — load SheetJS dynamically
        const XLSX = await loadSheetJS();
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (jsonData.length < 2) {
          setError('Excel file appears empty'); setLoading(false); return;
        }

        headers = jsonData[0].map((h: any) => String(h).trim()).filter(Boolean);
        rows = jsonData.slice(1).filter((r: any[]) => r.some((c: any) => String(c).trim())).map((r: any[]) => {
          const row: Record<string, string> = {};
          headers.forEach((h, i) => { row[h] = String(r[i] ?? '').trim(); });
          return row;
        });
      }

      if (headers.length === 0 || rows.length === 0) {
        setError('File appears empty or has no data rows'); setLoading(false); return;
      }

      up({
        file, fileName: file.name, headers,
        previewRows: rows.slice(0, 5), totalRows: rows.length, allRows: rows,
        columnMapping: {}, step: 'mapping',
      });

      // Trigger AI mapping
      await runAiMapping(headers, rows.slice(0, 3), s.importType, s.templateType);
    } catch (err: any) {
      setError('Failed to parse file: ' + (err.message || 'Unknown error'));
    }
    setLoading(false);
  };

  /* ─── AI Column Mapping ──────────────────────────────── */

  const runAiMapping = async (
    headers: string[],
    sampleRows: Record<string, string>[],
    importType: ImportType,
    templateType: string | null,
  ) => {
    up({ aiMapping: true, aiConfidence: null });
    try {
      const res = await fetch('/api/import/ai-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers, sampleRows, importType, templateType }),
      });
      if (res.ok) {
        const { mapping, confidence } = await res.json();
        up({ columnMapping: mapping, aiConfidence: confidence, aiMapping: false });
      } else {
        // Fallback to basic synonym matching
        const { autoMatchColumns } = await import('@/lib/importValidators');
        const fallback = autoMatchColumns(headers, importType);
        up({ columnMapping: fallback, aiConfidence: 'fallback', aiMapping: false });
      }
    } catch {
      const { autoMatchColumns } = await import('@/lib/importValidators');
      const fallback = autoMatchColumns(headers, importType);
      up({ columnMapping: fallback, aiConfidence: 'fallback', aiMapping: false });
    }
  };

  /* ─── Validate + Preview ─────────────────────────────── */

  const handlePreview = () => {
    setError(null);
    const result = validateRows(s.allRows, s.columnMapping, s.importType);
    up({ validation: result, step: 'preview' });
  };

  /* ─── Import ─────────────────────────────────────────── */

  const handleImport = async () => {
    if (!s.companyId || !s.validation) return;
    setLoading(true); setError(null);

    const rows = s.validation.validRows;
    up({ step: 'importing', progress: { total: rows.length, done: 0, ok: 0, fail: 0 } });

    let ok = 0, fail = 0;
    const errs: any[] = [];
    const BATCH = 5;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(row => insertRow(s.companyId!, s.importType, row, s.duplicateMode))
      );
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === 'fulfilled') ok++;
        else {
          fail++;
          errs.push({ row: i + j + 2, error: (results[j] as PromiseRejectedResult).reason?.message || 'Insert failed' });
        }
      }
      up({ progress: { total: rows.length, done: Math.min(i + BATCH, rows.length), ok, fail } });
    }

    // Log import
    await supabase.from('crm_import_jobs').insert({
      company_id: s.companyId,
      file_name: s.fileName,
      import_type: s.importType,
      status: 'complete',
      row_count: rows.length,
      success_count: ok,
      error_count: fail,
      error_log: errs,
      column_mapping: s.columnMapping,
    });

    up({
      step: 'complete', importErrors: errs,
      progress: { total: rows.length, done: rows.length, ok, fail },
    });
    setLoading(false);
  };

  /* ─── Insert row ─────────────────────────────────────── */

  async function insertRow(companyId: string, type: ImportType, row: Record<string, any>, dupMode: string) {
    switch (type) {
      case 'customers': {
        if (row.email && dupMode !== 'both') {
          const { data: existing } = await supabase.from('crm_customers')
            .select('id').eq('company_id', companyId).eq('email', row.email).maybeSingle();
          if (existing) {
            if (dupMode === 'skip') return;
            await supabase.from('crm_customers').update({
              name: row.name, phone: row.phone || undefined,
              address: row.address || undefined,
              moving_from: row.moving_from || undefined,
              moving_to: row.moving_to || undefined,
              moving_date: row.moving_date || undefined,
              updated_at: new Date().toISOString(),
            }).eq('id', existing.id);
            return;
          }
        }
        const { error } = await supabase.from('crm_customers').insert({
          company_id: companyId, name: row.name,
          email: row.email || null, phone: row.phone || null,
          address: row.address || null, source: row.source || 'import',
          moving_from: row.moving_from || null, moving_to: row.moving_to || null,
          moving_date: row.moving_date || null, notes: row.notes || null,
        });
        if (error) throw new Error(error.message);
        break;
      }
      case 'quotes': {
        const { error } = await supabase.from('crm_quotes').insert({
          company_id: companyId,
          customer_name: row.customer_name,
          customer_email: row.customer_email || null,
          customer_phone: row.customer_phone || null,
          moving_from: row.moving_from || null,
          moving_to: row.moving_to || null,
          moving_date: row.moving_date || null,
          estimated_price: row.estimated_price || null,
          status: mapQuoteStatus(row.status),
          notes: row.notes || null,
          items: [], total_volume_m3: 0, van_count: 1, movers: 2,
        });
        if (error) throw new Error(error.message);
        break;
      }
      case 'jobs': {
        let startIso = row.job_date + 'T09:00:00';
        if (row.start_time) {
          const timePart = row.start_time.includes(':') ? row.start_time : '09:00';
          startIso = row.job_date + 'T' + timePart + ':00';
        }
        const endIso = new Date(new Date(startIso).getTime() + 4 * 3600000).toISOString();
        const { error } = await supabase.from('crm_diary_events').insert({
          company_id: companyId,
          title: `Job — ${row.customer_name}`,
          event_type: 'job',
          start_time: new Date(startIso).toISOString(),
          end_time: endIso,
          customer_name: row.customer_name,
          location: row.location || null,
          description: [
            row.moving_to ? `To: ${row.moving_to}` : '',
            row.estimated_value ? `Value: £${row.estimated_value}` : '',
            row.notes || '',
          ].filter(Boolean).join('\n') || null,
          color: '#3B82F6', completed: false,
        });
        if (error) throw new Error(error.message);
        break;
      }
      case 'leads': {
        const { error } = await supabase.from('crm_customers').insert({
          company_id: companyId, name: row.name,
          email: row.email || null, phone: row.phone || null,
          source: 'import-lead',
          moving_from: row.moving_from || null, moving_to: row.moving_to || null,
          moving_date: row.moving_date || null, notes: row.notes || null,
        });
        if (error) throw new Error(error.message);
        break;
      }
    }
  }

  function mapQuoteStatus(status?: string): string {
    if (!status) return 'draft';
    const s = status.toLowerCase().trim();
    if (['won', 'accepted', 'confirmed', 'booked'].includes(s)) return 'accepted';
    if (['lost', 'declined', 'rejected', 'cancelled'].includes(s)) return 'declined';
    if (['sent', 'pending', 'quoted', 'awaiting'].includes(s)) return 'sent';
    return 'draft';
  }

  /* ─── Render helpers ─────────────────────────────────── */

  if (authLoading || !user) return null;

  const fields = IMPORT_FIELDS[s.importType];
  const mapped = new Set(Object.values(s.columnMapping));
  const reqOk = fields.filter(f => f.required).every(f => mapped.has(f.key));
  const nc = s.importType === 'customers' || s.importType === 'leads';
  const contactOk = !nc || mapped.has('email') || mapped.has('phone');
  const canProceed = reqOk && contactOk;

  const allSteps: Step[] = ['upload', 'mapping', 'preview', 'importing', 'complete'];
  const stepLabels = ['Upload', 'Map Columns', 'Preview', 'Import', 'Done'];
  const stepIdx = allSteps.indexOf(s.step);

  const typeOptions: { key: ImportType; label: string; desc: string; icon: string }[] = [
    { key: 'customers', label: 'Customers', desc: 'Names, emails, phones, addresses', icon: '👥' },
    { key: 'quotes', label: 'Quotes', desc: 'Quotes with pricing', icon: '📋' },
    { key: 'jobs', label: 'Jobs / Diary', desc: 'Booked jobs with dates', icon: '📅' },
    { key: 'leads', label: 'Leads', desc: 'Enquiries and contacts', icon: '🎯' },
  ];

  /* ─── JSX ──────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 md:px-8 py-5 flex items-center gap-4">
        <button onClick={() => router.push('/company-dashboard')}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import Data</h1>
          <p className="text-sm text-gray-500 mt-0.5">AI-powered data import — CSV & Excel supported</p>
        </div>
      </div>

      {/* Steps */}
      <div className="px-4 md:px-8 pt-6">
        <div className="flex items-center gap-2 mb-6 max-w-4xl mx-auto">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                i < stepIdx ? 'bg-green-500 text-white' : i === stepIdx ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>{i < stepIdx ? '✓' : i + 1}</div>
              <span className={`text-sm font-medium hidden sm:block ${
                i === stepIdx ? 'text-blue-600' : i < stepIdx ? 'text-green-600' : 'text-gray-400'
              }`}>{label}</span>
              {i < stepLabels.length - 1 && <div className={`flex-1 h-0.5 ${i < stepIdx ? 'bg-green-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 md:px-8 pb-12 max-w-4xl mx-auto">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2">
            <span>⚠️</span> {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* ═══════ STEP 1: UPLOAD ═══════ */}
        {s.step === 'upload' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-bold text-gray-900 mb-4">What are you importing?</h2>
              <div className="grid grid-cols-2 gap-3">
                {typeOptions.map(t => (
                  <button key={t.key} onClick={() => up({ importType: t.key })}
                    className={`p-4 rounded-xl text-left transition-all ${
                      s.importType === t.key
                        ? 'border-2 border-blue-600 bg-blue-50'
                        : 'border-2 border-gray-200 hover:border-gray-300'
                    }`}>
                    <span className="text-2xl">{t.icon}</span>
                    <p className="font-semibold text-gray-900 mt-2">{t.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-bold text-gray-900 mb-4">Upload your file</h2>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.tsv"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                className="hidden" />
              <div onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400', 'bg-blue-50'); }}
                onDragLeave={e => { e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50'); }}
                onDrop={e => {
                  e.preventDefault(); e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
                  const f = e.dataTransfer.files[0];
                  if (f) handleFile(f);
                }}
                className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all">
                {loading ? (
                  <div className="text-gray-500">
                    <svg className="animate-spin h-8 w-8 mx-auto mb-3 text-blue-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p className="font-medium">Parsing file & running AI mapping...</p>
                  </div>
                ) : (
                  <>
                    <div className="text-4xl mb-3">📁</div>
                    <p className="font-semibold text-gray-800">Click to upload or drag and drop</p>
                    <p className="text-sm text-gray-500 mt-1">CSV, Excel (.xlsx, .xls) or TSV — up to 10MB</p>
                  </>
                )}
              </div>
              <div className="mt-4 bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
                <strong className="text-gray-700">Tip:</strong> Export from your current system as CSV or Excel. First row should be column headers. Our AI will automatically match your columns — no manual mapping needed in most cases.
              </div>
            </div>
          </div>
        )}

        {/* ═══════ STEP 2: MAPPING ═══════ */}
        {s.step === 'mapping' && (
          <div className="space-y-6">
            {/* File info */}
            <div className="bg-white rounded-xl border p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{s.fileName.endsWith('.csv') ? '📄' : '📊'}</span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{s.fileName}</p>
                  <p className="text-xs text-gray-500">{s.totalRows.toLocaleString()} rows · {s.headers.length} columns</p>
                </div>
              </div>
              <button onClick={() => up({ ...INIT, companyId: s.companyId, templateType: s.templateType })}
                className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 transition">
                Change file
              </button>
            </div>

            {/* AI status */}
            {s.aiMapping && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
                <svg className="animate-spin h-5 w-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-blue-800">AI is analysing your columns...</p>
                  <p className="text-xs text-blue-600">Looking at headers and sample data to find the best match</p>
                </div>
              </div>
            )}

            {s.aiConfidence === 'ai' && !s.aiMapping && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                <span className="text-lg">🤖</span>
                <div>
                  <p className="text-sm font-semibold text-green-800">AI mapped your columns automatically</p>
                  <p className="text-xs text-green-600">Review below and adjust any mappings that don't look right</p>
                </div>
                <button onClick={() => runAiMapping(s.headers, s.previewRows.slice(0, 3), s.importType, s.templateType)}
                  className="ml-auto text-xs text-green-700 hover:text-green-900 px-3 py-1.5 bg-green-100 rounded-lg hover:bg-green-200 transition">
                  Re-run AI
                </button>
              </div>
            )}

            {s.aiConfidence === 'fallback' && !s.aiMapping && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
                <span className="text-lg">⚡</span>
                <div>
                  <p className="text-sm font-semibold text-yellow-800">Using basic column matching</p>
                  <p className="text-xs text-yellow-600">AI mapping unavailable — matched by column name similarity. Please check below.</p>
                </div>
              </div>
            )}

            {/* Column mapping */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-bold text-gray-900">Column Mapping</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Match your file columns to CRM fields</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {Object.keys(s.columnMapping).length}/{fields.length} mapped
                  </span>
                  <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${Math.round((Object.keys(s.columnMapping).length / fields.length) * 100)}%` }} />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {fields.map(field => {
                  const matchedHeader = Object.entries(s.columnMapping).find(([_, v]) => v === field.key)?.[0] || '';
                  return (
                    <div key={field.key} className="flex items-center gap-3">
                      <div className="w-40 flex-shrink-0">
                        <span className="text-sm font-medium text-gray-800">{field.label}</span>
                        {field.required && <span className="text-red-500 ml-1 text-xs">*</span>}
                      </div>
                      <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <select value={matchedHeader} onChange={e => {
                        const nm = { ...s.columnMapping };
                        // Remove existing mapping for this field
                        for (const [k, v] of Object.entries(nm)) { if (v === field.key) delete nm[k]; }
                        if (e.target.value) nm[e.target.value] = field.key;
                        up({ columnMapping: nm });
                      }} className={`flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
                        matchedHeader ? 'bg-blue-50 border-blue-200 text-blue-700' : 'text-gray-500'
                      }`}>
                        <option value="">— Skip —</option>
                        {s.headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <span className="w-40 text-xs text-gray-400 truncate flex-shrink-0">
                        {matchedHeader && s.previewRows[0]?.[matchedHeader]
                          ? `e.g. "${s.previewRows[0][matchedHeader]}"`
                          : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Unmapped columns from the file */}
            {(() => {
              const unmapped = s.headers.filter(h => !s.columnMapping[h]);
              if (unmapped.length === 0) return null;
              return (
                <div className="bg-white rounded-xl border p-6">
                  <h3 className="font-semibold text-gray-700 text-sm mb-3">Unmapped columns (will be ignored)</h3>
                  <div className="flex flex-wrap gap-2">
                    {unmapped.map(h => (
                      <span key={h} className="px-3 py-1.5 bg-gray-100 text-gray-500 text-xs rounded-lg">{h}</span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Duplicate handling */}
            {(s.importType === 'customers' || s.importType === 'leads') && (
              <div className="bg-white rounded-xl border p-6">
                <h3 className="font-semibold text-gray-900 text-sm mb-3">Duplicate handling</h3>
                <p className="text-xs text-gray-500 mb-3">When a row matches an existing customer (same email):</p>
                <div className="flex gap-3">
                  {([
                    { key: 'update' as const, label: 'Update existing', desc: 'Merge new data into existing record' },
                    { key: 'skip' as const, label: 'Skip duplicates', desc: 'Keep existing, ignore new' },
                    { key: 'both' as const, label: 'Create new', desc: 'Always create a new record' },
                  ]).map(opt => (
                    <button key={opt.key} onClick={() => up({ duplicateMode: opt.key })}
                      className={`flex-1 p-3 rounded-lg text-left text-sm transition ${
                        s.duplicateMode === opt.key
                          ? 'border-2 border-blue-600 bg-blue-50'
                          : 'border-2 border-gray-200 hover:border-gray-300'
                      }`}>
                      <p className="font-medium text-gray-800">{opt.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Preview table */}
            {s.previewRows.length > 0 && (
              <div className="bg-white rounded-xl border p-6 overflow-x-auto">
                <h3 className="font-semibold text-gray-900 text-sm mb-3">Preview (first 5 rows)</h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr>{s.headers.map(h => (
                      <th key={h} className={`px-3 py-2 text-left border-b-2 whitespace-nowrap font-semibold ${
                        s.columnMapping[h] ? 'text-blue-600 border-blue-200' : 'text-gray-400 border-gray-200'
                      }`}>
                        {h}
                        {s.columnMapping[h] && (
                          <span className="block text-[10px] font-normal text-gray-500">
                            → {fields.find(f => f.key === s.columnMapping[h])?.label}
                          </span>
                        )}
                      </th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {s.previewRows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {s.headers.map(h => (
                          <td key={h} className="px-3 py-2 border-b border-gray-100 text-gray-600 max-w-[180px] truncate">
                            {row[h] || <span className="text-gray-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button onClick={() => up({ ...INIT, companyId: s.companyId, templateType: s.templateType })}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition text-sm">
                ← Back
              </button>
              <div className="flex items-center gap-3">
                {!reqOk && <span className="text-xs text-red-500">Map required fields (*)</span>}
                {!contactOk && <span className="text-xs text-red-500">Map email or phone</span>}
                <button onClick={handlePreview} disabled={!canProceed || s.aiMapping}
                  className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition ${
                    canProceed && !s.aiMapping
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/25'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}>
                  Validate & Preview →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ STEP 3: PREVIEW ═══════ */}
        {s.step === 'preview' && s.validation && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-bold text-gray-900 mb-4">Validation Results</h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{s.validation.validRows.length}</p>
                  <p className="text-xs text-green-700 mt-1">Ready to import</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-red-500">{s.validation.skippedRows}</p>
                  <p className="text-xs text-red-600 mt-1">Will be skipped</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-600">{s.totalRows}</p>
                  <p className="text-xs text-gray-500 mt-1">Total rows</p>
                </div>
              </div>

              {s.validation.errors.length > 0 && (
                <div className="bg-red-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                  <h4 className="font-semibold text-red-700 text-xs mb-2">{s.validation.errors.length} issues found</h4>
                  {s.validation.errors.slice(0, 30).map((e, i) => (
                    <p key={i} className="text-xs text-red-600 font-mono py-0.5">Row {e.row}: {e.field} — {e.error} {e.value ? `("${e.value}")` : ''}</p>
                  ))}
                  {s.validation.errors.length > 30 && (
                    <p className="text-xs text-red-700 font-semibold mt-1">...and {s.validation.errors.length - 30} more</p>
                  )}
                </div>
              )}
            </div>

            {/* Sample of valid rows */}
            {s.validation.validRows.length > 0 && (
              <div className="bg-white rounded-xl border p-6 overflow-x-auto">
                <h3 className="font-semibold text-gray-900 text-sm mb-3">
                  Sample of valid data (first 5 of {s.validation.validRows.length})
                </h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      {fields.filter(f => mapped.has(f.key)).map(f => (
                        <th key={f.key} className="px-3 py-2 text-left border-b-2 border-blue-200 text-blue-600 font-semibold whitespace-nowrap">
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.validation.validRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {fields.filter(f => mapped.has(f.key)).map(f => (
                          <td key={f.key} className="px-3 py-2 border-b border-gray-100 text-gray-700 max-w-[200px] truncate">
                            {row[f.key] || <span className="text-gray-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button onClick={() => up({ step: 'mapping', validation: null })}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition text-sm">
                ← Adjust mapping
              </button>
              <button onClick={handleImport}
                disabled={s.validation.validRows.length === 0}
                className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition ${
                  s.validation.validRows.length > 0
                    ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-500/25'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}>
                Import {s.validation.validRows.length} rows →
              </button>
            </div>
          </div>
        )}

        {/* ═══════ STEP 4: IMPORTING ═══════ */}
        {s.step === 'importing' && (
          <div className="bg-white rounded-xl border p-12 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse shadow-xl">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Importing your data...</h2>
            <p className="text-sm text-gray-500 mb-8">Please keep this page open.</p>
            <div className="w-full max-w-md mx-auto mb-6">
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${s.progress.total > 0 ? Math.round((s.progress.done / s.progress.total) * 100) : 0}%` }} />
              </div>
            </div>
            <p className="text-3xl font-bold text-blue-600 mb-6 font-mono">
              {s.progress.total > 0 ? Math.round((s.progress.done / s.progress.total) * 100) : 0}%
            </p>
            <div className="flex justify-center gap-10">
              <div>
                <p className="text-2xl font-bold text-green-600 font-mono">{s.progress.ok}</p>
                <p className="text-xs text-gray-500">Imported</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-500 font-mono">{s.progress.fail}</p>
                <p className="text-xs text-gray-500">Errors</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-400 font-mono">{s.progress.total - s.progress.done}</p>
                <p className="text-xs text-gray-500">Remaining</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ STEP 5: COMPLETE ═══════ */}
        {s.step === 'complete' && (
          <div className="bg-white rounded-xl border p-12 text-center">
            <div className="text-5xl mb-4">{s.progress.fail === 0 ? '✅' : '⚠️'}</div>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Import Complete</h2>
            <div className="flex justify-center gap-12 mb-8 py-5 border-y border-gray-100">
              <div>
                <p className="text-3xl font-bold text-green-600 font-mono">{s.progress.ok}</p>
                <p className="text-sm text-gray-500">
                  {{ customers: 'customers', quotes: 'quotes', jobs: 'jobs', leads: 'leads' }[s.importType]} imported
                </p>
              </div>
              {s.progress.fail > 0 && (
                <div>
                  <p className="text-3xl font-bold text-red-500 font-mono">{s.progress.fail}</p>
                  <p className="text-sm text-gray-500">rows skipped</p>
                </div>
              )}
            </div>
            {s.importErrors.length > 0 && (
              <div className="text-left bg-red-50 rounded-xl p-5 mb-6 max-h-48 overflow-y-auto">
                <h4 className="font-semibold text-red-700 text-xs mb-2">Error details</h4>
                {s.importErrors.slice(0, 30).map((e, i) => (
                  <p key={i} className="text-xs text-red-600 font-mono py-0.5">Row {e.row}: {e.error}</p>
                ))}
              </div>
            )}
            <div className="flex justify-center gap-3">
              <button onClick={() => setS({ ...INIT, companyId: s.companyId, templateType: s.templateType })}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition text-sm">
                Import more data
              </button>
              <button onClick={() => router.push('/company-dashboard')}
                className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition text-sm shadow-lg shadow-blue-500/25">
                Back to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── SheetJS loader (CDN) ───────────────────────────────── */

let sheetJSLoaded: any = null;

function loadSheetJS(): Promise<any> {
  if (sheetJSLoaded) return Promise.resolve(sheetJSLoaded);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
    script.onload = () => {
      sheetJSLoaded = (window as any).XLSX;
      resolve(sheetJSLoaded);
    };
    script.onerror = () => reject(new Error('Failed to load Excel parser'));
    document.head.appendChild(script);
  });
}

/* ─── CSV Parser ─────────────────────────────────────────── */

function csvParse(text: string, delim = ','): { headers: string[]; rows: Record<string, string>[] } {
  const lines: string[] = [];
  let cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { inQ = !inQ; cur += c; }
    else if ((c === '\n' || c === '\r') && !inQ) {
      if (cur.trim()) lines.push(cur);
      cur = '';
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else cur += c;
  }
  if (cur.trim()) lines.push(cur);
  if (!lines.length) return { headers: [], rows: [] };

  const pl = (l: string) => {
    const r: string[] = [];
    let c = '', q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') { if (q && l[i + 1] === '"') { c += '"'; i++; } else q = !q; }
      else if (ch === delim && !q) { r.push(c.trim()); c = ''; }
      else c += ch;
    }
    r.push(c.trim());
    return r;
  };

  const headers = pl(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const v = pl(lines[i]);
    if (v.every(x => !x)) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, j) => { row[h] = v[j] || ''; });
    rows.push(row);
  }
  return { headers, rows };
}