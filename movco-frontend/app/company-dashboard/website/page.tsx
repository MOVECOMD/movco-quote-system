'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import AiAssistant from '@/components/AiAssistant'
import { renderSiteHtml } from '../../../lib/renderSiteHtml'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const COMPANY_ID = 'd83a643c-4f72-4df5-9618-7fe23db7bc01'

const BLOCK_TYPES = [
  { type: 'hero', label: 'Hero section', icon: '⚡', description: 'Headline, subheadline and CTA button' },
  { type: 'services', label: 'Services', icon: '🚛', description: 'List your removal services' },
  { type: 'quote_form', label: 'Quote form', icon: '📋', description: 'Lead capture form feeds into CRM' },
  { type: 'about', label: 'About us', icon: '👥', description: 'Company story and highlights' },
  { type: 'reviews', label: 'Reviews', icon: '⭐', description: 'Customer testimonials' },
  { type: 'coverage', label: 'Coverage areas', icon: '📍', description: 'Areas you serve' },
  { type: 'contact', label: 'Contact', icon: '✉️', description: 'Contact form and details' },
  { type: 'gallery', label: 'Gallery', icon: '🖼️', description: 'Photo gallery' },
  { type: 'custom', label: 'Custom Section', icon: '🧩', description: 'Custom HTML section' },
]

const TEMPLATES = [
  {
    name: 'Clean & Professional',
    description: 'Simple, trust-focused layout',
    blocks: [
      { type: 'hero', headline: 'Your Trusted Removal Company', subheadline: 'Professional, reliable and affordable removals across the UK', cta_text: 'Get a Free Quote' },
      { type: 'services', title: 'Our Services', services: [{ title: 'House Removals', description: 'Full house moves handled with care and professionalism' }, { title: 'Packing Service', description: 'We pack everything safely so nothing gets damaged' }, { title: 'Storage Solutions', description: 'Secure short and long-term storage available' }] },
      { type: 'reviews', title: 'Happy Customers', reviews: [{ name: 'Sarah M.', text: 'Absolutely brilliant service. So professional and careful.', rating: 5 }, { name: 'James T.', text: 'Fast, efficient and great value for money.', rating: 5 }, { name: 'Emma L.', text: 'Third time using them. Would not use anyone else!', rating: 5 }] },
      { type: 'quote_form', title: 'Get Your Free Quote', subtitle: "Fill in your details and we'll be in touch quickly" },
      { type: 'contact', title: 'Get In Touch' },
    ]
  },
  {
    name: 'Lead Generation',
    description: 'Quote form front and centre',
    blocks: [
      { type: 'hero', headline: 'Moving? Get a Free Quote Today', subheadline: 'Trusted removal services — competitive prices, professional team', cta_text: 'Get My Free Quote' },
      { type: 'quote_form', title: 'Free No-Obligation Quote', subtitle: 'Takes less than 2 minutes' },
      { type: 'services', title: 'What We Offer', services: [{ title: 'Local Moves', description: 'Moving within your town or city' }, { title: 'Long Distance', description: 'Nationwide removal service' }, { title: 'Office Moves', description: 'Business and office relocations' }] },
      { type: 'coverage', title: 'Where We Operate', areas: ['London', 'Bristol', 'Bath', 'Cardiff', 'Reading', 'Oxford'] },
      { type: 'reviews', title: 'Trusted by Hundreds' },
    ]
  },
  {
    name: 'Full Showcase',
    description: 'All blocks — complete website',
    blocks: [
      { type: 'hero', headline: 'Professional Removal Services', subheadline: 'Making your move as stress-free as possible', cta_text: 'Get a Free Quote' },
      { type: 'services', title: 'Our Services' },
      { type: 'about', title: 'About Us', body: 'We are a trusted removal company with years of experience. Our professional team handles every move with the utmost care and efficiency.', highlights: ['Fully insured', 'Free quotes', 'No hidden charges', 'Weekend moves available'] },
      { type: 'reviews', title: 'What Customers Say' },
      { type: 'coverage', title: 'Areas We Cover', areas: ['London', 'Bristol', 'Bath', 'Cardiff', 'Birmingham'] },
      { type: 'quote_form', title: 'Get a Free Quote' },
      { type: 'gallery', title: 'Our Work' },
      { type: 'contact', title: 'Contact Us' },
    ]
  }
]

type Block = { type: string; [key: string]: any }

