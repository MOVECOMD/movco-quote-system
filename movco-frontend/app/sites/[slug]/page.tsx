import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function PublicSitePage({ params }: { params: { slug: string } }) {
  const { data: website } = await supabase
    .from('company_websites')
    .select('*, companies(name, email, phone)')
    .eq('slug', params.slug)
    .eq('published', true)
    .maybeSingle()

  if (!website) return notFound()

  const companyId = website.company_id

  // ═══════════════════════════════════════
  // CUSTOM HTML MODE — inject company_id
  // ═══════════════════════════════════════
  const customHtml = (website as any).custom_html
  if (customHtml) {
    // Inject company_id so forms/booking know which CRM to write to
    const injectedHtml = customHtml.replace(
      '</body>',
      `<script>window.__COMPANY_ID__ = '${companyId}';</script></body>`
    )

    return (
      <html>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body style={{ margin: 0, padding: 0 }}>
          <div dangerouslySetInnerHTML={{ __html: injectedHtml }} />
        </body>
      </html>
    ) as any
  }

  // ═══════════════════════════════════════
  // BLOCK-BASED MODE
  // ═══════════════════════════════════════
  const company = (website as any).companies
  const blocks: any[] = website.blocks || []
  const theme: any = website.theme || {}

  const primaryColor = theme.primary_color || '#0a0f1c'
  const accentColor = theme.accent_color || '#0F6E56'
  const fontFamily = theme.font_family || 'system-ui, sans-serif'

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{company?.name || 'Welcome'}</title>
        <meta name="description" content={`Professional services by ${company?.name}`} />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: ${fontFamily}; color: #1a1a1a; }
          .btn-primary { background: ${accentColor}; color: #fff; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; border: none; cursor: pointer; display: inline-block; text-decoration: none; }
          .btn-primary:hover { opacity: 0.9; }
          .btn-outline { background: transparent; color: ${accentColor}; padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; border: 2px solid ${accentColor}; cursor: pointer; display: inline-block; text-decoration: none; }
          .container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
          .section { padding: 72px 0; }
          .section-alt { background: #f8f8f8; }
          h2 { font-size: 36px; font-weight: 700; margin-bottom: 16px; }
          h3 { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
          p { line-height: 1.7; color: #555; font-size: 16px; }
          .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; margin-top: 40px; }
          .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 32px; margin-top: 40px; }
          .card { background: #fff; border-radius: 12px; padding: 28px; border: 1px solid #eee; }
          .stars { color: #f59e0b; font-size: 18px; margin-bottom: 8px; }
          input, textarea, select { width: 100%; padding: 12px 16px; border: 1px solid #ddd; border-radius: 8px; font-size: 15px; font-family: inherit; }
          textarea { resize: vertical; min-height: 100px; }
          label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #333; }
          .form-group { margin-bottom: 16px; }
          nav { background: ${primaryColor}; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
          nav .logo { color: #fff; font-size: 20px; font-weight: 700; }
          nav .nav-links { display: flex; gap: 24px; }
          nav .nav-links a { color: rgba(255,255,255,0.8); text-decoration: none; font-size: 15px; }
          .gallery-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 32px; }
          .gallery-img { width: 100%; height: 200px; object-fit: cover; border-radius: 8px; background: #eee; }
          .coverage-list { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
          .coverage-pill { background: #f0f9f4; color: ${accentColor}; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: 500; border: 1px solid ${accentColor}30; }
          footer { background: ${primaryColor}; color: rgba(255,255,255,0.7); padding: 40px 24px; text-align: center; font-size: 14px; }
          .form-success { background: #d4edda; color: #155724; padding: 16px; border-radius: 8px; text-align: center; display: none; margin-top: 16px; }
          .form-error { background: #f8d7da; color: #721c24; padding: 16px; border-radius: 8px; text-align: center; display: none; margin-top: 16px; }
          @media (max-width: 640px) { h2 { font-size: 28px; } .section { padding: 48px 0; } }
        `}</style>
      </head>
      <body>
        <nav>
          <span className="logo">{company?.name || 'Welcome'}</span>
          <div className="nav-links">
            <a href="#services">Services</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </div>
        </nav>

        {blocks.map((block: any, idx: number) => (
          <BlockRenderer
            key={idx}
            block={block}
            company={company}
            companyId={companyId}
            accentColor={accentColor}
            primaryColor={primaryColor}
          />
        ))}

        <footer>
          <div className="container">
            <p style={{ marginBottom: '8px', fontWeight: 600, color: '#fff' }}>{company?.name}</p>
            {company?.phone && <p>{company.phone}</p>}
            {company?.email && <p>{company.email}</p>}
            <p style={{ marginTop: '16px', fontSize: '12px' }}>
              Powered by BYM · {new Date().getFullYear()}
            </p>
          </div>
        </footer>

        {/* Inject company_id for any client-side JS */}
        <script dangerouslySetInnerHTML={{ __html: `window.__COMPANY_ID__ = '${companyId}';` }} />

        {/* Form submission handler for block-based sites */}
        <script dangerouslySetInnerHTML={{ __html: `
          document.addEventListener('submit', async function(e) {
            var form = e.target;
            if (!form.matches || !form.matches('form[data-crm-form]')) return;
            e.preventDefault();

            var btn = form.querySelector('button[type="submit"]');
            var successEl = form.parentElement.querySelector('.form-success');
            var errorEl = form.parentElement.querySelector('.form-error');
            var origText = btn.textContent;
            btn.textContent = 'Submitting...'; btn.disabled = true;
            if (successEl) successEl.style.display = 'none';
            if (errorEl) errorEl.style.display = 'none';

            var formType = form.dataset.formType || 'enquiry';
            var fd = new FormData(form);
            var payload = {
              company_id: window.__COMPANY_ID__,
              first_name: fd.get('name') ? fd.get('name').toString().split(' ')[0] : '',
              last_name: fd.get('name') ? fd.get('name').toString().split(' ').slice(1).join(' ') : '',
              email: fd.get('email') || '',
              phone: fd.get('phone') || '',
              message: fd.get('message') || '',
              source: formType === 'quote' ? 'Website Quote Form' : 'Website Contact Form',
            };
            if (fd.get('moving_from')) payload.moving_from = fd.get('moving_from');
            if (fd.get('moving_to')) payload.moving_to = fd.get('moving_to');
            if (fd.get('moving_date')) payload.moving_date = fd.get('moving_date');

            try {
              var res = await fetch('/api/website/enquiry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              if (!res.ok) throw new Error('Failed');
              form.reset();
              if (successEl) { successEl.style.display = 'block'; successEl.textContent = 'Thank you! We will be in touch shortly.'; }
            } catch(err) {
              if (errorEl) { errorEl.style.display = 'block'; errorEl.textContent = 'Sorry, something went wrong. Please try again or call us directly.'; }
            } finally {
              btn.textContent = origText; btn.disabled = false;
            }
          });
        `}} />
      </body>
    </html>
  )
}

function BlockRenderer({ block, company, companyId, accentColor, primaryColor }: any) {
  switch (block.type) {
    case 'hero':
      return (
        <section style={{ background: primaryColor, color: '#fff', padding: '100px 24px', textAlign: 'center' }}>
          <div className="container">
            <h1 style={{ fontSize: '52px', fontWeight: 800, marginBottom: '20px', color: '#fff', lineHeight: 1.2 }}>
              {block.headline || 'Professional Services'}
            </h1>
            <p style={{ fontSize: '20px', color: 'rgba(255,255,255,0.8)', marginBottom: '40px', maxWidth: '600px', margin: '0 auto 40px' }}>
              {block.subheadline || 'Trusted, reliable services'}
            </p>
            <a href="#quote" className="btn-primary" style={{ fontSize: '18px', padding: '16px 40px' }}>
              {block.cta_text || 'Get a Free Quote'}
            </a>
          </div>
        </section>
      )
    case 'services':
      return (
        <section className="section" id="services">
          <div className="container">
            <h2>{block.title || 'Our Services'}</h2>
            <p>{block.subtitle || ''}</p>
            <div className="grid-3">
              {(block.services || []).map((svc: any, i: number) => (
                <div className="card" key={i}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: accentColor + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                    <svg width="24" height="24" fill="none" stroke={accentColor} strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3>{svc.title}</h3>
                  <p style={{ marginTop: '8px' }}>{svc.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    case 'quote_form':
      return (
        <section className="section section-alt" id="quote">
          <div className="container">
            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
              <h2 style={{ textAlign: 'center' }}>{block.title || 'Get Your Free Quote'}</h2>
              <p style={{ textAlign: 'center', marginBottom: '40px' }}>
                {block.subtitle || "Fill in your details and we'll get back to you quickly"}
              </p>
              <div className="card">
                <form data-crm-form="true" data-form-type="quote">
                  <div className="grid-2" style={{ marginTop: 0 }}>
                    <div className="form-group">
                      <label>Your name</label>
                      <input name="name" placeholder="John Smith" required />
                    </div>
                    <div className="form-group">
                      <label>Phone number</label>
                      <input name="phone" placeholder="07700 900000" required />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Email address</label>
                    <input name="email" type="email" placeholder="john@example.com" required />
                  </div>
                  <div className="grid-2" style={{ marginTop: 0 }}>
                    <div className="form-group">
                      <label>Moving from</label>
                      <input name="moving_from" placeholder="Current postcode" />
                    </div>
                    <div className="form-group">
                      <label>Moving to</label>
                      <input name="moving_to" placeholder="New postcode" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Preferred date</label>
                    <input name="moving_date" type="date" />
                  </div>
                  <div className="form-group">
                    <label>Anything else we should know?</label>
                    <textarea name="message" placeholder="e.g. special items, access restrictions..." />
                  </div>
                  <button type="submit" className="btn-primary" style={{ width: '100%', fontSize: '16px', padding: '16px' }}>
                    {block.button_text || 'Request My Free Quote'}
                  </button>
                </form>
                <div className="form-success"></div>
                <div className="form-error"></div>
              </div>
            </div>
          </div>
        </section>
      )
    case 'about':
      return (
        <section className="section" id="about">
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
              <div>
                <h2>{block.title || `About ${company?.name || 'Us'}`}</h2>
                <p style={{ marginTop: '16px', marginBottom: '24px' }}>
                  {block.body || 'We are a trusted company with years of experience.'}
                </p>
                {block.highlights && block.highlights.map((h: string, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="12" height="12" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span style={{ fontSize: '15px', color: '#333' }}>{h}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: '#f0f0f0', borderRadius: '16px', height: '360px', overflow: 'hidden' }}>
                {block.image
                  ? <img src={block.image} alt="About us" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: '14px' }}>Add a photo in editor</div>
                }
              </div>
            </div>
          </div>
        </section>
      )
    case 'reviews':
      return (
        <section className="section section-alt">
          <div className="container">
            <h2 style={{ textAlign: 'center' }}>{block.title || 'What Our Customers Say'}</h2>
            <p style={{ textAlign: 'center' }}>{block.subtitle || ''}</p>
            <div className="grid-3">
              {(block.reviews || []).map((review: any, i: number) => (
                <div className="card" key={i}>
                  <div className="stars">{'★'.repeat(review.rating || 5)}</div>
                  <p style={{ marginBottom: '16px', fontStyle: 'italic' }}>"{review.text}"</p>
                  <p style={{ fontWeight: 600, color: '#333', fontSize: '14px' }}>— {review.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    case 'coverage':
      return (
        <section className="section">
          <div className="container">
            <h2>{block.title || 'Areas We Cover'}</h2>
            <p>{block.subtitle || ''}</p>
            <div className="coverage-list">
              {(block.areas || []).map((area: string, i: number) => (
                <span className="coverage-pill" key={i}>{area}</span>
              ))}
            </div>
          </div>
        </section>
      )
    case 'contact':
      return (
        <section className="section section-alt" id="contact">
          <div className="container">
            <div style={{ maxWidth: '560px', margin: '0 auto' }}>
              <h2 style={{ textAlign: 'center' }}>{block.title || 'Get In Touch'}</h2>
              <p style={{ textAlign: 'center', marginBottom: '32px' }}>
                {block.subtitle || "Have a question? We'd love to hear from you"}
              </p>
              <div className="card">
                <form data-crm-form="true" data-form-type="contact">
                  <div className="form-group">
                    <label>Name</label>
                    <input name="name" placeholder="Your name" required />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input name="email" type="email" placeholder="your@email.com" required />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input name="phone" placeholder="07700 900000" />
                  </div>
                  <div className="form-group">
                    <label>Message</label>
                    <textarea name="message" placeholder="How can we help?" required />
                  </div>
                  <button type="submit" className="btn-primary" style={{ width: '100%' }}>Send Message</button>
                </form>
                <div className="form-success"></div>
                <div className="form-error"></div>
              </div>
              <div style={{ marginTop: '32px', display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {company?.phone && (
                  <a href={`tel:${company.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: accentColor, textDecoration: 'none', fontWeight: 600 }}>
                    📞 {company.phone}
                  </a>
                )}
                {company?.email && (
                  <a href={`mailto:${company.email}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: accentColor, textDecoration: 'none', fontWeight: 600 }}>
                    ✉️ {company.email}
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      )
    case 'gallery':
      return (
        <section className="section">
          <div className="container">
            <h2>{block.title || 'Our Work'}</h2>
            <p>{block.subtitle || ''}</p>
            <div className="gallery-grid">
              {(block.images || []).map((url: string, i: number) => (
                <img key={i} src={url} alt={`Gallery ${i + 1}`} className="gallery-img" />
              ))}
              {(!block.images || block.images.length === 0) && (
                <p style={{ color: '#aaa', fontSize: '14px' }}>Add images in the editor</p>
              )}
            </div>
          </div>
        </section>
      )
    default:
      return null
  }
}
