import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function PublicBookingPage({ params }: { params: { slug: string } }) {
  // Find the event type across all companies
  const { data: configs } = await supabase
    .from('company_config')
    .select('company_id, custom_event_types')
    .not('custom_event_types', 'is', null)

  let companyId: string | null = null
  let eventType: any = null

  for (const cfg of (configs || [])) {
    const types = cfg.custom_event_types || []
    const found = types.find((t: any) => t.slug === params.slug && t.bookable)
    if (found) {
      companyId = cfg.company_id
      eventType = found
      break
    }
  }

  if (!companyId || !eventType) return notFound()

  // Get company info for branding
  const { data: company } = await supabase
    .from('companies')
    .select('name, email, phone')
    .eq('id', companyId)
    .maybeSingle()

  // Get theme from website
  const { data: website } = await supabase
    .from('company_websites')
    .select('theme')
    .eq('company_id', companyId)
    .maybeSingle()

  const theme = website?.theme || {}
  const accentColor = theme.accent_color || '#6b2d7b'
  const primaryColor = theme.primary_color || '#1a1a1a'
  const companyName = company?.name || 'Book'
  const duration = eventType.duration_minutes || 60
  const typeLabel = eventType.label || 'Appointment'
  const typeDescription = eventType.description || `Book a ${duration}-minute ${typeLabel.toLowerCase()} with ${companyName}.`

  const daysLabel = eventType.available_days
    ? eventType.available_days.map((d: string) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')
    : 'Monday – Friday'
  const hoursLabel = eventType.available_hours
    ? `${eventType.available_hours.start} – ${eventType.available_hours.end}`
    : '9:00 – 17:00'

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Book {typeLabel} — {companyName}</title>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'DM Sans', sans-serif; background: #f5f3f0; color: #2a2522; min-height: 100vh; }
          .booking-page { max-width: 520px; margin: 0 auto; padding: 40px 20px; }
          .brand { text-align: center; margin-bottom: 32px; }
          .brand h1 { font-size: 1.4rem; font-weight: 700; margin-bottom: 4px; }
          .brand p { font-size: .85rem; color: #888; }
          .card { background: #fff; border-radius: 16px; padding: 32px; box-shadow: 0 2px 20px rgba(0,0,0,.06); margin-bottom: 24px; }
          .type-header { text-align: center; margin-bottom: 28px; }
          .type-badge { display: inline-block; background: ${accentColor}15; color: ${accentColor}; padding: 6px 16px; border-radius: 50px; font-size: .75rem; font-weight: 600; letter-spacing: .5px; text-transform: uppercase; margin-bottom: 12px; }
          .type-header h2 { font-size: 1.6rem; font-weight: 700; margin-bottom: 8px; }
          .type-header p { font-size: .9rem; color: #666; line-height: 1.6; }
          .meta { display: flex; gap: 20px; justify-content: center; margin-top: 16px; flex-wrap: wrap; }
          .meta-item { font-size: .8rem; color: #888; display: flex; align-items: center; gap: 6px; }
          .meta-item strong { color: #555; }

          .form-group { margin-bottom: 18px; }
          .form-group label { display: block; font-size: .82rem; font-weight: 600; margin-bottom: 6px; color: #444; }
          .form-group input { width: 100%; padding: 12px 14px; border: 1px solid #e0dcd7; border-radius: 10px; font-size: .9rem; font-family: inherit; transition: border-color .2s; background: #faf9f7; }
          .form-group input:focus { border-color: ${accentColor}; outline: none; box-shadow: 0 0 0 3px ${accentColor}20; }
          .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

          .btn { width: 100%; padding: 14px; border: none; border-radius: 50px; font-size: .92rem; font-weight: 600; cursor: pointer; transition: all .2s; font-family: inherit; }
          .btn-primary { background: ${accentColor}; color: #fff; box-shadow: 0 2px 12px ${accentColor}30; }
          .btn-primary:hover { opacity: .9; transform: translateY(-1px); }
          .btn-primary:disabled { opacity: .5; cursor: wait; transform: none; }
          .btn-back { background: transparent; color: #888; font-size: .85rem; margin-top: 8px; }
          .btn-back:hover { color: #555; }

          .step { display: none; }
          .step.active { display: block; }

          .calendar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
          .calendar-header h3 { font-size: 1rem; font-weight: 600; }
          .cal-nav { background: ${accentColor}; color: #fff; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: .85rem; transition: background .2s; }
          .cal-nav:hover { opacity: .85; }
          .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 16px; }
          .cal-head { font-size: .7rem; font-weight: 600; text-align: center; padding: 8px 0; color: #999; }
          .cal-day { text-align: center; padding: 10px 0; border-radius: 8px; font-size: .85rem; cursor: pointer; transition: all .15s; position: relative; }
          .cal-day:hover:not(.disabled) { background: ${accentColor}12; }
          .cal-day.selected { background: ${accentColor}; color: #fff; font-weight: 600; }
          .cal-day.disabled { color: #ccc; cursor: default; }
          .cal-day .dot { width: 4px; height: 4px; background: #22c55e; border-radius: 50%; position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%); }

          .time-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px; }
          .time-slot { text-align: center; padding: 12px; border: 1px solid #e0dcd7; border-radius: 10px; cursor: pointer; font-size: .85rem; font-weight: 500; transition: all .15s; }
          .time-slot:hover { border-color: ${accentColor}; background: ${accentColor}08; }
          .time-slot.selected { background: ${accentColor}; color: #fff; border-color: ${accentColor}; }

          .loading { text-align: center; padding: 20px; color: #999; font-size: .85rem; }
          .success-card { text-align: center; }
          .success-icon { font-size: 3rem; margin-bottom: 16px; }
          .success-card h2 { font-size: 1.4rem; margin-bottom: 8px; }
          .success-card p { font-size: .9rem; color: #666; line-height: 1.6; margin-bottom: 8px; }
          .success-detail { background: #f5f3f0; padding: 16px; border-radius: 10px; margin: 20px 0; font-size: .9rem; }
          .success-detail strong { display: block; margin-bottom: 4px; }

          .footer { text-align: center; padding: 24px; font-size: .75rem; color: #aaa; }
          .footer a { color: ${accentColor}; text-decoration: none; }

          @media (max-width: 480px) { .form-row { grid-template-columns: 1fr; } .time-grid { grid-template-columns: repeat(2, 1fr); } }
        `}</style>
      </head>
      <body>
        <div className="booking-page">
          <div className="brand">
            <h1>{companyName}</h1>
            <p>Online Booking</p>
          </div>

          <div className="card">
            <div className="type-header">
              <div className="type-badge">{typeLabel}</div>
              <h2>Book Your {typeLabel}</h2>
              <p>{typeDescription}</p>
              <div className="meta">
                <div className="meta-item">🕐 <strong>{duration} min</strong></div>
                <div className="meta-item">📅 <strong>{daysLabel}</strong></div>
                <div className="meta-item">⏰ <strong>{hoursLabel}</strong></div>
              </div>
            </div>

            {/* Step 1: Details */}
            <div id="step1" className="step active">
              <form id="detailsForm">
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name *</label>
                    <input type="text" id="bkFirstName" required />
                  </div>
                  <div className="form-group">
                    <label>Surname</label>
                    <input type="text" id="bkSurname" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input type="email" id="bkEmail" required />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input type="tel" id="bkPhone" />
                </div>
                <div className="form-group">
                  <label>Business Name</label>
                  <input type="text" id="bkBusiness" />
                </div>
                <button type="submit" className="btn btn-primary">Choose Date & Time →</button>
              </form>
            </div>

            {/* Step 2: Calendar */}
            <div id="step2" className="step">
              <div id="calLoading" className="loading">Loading availability...</div>
              <div id="calContainer" style={{ display: 'none' }}>
                <div className="calendar-header">
                  <button className="cal-nav" id="prevMonth">‹</button>
                  <h3 id="calMonth"></h3>
                  <button className="cal-nav" id="nextMonth">›</button>
                </div>
                <div className="calendar-grid" id="calGrid"></div>
                <div id="timeGrid" className="time-grid" style={{ display: 'none' }}></div>
                <button id="confirmBtn" className="btn btn-primary" style={{ display: 'none', marginTop: '20px' }}>Confirm Booking</button>
                <p style={{ marginTop: '12px', fontSize: '.72rem', color: '#aaa', textAlign: 'center' }}>
                  <span style={{ display: 'inline-block', width: '6px', height: '6px', background: '#22c55e', borderRadius: '50%', marginRight: '4px', verticalAlign: 'middle' }}></span>
                  Available dates
                </p>
              </div>
              <button className="btn btn-back" id="backBtn">← Back to details</button>
            </div>

            {/* Step 3: Success */}
            <div id="step3" className="step">
              <div className="success-card">
                <div className="success-icon">✅</div>
                <h2>Booking Confirmed!</h2>
                <p>Your {typeLabel.toLowerCase()} has been booked.</p>
                <div className="success-detail" id="successDetail"></div>
                <p>We'll be in touch to confirm. Thank you!</p>
              </div>
            </div>
          </div>

          <div className="footer">
            Powered by <a href="https://buildyourmanagement.co.uk" target="_blank">BYM</a>
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: `
          const COMPANY_ID = '${companyId}';
          const EVENT_TYPE_SLUG = '${eventType.slug || eventType.key}';
          const EVENT_TYPE_LABEL = '${typeLabel}';
          const DURATION = ${duration};

          let curMonth = new Date();
          let selDate = null, selTime = null, contact = null;
          let availDates = [], availSet = new Set();

          // Steps
          function showStep(n) { document.querySelectorAll('.step').forEach(s => s.classList.remove('active')); document.getElementById('step'+n).classList.add('active'); }

          // Step 1 submit
          document.getElementById('detailsForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            contact = {
              firstName: document.getElementById('bkFirstName').value,
              surname: document.getElementById('bkSurname').value,
              email: document.getElementById('bkEmail').value,
              phone: document.getElementById('bkPhone').value,
              business: document.getElementById('bkBusiness').value,
            };
            showStep(2);
            await loadAvail();
            renderCal();
          });

          document.getElementById('backBtn').onclick = () => showStep(1);

          // Load availability
          async function loadAvail() {
            document.getElementById('calLoading').style.display = 'block';
            document.getElementById('calContainer').style.display = 'none';
            try {
              const r = await fetch('/api/website/availability?company_id='+COMPANY_ID+'&event_type='+EVENT_TYPE_SLUG);
              const d = await r.json();
              availDates = d.available_dates || [];
              availSet = new Set(availDates.map(x => x.date));
            } catch(e) { availDates = []; availSet = new Set(); }
            document.getElementById('calLoading').style.display = 'none';
            document.getElementById('calContainer').style.display = 'block';
          }

          // Calendar
          const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
          function renderCal() {
            document.getElementById('calMonth').textContent = MONTHS[curMonth.getMonth()]+' '+curMonth.getFullYear();
            const fd = new Date(curMonth.getFullYear(), curMonth.getMonth(), 1);
            const ld = new Date(curMonth.getFullYear(), curMonth.getMonth()+1, 0);
            const today = new Date(); today.setHours(0,0,0,0);
            const g = document.getElementById('calGrid'); g.innerHTML = '';
            ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => { const h = document.createElement('div'); h.className='cal-head'; h.textContent=d; g.appendChild(h); });
            for (let i=0;i<fd.getDay();i++) { const e=document.createElement('div'); e.className='cal-day disabled'; g.appendChild(e); }
            for (let d=1;d<=ld.getDate();d++) {
              const el=document.createElement('div'); el.className='cal-day'; el.textContent=d;
              const dd=new Date(curMonth.getFullYear(),curMonth.getMonth(),d);
              const ds=dd.toISOString().split('T')[0];
              if (dd<today||!availSet.has(ds)) { el.classList.add('disabled'); if(dd>=today) el.style.opacity='.3'; }
              else { const dot=document.createElement('div'); dot.className='dot'; el.appendChild(dot); el.onclick=()=>pickDate(dd,el,ds); }
              g.appendChild(el);
            }
          }
          document.getElementById('prevMonth').onclick = () => { curMonth.setMonth(curMonth.getMonth()-1); renderCal(); };
          document.getElementById('nextMonth').onclick = () => { curMonth.setMonth(curMonth.getMonth()+1); renderCal(); };

          async function pickDate(date, el, ds) {
            document.querySelectorAll('.cal-day.selected').forEach(e=>e.classList.remove('selected'));
            el.classList.add('selected'); selDate=date; selTime=null;
            document.getElementById('confirmBtn').style.display='none';
            const tg=document.getElementById('timeGrid'); tg.style.display='grid';
            tg.innerHTML='<div style="grid-column:1/-1;text-align:center;color:#999;font-size:.85rem">Loading...</div>';
            try {
              const r=await fetch('/api/website/availability?company_id='+COMPANY_ID+'&date='+ds+'&event_type='+EVENT_TYPE_SLUG);
              const d=await r.json(); tg.innerHTML='';
              if(!d.slots||d.slots.length===0){tg.innerHTML='<div style="grid-column:1/-1;text-align:center;color:#999;font-size:.85rem">No slots available</div>';return;}
              d.slots.forEach(s=>{const e=document.createElement('div');e.className='time-slot';e.textContent=s.time;e.onclick=()=>pickTime(s.time,e);tg.appendChild(e);});
            } catch(e) { tg.innerHTML='<div style="grid-column:1/-1;text-align:center;color:#c00;font-size:.85rem">Error loading slots</div>'; }
          }
          function pickTime(t,el) { document.querySelectorAll('.time-slot.selected').forEach(e=>e.classList.remove('selected')); el.classList.add('selected'); selTime=t; document.getElementById('confirmBtn').style.display='block'; }

          // Confirm
          document.getElementById('confirmBtn').onclick = async function() {
            if(!selDate||!selTime||!contact) return;
            this.textContent='Booking...'; this.disabled=true;
            try {
              const ds=selDate.toISOString().split('T')[0];
              const r=await fetch('/api/website/book',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
                company_id:COMPANY_ID, first_name:contact.firstName, last_name:contact.surname,
                email:contact.email, phone:contact.phone, business_name:contact.business,
                date:ds, time:selTime, event_type:EVENT_TYPE_SLUG,
              })});
              const d=await r.json();
              if(!r.ok){
                if(r.status===409){alert(d.error||'Slot taken');await loadAvail();renderCal();document.getElementById('timeGrid').innerHTML='';document.getElementById('timeGrid').style.display='none';this.textContent='Confirm Booking';this.disabled=false;this.style.display='none';return;}
                throw new Error(d.error);
              }
              const fd=selDate.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
              document.getElementById('successDetail').innerHTML='<strong>'+EVENT_TYPE_LABEL+'</strong>'+fd+' at '+selTime+'<br>Duration: '+DURATION+' minutes<br>'+contact.firstName+' '+contact.surname;
              showStep(3);
            } catch(e) { alert('Booking failed — please try again.'); }
            finally { this.textContent='Confirm Booking'; this.disabled=false; }
          };
        `}} />
      </body>
    </html>
  ) as any
}