export default function WebsiteEditorPage() {
  const [step, setStep] = useState<'template' | 'editor'>('template')
  const [blocks, setBlocks] = useState<Block[]>([])
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null)
  const [slug, setSlug] = useState('')
  const [published, setPublished] = useState(false)
  const [customDomain, setCustomDomain] = useState('')
  const [theme, setTheme] = useState({ primary_color: '#0a0f1c', accent_color: '#0F6E56' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [company, setCompany] = useState<any>(null)
  const [editorMode, setEditorMode] = useState<'blocks' | 'html'>('blocks')
  const [customHtml, setCustomHtml] = useState('')
  const [renderedHtml, setRenderedHtml] = useState('')
const [showMediaModal, setShowMediaModal] = useState(false)
const [mediaFiles, setMediaFiles] = useState<any[]>([])
const [mediaLoading, setMediaLoading] = useState(false)
const [mediaCallback, setMediaCallback] = useState<((url: string) => void) | null>(null)
const [importing, setImporting] = useState(false)

  useEffect(() => {
    loadExisting()
  }, [])
  // Auto-render blocks to HTML whenever blocks or theme change
  useEffect(() => {
    if (blocks.length > 0) {
      const html = renderSiteHtml(blocks, theme, company || {})
      setRenderedHtml(html)
    }
  }, [blocks, theme, company])
async function importHtmlToBlocks() {
    if (!customHtml) return alert('No custom HTML to import')
    if (!confirm('This will analyse your custom HTML and convert it into editable blocks. Your original HTML will be kept as a backup. Continue?')) return

    setImporting(true)
    try {
      const res = await fetch('/api/website/import-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_html: customHtml }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)
      if (!data.blocks || data.blocks.length === 0) throw new Error('No blocks were extracted')

      setBlocks(data.blocks)
      setEditorMode('blocks')
      setSelectedBlock(0)
      alert(`Successfully imported ${data.blocks.length} blocks! Click each block to edit it. Save when you are happy.`)
    } catch (err: any) {
      alert('Import failed: ' + err.message)
    }
    setImporting(false)
  }
  async function loadExisting() {
    setLoading(true)
    const { data: comp } = await supabase
      .from('companies')
      .select('name, email, phone')
      .eq('id', COMPANY_ID)
      .maybeSingle()
    setCompany(comp)

    const res = await fetch(`/api/website/save?company_id=${COMPANY_ID}`)
    const data = await res.json()
    if (data.website) {
      setBlocks(data.website.blocks || [])
      setSlug(data.website.slug || '')
      setPublished(data.website.published || false)
      setCustomDomain(data.website.custom_domain || '')
      setTheme(data.website.theme || { primary_color: '#0a0f1c', accent_color: '#0F6E56' })
      if (data.website.custom_html) {
        setCustomHtml(data.website.custom_html)
        setEditorMode('html')
      }
      setStep('editor')
    }
    setLoading(false)
  }

  function pickTemplate(template: typeof TEMPLATES[0]) {
    setBlocks(template.blocks)
    const defaultSlug = (company?.name || 'my-company').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    setSlug(defaultSlug)
    setStep('editor')
  }

  async function save(publish?: boolean) {
    if (!slug.trim()) return alert('Please set a URL slug for your site')
    setSaving(true)
    const shouldPublish = publish !== undefined ? publish : published
    const res = await fetch('/api/website/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: COMPANY_ID,
        slug: slug.trim().toLowerCase(),
        blocks,
        theme,
        published: shouldPublish,
        custom_domain: customDomain || null,
        custom_html: editorMode === 'html' ? customHtml : '[FROM_BLOCKS]',
      }),
    })
    const data = await res.json()
    if (data.success) {
      if (publish !== undefined) setPublished(publish)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } else {
      alert('Save failed: ' + data.error)
    }
    setSaving(false)
  }

  function addBlock(type: string) {
    const defaults: Record<string, any> = {
      hero: { headline: 'Professional Removals', subheadline: 'Trusted, reliable removal services', cta_text: 'Get a Free Quote' },
      services: { title: 'Our Services', services: [{ title: 'House Removals', description: 'Full house moves' }, { title: 'Packing', description: 'Professional packing' }] },
      quote_form: { title: 'Get a Free Quote', subtitle: 'Fill in your details below' },
      about: { title: 'About Us', body: 'Tell your company story here...', highlights: ['Fully insured', 'Free quotes'] },
      reviews: { title: 'Customer Reviews', reviews: [{ name: 'Happy Customer', text: 'Great service!', rating: 5 }] },
      coverage: { title: 'Areas We Cover', areas: ['Enter your coverage areas'] },
      contact: { title: 'Contact Us', subtitle: 'Get in touch with our team' },
      gallery: { title: 'Our Work', images: [] },
    }
    setBlocks(prev => [...prev, { type, ...defaults[type] }])
    setSelectedBlock(blocks.length)
  }

  function removeBlock(idx: number) {
    setBlocks(prev => prev.filter((_, i) => i !== idx))
    setSelectedBlock(null)
  }

  function moveBlock(idx: number, dir: 'up' | 'down') {
    const newBlocks = [...blocks]
    const target = dir === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= newBlocks.length) return
    ;[newBlocks[idx], newBlocks[target]] = [newBlocks[target], newBlocks[idx]]
    setBlocks(newBlocks)
    setSelectedBlock(target)
  }

  function updateBlock(idx: number, updates: any) {
    setBlocks(prev => prev.map((b, i) => i === idx ? { ...b, ...updates } : b))
  }

  async function openMediaLibrary(callback: (url: string) => void) {
    setMediaCallback(() => callback)
    setShowMediaModal(true)
    setMediaLoading(true)
    const { data } = await supabase
      .from('media_library')
      .select('*')
      .eq('company_id', COMPANY_ID)
      .order('created_at', { ascending: false })
      .limit(50)
    setMediaFiles(data || [])
    setMediaLoading(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ color: '#666' }}>Loading...</p>
      </div>
    )
  }

  if (step === 'template') {
    return (
      <div style={{ padding: '40px 24px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#0a0f1c', marginBottom: '8px' }}>Build your website</h1>
          <p style={{ color: '#666', fontSize: '16px' }}>Choose a starting template — you can customise everything afterwards</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          {TEMPLATES.map((tpl, i) => (
            <div key={i} onClick={() => pickTemplate(tpl)}
              style={{ border: '2px solid #e5e7eb', borderRadius: '16px', padding: '28px', cursor: 'pointer', transition: 'all 0.15s', background: '#fff' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#0F6E56'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLDivElement).style.transform = 'none' }}
            >
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#0F6E5615', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', fontSize: '24px' }}>
                {i === 0 ? '✨' : i === 1 ? '🎯' : '🏠'}
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0a0f1c', marginBottom: '6px' }}>{tpl.name}</h3>
              <p style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>{tpl.description}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {tpl.blocks.map((b, j) => (
                  <span key={j} style={{ fontSize: '11px', background: '#f3f4f6', color: '#666', padding: '3px 8px', borderRadius: '4px' }}>
                    {b.type.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button onClick={() => { setBlocks([]); setSlug(''); setStep('editor') }}
            style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}>
            Start from scratch
          </button>
        </div>
      </div>
    )
  }

  const siteUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://movco-quote-system.vercel.app'}/sites/${slug}`

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f8f9fa' }}>

      {/* Left panel */}
      <div style={{ width: '280px', flexShrink: 0, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0a0f1c' }}>Website Editor</h2>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {saved && <span style={{ fontSize: '11px', color: '#0F6E56', fontWeight: 600 }}>Saved ✓</span>}
              <button onClick={() => save()} disabled={saving} style={smallPrimaryBtn}>{saving ? '...' : 'Save'}</button>
            </div>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={smallLabel}>Site URL slug</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap' }}>/sites/</span>
              <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="your-company" style={smallInput} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', color: '#555', fontWeight: 500 }}>Published</span>
            <button onClick={() => save(!published)} style={{
              background: published ? '#0F6E56' : '#e5e7eb', color: published ? '#fff' : '#666',
              border: 'none', borderRadius: '20px', padding: '4px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer'
            }}>{published ? 'Live' : 'Draft'}</button>
          </div>
          {published && slug && (
            <a href={siteUrl} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '11px', color: '#0F6E56', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              🔗 {siteUrl}
            </a>
          )}
        </div>

        {/* Domain connection */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Custom Domain</p>
          <input
            value={customDomain}
            onChange={e => setCustomDomain(e.target.value.toLowerCase().replace(/\s/g, ''))}
            placeholder="www.yourcompany.com"
            style={{ ...smallInput, width: '100%', marginBottom: '8px', boxSizing: 'border-box' }}
          />
          {customDomain && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px', fontSize: '11px' }}>
              <p style={{ fontWeight: 700, color: '#0a0f1c', marginBottom: '6px' }}>📋 DNS Settings</p>
              <p style={{ color: '#666', marginBottom: '8px' }}>Add these records to your domain provider (GoDaddy, Namecheap, etc.):</p>
              <div style={{ background: '#f8f9fa', borderRadius: '6px', padding: '8px', fontFamily: 'monospace', fontSize: '10px' }}>
                <div style={{ marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px solid #eee' }}>
                  <span style={{ color: '#888' }}>Type: </span><strong>CNAME</strong><br />
                  <span style={{ color: '#888' }}>Name: </span><strong>www</strong><br />
                  <span style={{ color: '#888' }}>Value: </span><strong>cname.vercel-dns.com</strong><br />
                  <span style={{ color: '#888' }}>TTL: </span><strong>Auto</strong>
                </div>
                <div>
                  <span style={{ color: '#888' }}>Type: </span><strong>A</strong><br />
                  <span style={{ color: '#888' }}>Name: </span><strong>@</strong><br />
                  <span style={{ color: '#888' }}>Value: </span><strong>76.76.21.21</strong><br />
                  <span style={{ color: '#888' }}>TTL: </span><strong>Auto</strong>
                </div>
              </div>
              <p style={{ color: '#888', fontSize: '10px', marginTop: '8px', lineHeight: 1.5 }}>
                DNS changes can take up to 24-48hrs to propagate. Once done, save and your site will be live on your domain.
              </p>
              <button onClick={() => save()}
                style={{ marginTop: '8px', width: '100%', padding: '6px', borderRadius: '6px', border: 'none', background: '#0F6E56', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                Save Domain
              </button>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Theme colours</p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div>
              <label style={smallLabel}>Primary</label>
              <input type="color" value={theme.primary_color} onChange={e => setTheme(t => ({ ...t, primary_color: e.target.value }))}
                style={{ width: '48px', height: '32px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer' }} />
            </div>
            <div>
              <label style={smallLabel}>Accent</label>
              <input type="color" value={theme.accent_color} onChange={e => setTheme(t => ({ ...t, accent_color: e.target.value }))}
                style={{ width: '48px', height: '32px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer' }} />
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', paddingLeft: '4px' }}>Page blocks</p>
          {blocks.length === 0 && (
            <p style={{ fontSize: '13px', color: '#aaa', textAlign: 'center', padding: '24px 0' }}>No blocks yet — add one below</p>
          )}
          {blocks.map((block, idx) => (
            <div key={idx} onClick={() => { setSelectedBlock(selectedBlock === idx ? null : idx); setEditorMode('blocks') }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                borderRadius: '8px', marginBottom: '4px', cursor: 'pointer',
                background: selectedBlock === idx && editorMode === 'blocks' ? '#E1F5EE' : '#f8f9fa',
                border: `1px solid ${selectedBlock === idx && editorMode === 'blocks' ? '#0F6E56' : 'transparent'}`,
              }}>
              <span style={{ fontSize: '16px' }}>{BLOCK_TYPES.find(b => b.type === block.type)?.icon || '□'}</span>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#333', flex: 1 }}>
                {BLOCK_TYPES.find(b => b.type === block.type)?.label || block.type}
              </span>
              <div style={{ display: 'flex', gap: '2px' }}>
                <button onClick={e => { e.stopPropagation(); moveBlock(idx, 'up') }} style={iconBtn}>↑</button>
                <button onClick={e => { e.stopPropagation(); moveBlock(idx, 'down') }} style={iconBtn}>↓</button>
                <button onClick={e => { e.stopPropagation(); removeBlock(idx) }} style={{ ...iconBtn, color: '#e24b4a' }}>✕</button>
              </div>
            </div>
          ))}
          <div style={{ marginTop: '12px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', paddingLeft: '4px' }}>Add block</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {BLOCK_TYPES.map(bt => (
                <button key={bt.type} onClick={() => { addBlock(bt.type); setEditorMode('blocks') }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', border: '1px dashed #d1d5db', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: '#555', textAlign: 'left' }}>
                  <span style={{ fontSize: '14px' }}>{bt.icon}</span>
                  <span style={{ fontWeight: 500 }}>{bt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Middle panel — mode toggle + editor */}
      <div style={{ width: '340px', flexShrink: 0, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Mode toggle */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', flexShrink: 0 }}>
          <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: '8px', padding: '3px', gap: '3px' }}>
            <button onClick={() => setEditorMode('blocks')} style={{
              flex: 1, padding: '6px 10px', borderRadius: '6px', border: 'none',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              background: editorMode === 'blocks' ? '#fff' : 'transparent',
              color: editorMode === 'blocks' ? '#0a0f1c' : '#888',
              boxShadow: editorMode === 'blocks' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>Block editor</button>
            <button onClick={() => {
              if (editorMode === 'blocks' && blocks.length > 0 && !customHtml) {
                if (!confirm('Switch to HTML mode? Your blocks stay saved. You can switch back anytime.')) return
              }
              setEditorMode(editorMode === 'blocks' ? 'html' : 'blocks')
            }} style={{
              flex: 1, padding: '6px 10px', borderRadius: '6px', border: 'none',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              background: editorMode === 'html' ? '#fff' : 'transparent',
              color: editorMode === 'html' ? '#0a0f1c' : '#888',
              boxShadow: editorMode === 'html' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>Custom HTML</button>
          </div>
        </div>

        {/* Block editor */}
        {editorMode === 'blocks' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {selectedBlock === null ? (
              <div style={{ textAlign: 'center', padding: '60px 24px', color: '#aaa' }}>
                <p style={{ fontSize: '14px' }}>Click a block on the left to edit its content</p>
              </div>
            ) : (
              <BlockEditor block={blocks[selectedBlock]} onChange={updates => updateBlock(selectedBlock, updates)} onBrowseMedia={openMediaLibrary} />
            )}
          </div>
        )}

        {/* HTML editor */}
        {editorMode === 'html' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', gap: '12px', overflowY: 'auto' }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#0a0f1c', marginBottom: '4px' }}>Custom HTML</p>
              <p style={{ fontSize: '12px', color: '#888', lineHeight: 1.5 }}>
                Paste your full HTML here. When published, this overrides the block layout.
              </p>
            </div>
            <textarea
              value={customHtml}
              onChange={e => setCustomHtml(e.target.value)}
              placeholder={`<!DOCTYPE html>\n<html>\n<head>\n  <title>My Company</title>\n</head>\n<body>\n  <!-- Your HTML here -->\n</body>\n</html>`}
              spellCheck={false}
              style={{
                flex: 1, minHeight: '400px', padding: '12px', borderRadius: '8px',
                border: '1px solid #e5e7eb', fontSize: '12px', fontFamily: 'monospace',
                resize: 'vertical', lineHeight: 1.6, color: '#333', background: '#fafafa',
                boxSizing: 'border-box', width: '100%',
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              {customHtml && (
                <button onClick={() => { if (confirm('Clear HTML?')) setCustomHtml('') }}
                  style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #e24b4a', background: 'transparent', color: '#e24b4a', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  Clear
                </button>
              )}
              <button onClick={() => save()}
                style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: '#0F6E56', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                Save HTML
              </button>
            </div>
            <div style={{ background: '#fff8e1', border: '1px solid #fbbf24', borderRadius: '8px', padding: '12px' }}>
              <p style={{ fontSize: '11px', color: '#92400e', lineHeight: 1.5, margin: 0 }}>
                When Custom HTML is saved and published, it takes priority over blocks. Switch back to Block editor to use blocks instead.
              </p>
            </div>
            {customHtml && (
              <button
                onClick={importHtmlToBlocks}
                disabled={importing}
                style={{
                  width: '100%', padding: '10px', borderRadius: '8px', border: '2px dashed #8b5cf6',
                  background: importing ? '#f3f4f6' : '#faf5ff', color: '#7c3aed',
                  fontSize: '12px', fontWeight: 700, cursor: importing ? 'wait' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {importing ? '⏳ Analysing HTML and extracting blocks...' : '🔮 Import HTML into Editable Blocks'}
              </button>
            )}
          </div>
        )}
      </div>

      <AiAssistant />

      {/* Media Library Modal */}
      {showMediaModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '680px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: '#0a0f1c' }}>Media Library</h3>
              <button onClick={() => setShowMediaModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#888' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {mediaLoading ? (
                <p style={{ textAlign: 'center', color: '#888', padding: '40px 0' }}>Loading...</p>
              ) : mediaFiles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <p style={{ fontSize: '15px', color: '#333', marginBottom: '8px' }}>No files yet</p>
                  <p style={{ fontSize: '13px', color: '#888' }}>Upload images in the Media Library page first</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                  {mediaFiles.map(file => (
                    <div key={file.id} onClick={() => { mediaCallback && mediaCallback(file.url); setShowMediaModal(false) }}
                      style={{ cursor: 'pointer', borderRadius: '10px', overflow: 'hidden', border: '2px solid transparent', transition: 'border-color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#0F6E56'}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'}>
                      {file.type?.startsWith('image/') ? (
                        <img src={file.url} alt={file.name} style={{ width: '100%', height: '100px', objectFit: 'cover', display: 'block', background: '#f0f0f0' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100px', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>📄</div>
                      )}
                      <div style={{ padding: '6px 8px', background: '#f8f9fa' }}>
                        <p style={{ fontSize: '11px', fontWeight: 500, margin: 0, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', background: '#f8f9fa' }}>
              <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>Click any image to use it</p>
            </div>
          </div>
        </div>
      )}

      {/* Right panel — live preview (always rendered HTML) */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#e5e7eb', padding: '16px' }}>
        <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', minHeight: '100%' }}>
          {editorMode === 'html' && customHtml ? (
            <iframe srcDoc={customHtml} style={{ width: '100%', minHeight: '800px', border: 'none' }} title="HTML Preview" />
          ) : renderedHtml ? (
            <iframe srcDoc={renderedHtml} style={{ width: '100%', minHeight: '800px', border: 'none' }} title="Site Preview" />
          ) : (
            <LivePreview blocks={blocks} theme={theme} company={company} />
          )}
        </div>
      </div>
    </div>
  )
}

function BlockEditor({ block, onChange, onBrowseMedia }: { block: Block; onChange: (u: any) => void; onBrowseMedia?: (cb: (url: string) => void) => void }) {
  const label = BLOCK_TYPES.find(b => b.type === block.type)?.label || block.type
  const [htmlMode, setHtmlMode] = useState(!!block.custom_html)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0a0f1c', margin: 0 }}>Edit: {label}</h3>
        <button
          onClick={() => {
            setHtmlMode(!htmlMode)
            if (htmlMode) onChange({ custom_html: '' })
          }}
          style={{
            padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
            background: htmlMode ? '#0F6E56' : '#f0f0f0',
            color: htmlMode ? '#fff' : '#666',
            border: 'none', cursor: 'pointer',
          }}
        >
          {htmlMode ? '</> HTML Mode' : '</> Edit as HTML'}
        </button>
      </div>

      {htmlMode ? (
        <div>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
            Write custom HTML for this section. It will replace the visual editor output.
          </p>
          <textarea
            value={block.custom_html || ''}
            onChange={e => onChange({ custom_html: e.target.value })}
            placeholder={`<div class="my-custom-section">\n  <!-- Your HTML here -->\n</div>`}
            spellCheck={false}
            style={{
              width: '100%', minHeight: '300px', padding: '12px', borderRadius: '8px',
              border: '1px solid #e5e7eb', fontSize: '12px', fontFamily: 'monospace',
              resize: 'vertical', lineHeight: 1.6, color: '#333', background: '#fafafa',
              boxSizing: 'border-box',
            }}
          />
        </div>
      ) : (
        <>
      {block.type === 'hero' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field label="Headline" value={block.headline || ''} onChange={v => onChange({ headline: v })} />
          <Field label="Subheadline" value={block.subheadline || ''} onChange={v => onChange({ subheadline: v })} multiline />
          <Field label="Button text" value={block.cta_text || ''} onChange={v => onChange({ cta_text: v })} />
        </div>
      )}
      {block.type === 'services' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field label="Section title" value={block.title || ''} onChange={v => onChange({ title: v })} />
          <Field label="Subtitle" value={block.subtitle || ''} onChange={v => onChange({ subtitle: v })} />
          <p style={{ fontSize: '12px', fontWeight: 600, color: '#888', textTransform: 'uppercase' }}>Services</p>
          {(block.services || []).map((svc: any, i: number) => (
            <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px' }}>
              <Field label={`Service ${i + 1} title`} value={svc.title || ''} onChange={v => {
                const svcs = [...block.services]; svcs[i] = { ...svcs[i], title: v }; onChange({ services: svcs })
              }} />
              <Field label="Description" value={svc.description || ''} onChange={v => {
                const svcs = [...block.services]; svcs[i] = { ...svcs[i], description: v }; onChange({ services: svcs })
              }} />
              <button onClick={() => onChange({ services: block.services.filter((_: any, j: number) => j !== i) })}
                style={{ fontSize: '12px', color: '#e24b4a', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>Remove</button>
            </div>
          ))}
          <button onClick={() => onChange({ services: [...(block.services || []), { title: 'New Service', description: 'Description' }] })} style={addItemBtn}>+ Add service</button>
        </div>
      )}
      {block.type === 'quote_form' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field label="Section title" value={block.title || ''} onChange={v => onChange({ title: v })} />
          <Field label="Subtitle" value={block.subtitle || ''} onChange={v => onChange({ subtitle: v })} />
          <Field label="Button text" value={block.button_text || ''} onChange={v => onChange({ button_text: v })} placeholder="Request My Free Quote" />
        </div>
      )}
      {block.type === 'about' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field label="Title" value={block.title || ''} onChange={v => onChange({ title: v })} />
          <Field label="Body text" value={block.body || ''} onChange={v => onChange({ body: v })} multiline rows={5} />
          <p style={{ fontSize: '12px', fontWeight: 600, color: '#888', textTransform: 'uppercase' }}>Highlights</p>
          {(block.highlights || []).map((h: string, i: number) => (
            <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input value={h} onChange={e => { const hs = [...block.highlights]; hs[i] = e.target.value; onChange({ highlights: hs }) }} style={inlineInput} />
              <button onClick={() => onChange({ highlights: block.highlights.filter((_: any, j: number) => j !== i) })}
                style={{ color: '#e24b4a', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
          ))}
          <button onClick={() => onChange({ highlights: [...(block.highlights || []), 'New highlight'] })} style={addItemBtn}>+ Add highlight</button>
        </div>
      )}
      {block.type === 'reviews' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field label="Section title" value={block.title || ''} onChange={v => onChange({ title: v })} />
          <Field label="Subtitle" value={block.subtitle || ''} onChange={v => onChange({ subtitle: v })} />
          {(block.reviews || []).map((r: any, i: number) => (
            <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px' }}>
              <Field label="Customer name" value={r.name || ''} onChange={v => { const rs = [...block.reviews]; rs[i] = { ...rs[i], name: v }; onChange({ reviews: rs }) }} />
              <Field label="Review text" value={r.text || ''} onChange={v => { const rs = [...block.reviews]; rs[i] = { ...rs[i], text: v }; onChange({ reviews: rs }) }} multiline />
              <button onClick={() => onChange({ reviews: block.reviews.filter((_: any, j: number) => j !== i) })}
                style={{ fontSize: '12px', color: '#e24b4a', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>Remove</button>
            </div>
          ))}
          <button onClick={() => onChange({ reviews: [...(block.reviews || []), { name: 'Customer Name', text: 'Great service!', rating: 5 }] })} style={addItemBtn}>+ Add review</button>
        </div>
      )}
      {block.type === 'coverage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field label="Section title" value={block.title || ''} onChange={v => onChange({ title: v })} />
          <Field label="Subtitle" value={block.subtitle || ''} onChange={v => onChange({ subtitle: v })} />
          <p style={{ fontSize: '12px', fontWeight: 600, color: '#888', textTransform: 'uppercase' }}>Coverage areas</p>
          {(block.areas || []).map((area: string, i: number) => (
            <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input value={area} onChange={e => { const as2 = [...block.areas]; as2[i] = e.target.value; onChange({ areas: as2 }) }} style={inlineInput} />
              <button onClick={() => onChange({ areas: block.areas.filter((_: any, j: number) => j !== i) })}
                style={{ color: '#e24b4a', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
          ))}
          <button onClick={() => onChange({ areas: [...(block.areas || []), 'New Area'] })} style={addItemBtn}>+ Add area</button>
        </div>
      )}
      {block.type === 'contact' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field label="Section title" value={block.title || ''} onChange={v => onChange({ title: v })} />
          <Field label="Subtitle" value={block.subtitle || ''} onChange={v => onChange({ subtitle: v })} />
        </div>
      )}
      {block.type === 'gallery' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field label="Section title" value={block.title || ''} onChange={v => onChange({ title: v })} />
          <Field label="Subtitle" value={block.subtitle || ''} onChange={v => onChange({ subtitle: v })} />
          <p style={{ fontSize: '12px', color: '#888' }}>Paste image URLs below to add photos.</p>
          {(block.images || []).map((url: string, i: number) => (
            <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input value={url} onChange={e => { const imgs = [...block.images]; imgs[i] = e.target.value; onChange({ images: imgs }) }} style={inlineInput} placeholder="https://..." />
              <button onClick={() => onChange({ images: block.images.filter((_: any, j: number) => j !== i) })}
                style={{ color: '#e24b4a', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => onChange({ images: [...(block.images || []), ''] })} style={{ ...addItemBtn, flex: 1 }}>+ Add image URL</button>
            {onBrowseMedia && (
              <button onClick={() => onBrowseMedia(url => onChange({ images: [...(block.images || []), url] }))}
                style={{ ...addItemBtn, flex: 1, borderStyle: 'solid', borderColor: '#0F6E56', color: '#0F6E56', background: '#E1F5EE' }}>
                🖼️ Browse Library
              </button>
            )}

          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}

function Field({ label, value, onChange, multiline, rows, placeholder }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; rows?: number; placeholder?: string }) {
  return (
    <div>
      <label style={smallLabel}>{label}</label>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows || 3} placeholder={placeholder}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
        : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '13px', boxSizing: 'border-box' }} />
      }
    </div>
  )
}

function LivePreview({ blocks, theme, company }: { blocks: Block[]; theme: any; company: any }) {
  const primary = theme.primary_color || '#0a0f1c'
  const accent = theme.accent_color || '#0F6E56'
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '14px' }}>
      <div style={{ background: primary, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>{company?.name || 'Your Company'}</span>
        <div style={{ display: 'flex', gap: '16px' }}>
          {['Services', 'About', 'Contact'].map(l => (
            <span key={l} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>{l}</span>
          ))}
        </div>
      </div>
      {blocks.map((block, idx) => (
        <PreviewBlock key={idx} block={block} accent={accent} primary={primary} company={company} />
      ))}
      {blocks.length === 0 && (
        <div style={{ padding: '60px 24px', textAlign: 'center', color: '#aaa' }}>
          <p style={{ fontSize: '14px' }}>Add blocks from the left panel to see a preview</p>
        </div>
      )}
      <div style={{ background: primary, padding: '24px', textAlign: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>{company?.name} · Powered by MOVCO</p>
      </div>
    </div>
  )
}

function PreviewBlock({ block, accent, primary, company }: any) {
  const sectionStyle = { padding: '32px 20px' }
  const altSectionStyle = { ...sectionStyle, background: '#f8f8f8' }
  switch (block.type) {
    case 'hero':
      return (
        <div style={{ background: primary, padding: '48px 20px', textAlign: 'center' }}>
          <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 800, marginBottom: '12px', lineHeight: 1.3 }}>{block.headline || 'Professional Removals'}</h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', marginBottom: '24px' }}>{block.subheadline}</p>
          <span style={{ background: accent, color: '#fff', padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>{block.cta_text || 'Get a Free Quote'}</span>
        </div>
      )
    case 'services':
      return (
        <div style={sectionStyle}>
          <p style={{ fontWeight: 700, fontSize: '18px', marginBottom: '4px' }}>{block.title}</p>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>{block.subtitle}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            {(block.services || []).map((s: any, i: number) => (
              <div key={i} style={{ border: '1px solid #eee', borderRadius: '8px', padding: '14px' }}>
                <p style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>{s.title}</p>
                <p style={{ fontSize: '12px', color: '#666' }}>{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      )
    case 'quote_form':
      return (
        <div style={altSectionStyle}>
          <p style={{ fontWeight: 700, fontSize: '18px', marginBottom: '4px', textAlign: 'center' }}>{block.title}</p>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px', textAlign: 'center' }}>{block.subtitle}</p>
          <div style={{ background: '#fff', borderRadius: '10px', padding: '20px', border: '1px solid #eee' }}>
            {['Your name', 'Email', 'Moving from', 'Moving to'].map(f => (
              <div key={f} style={{ marginBottom: '10px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: '#555' }}>{f}</p>
                <div style={{ height: '32px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fafafa' }} />
              </div>
            ))}
            <div style={{ background: accent, color: '#fff', textAlign: 'center', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>
              {block.button_text || 'Request My Free Quote'}
            </div>
          </div>
        </div>
      )
    case 'about':
      return (
        <div style={sectionStyle}>
          <p style={{ fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>{block.title}</p>
          <p style={{ fontSize: '13px', color: '#555', marginBottom: '12px', lineHeight: 1.6 }}>{block.body}</p>
          {(block.highlights || []).map((h: string, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: accent, flexShrink: 0 }} />
              <span style={{ fontSize: '13px', color: '#333' }}>{h}</span>
            </div>
          ))}
        </div>
      )
    case 'reviews':
      return (
        <div style={altSectionStyle}>
          <p style={{ fontWeight: 700, fontSize: '18px', marginBottom: '16px', textAlign: 'center' }}>{block.title}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            {(block.reviews || []).slice(0, 3).map((r: any, i: number) => (
              <div key={i} style={{ background: '#fff', borderRadius: '8px', padding: '14px', border: '1px solid #eee' }}>
                <p style={{ color: '#f59e0b', fontSize: '14px', marginBottom: '6px' }}>★★★★★</p>
                <p style={{ fontSize: '12px', color: '#555', fontStyle: 'italic', marginBottom: '8px' }}>"{r.text}"</p>
                <p style={{ fontSize: '11px', fontWeight: 600 }}>— {r.name}</p>
              </div>
            ))}
          </div>
        </div>
      )
    case 'coverage':
      return (
        <div style={sectionStyle}>
          <p style={{ fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>{block.title}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
            {(block.areas || []).map((a: string, i: number) => (
              <span key={i} style={{ background: accent + '18', color: accent, padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 500 }}>{a}</span>
            ))}
          </div>
        </div>
      )
    case 'contact':
      return (
        <div style={altSectionStyle}>
          <p style={{ fontWeight: 700, fontSize: '18px', marginBottom: '4px', textAlign: 'center' }}>{block.title}</p>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px', textAlign: 'center' }}>{block.subtitle}</p>
          <div style={{ background: '#fff', borderRadius: '10px', padding: '20px', border: '1px solid #eee' }}>
            {['Name', 'Email', 'Message'].map(f => (
              <div key={f} style={{ marginBottom: '10px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: '#555' }}>{f}</p>
                <div style={{ height: f === 'Message' ? '60px' : '32px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fafafa' }} />
              </div>
            ))}
            <div style={{ background: accent, color: '#fff', textAlign: 'center', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>Send Message</div>
          </div>
        </div>
      )
    case 'gallery':
      return (
        <div style={sectionStyle}>
          <p style={{ fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>{block.title}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '12px' }}>
            {(block.images || []).slice(0, 6).map((url: string, i: number) => (
              <img key={i} src={url} alt="" style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px', background: '#eee' }} />
            ))}
            {(!block.images || block.images.length === 0) && (
              <div style={{ gridColumn: '1/-1', background: '#f0f0f0', borderRadius: '8px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: '12px', color: '#aaa' }}>Add image URLs in editor</p>
              </div>
            )}
          </div>
        </div>
      )
    default:
      return null
  }
}

const smallLabel: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 600, color: '#888', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.3px' }
const smallInput: React.CSSProperties = { flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '12px', outline: 'none' }
const inlineInput: React.CSSProperties = { flex: 1, padding: '7px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none' }
const smallPrimaryBtn: React.CSSProperties = { background: '#0F6E56', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }
const iconBtn: React.CSSProperties = { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#888', padding: '2px 4px', borderRadius: '4px' }
const addItemBtn: React.CSSProperties = { background: 'transparent', border: '1px dashed #d1d5db', borderRadius: '6px', padding: '8px', fontSize: '12px', color: '#666', cursor: 'pointer', width: '100%' }

// AI Assistant — available on website editor page
function WebsiteAiAssistant() {
  return <AiAssistant />
}

export { WebsiteAiAssistant }