// lib/websiteTemplates.ts
// Industry-specific website templates for the block editor

type Block = { type: string; [key: string]: any };
type WebsiteTemplate = { name: string; description: string; icon: string; blocks: Block[] };

const industryTemplates: Record<string, WebsiteTemplate[]> = {

  // ═══════════════════════════════════════
  // REMOVALS
  // ═══════════════════════════════════════
  removals: [
    {
      name: 'Clean & Professional',
      description: 'Simple, trust-focused layout',
      icon: '✨',
      blocks: [
        { type: 'hero', headline: 'Your Trusted Removal Company', subheadline: 'Professional, reliable and affordable removals across the UK', cta_text: 'Get a Free Quote' },
        { type: 'services', title: 'Our Services', services: [{ title: 'House Removals', description: 'Full house moves handled with care and professionalism' }, { title: 'Packing Service', description: 'We pack everything safely so nothing gets damaged' }, { title: 'Storage Solutions', description: 'Secure short and long-term storage available' }] },
        { type: 'reviews', title: 'Happy Customers', reviews: [{ name: 'Sarah M.', text: 'Absolutely brilliant service. So professional and careful.', rating: 5 }, { name: 'James T.', text: 'Fast, efficient and great value for money.', rating: 5 }, { name: 'Emma L.', text: 'Third time using them. Would not use anyone else!', rating: 5 }] },
        { type: 'quote_form', title: 'Get Your Free Quote', subtitle: "Fill in your details and we'll be in touch quickly" },
        { type: 'contact', title: 'Get In Touch' },
      ],
    },
    {
      name: 'Lead Generation',
      description: 'Quote form front and centre',
      icon: '🎯',
      blocks: [
        { type: 'hero', headline: 'Moving? Get a Free Quote Today', subheadline: 'Trusted removal services — competitive prices, professional team', cta_text: 'Get My Free Quote' },
        { type: 'quote_form', title: 'Free No-Obligation Quote', subtitle: 'Takes less than 2 minutes' },
        { type: 'services', title: 'What We Offer', services: [{ title: 'Local Moves', description: 'Moving within your town or city' }, { title: 'Long Distance', description: 'Nationwide removal service' }, { title: 'Office Moves', description: 'Business and office relocations' }] },
        { type: 'coverage', title: 'Where We Operate', areas: ['London', 'Bristol', 'Bath', 'Cardiff', 'Reading', 'Oxford'] },
        { type: 'reviews', title: 'Trusted by Hundreds' },
      ],
    },
    {
      name: 'Full Showcase',
      description: 'All blocks — complete website',
      icon: '🏠',
      blocks: [
        { type: 'hero', headline: 'Professional Removal Services', subheadline: 'Making your move as stress-free as possible', cta_text: 'Get a Free Quote' },
        { type: 'services', title: 'Our Services' },
        { type: 'about', title: 'About Us', body: 'We are a trusted removal company with years of experience. Our professional team handles every move with the utmost care and efficiency.', highlights: ['Fully insured', 'Free quotes', 'No hidden charges', 'Weekend moves available'] },
        { type: 'reviews', title: 'What Customers Say' },
        { type: 'coverage', title: 'Areas We Cover', areas: ['London', 'Bristol', 'Bath', 'Cardiff', 'Birmingham'] },
        { type: 'quote_form', title: 'Get a Free Quote' },
        { type: 'gallery', title: 'Our Work' },
        { type: 'contact', title: 'Contact Us' },
      ],
    },
  ],

  // ═══════════════════════════════════════
  // PLUMBER / TRADES (shared)
  // ═══════════════════════════════════════
  plumber: [
    {
      name: 'Trust & Credentials',
      description: 'Gas Safe, reviews and quick contact',
      icon: '🔧',
      blocks: [
        { type: 'hero', headline: 'Reliable Plumbing & Heating Services', subheadline: 'Gas Safe registered. Fast response. No call-out charge.', cta_text: 'Call Now' },
        { type: 'services', title: 'Our Services', services: [{ title: 'Boiler Repairs & Servicing', description: 'Annual servicing, repairs and emergency breakdowns' }, { title: 'Central Heating', description: 'Full system installation, powerflushing and radiator fitting' }, { title: 'Bathrooms', description: 'Complete bathroom installation and refurbishment' }, { title: 'General Plumbing', description: 'Leaks, taps, toilets, showers and pipework' }] },
        { type: 'about', title: 'Why Choose Us', body: 'With over 10 years of experience, we provide quality plumbing and heating services you can trust.', highlights: ['Gas Safe Registered', 'No call-out charge', 'Free quotes', '12-month guarantee on all work', 'Fully insured'] },
        { type: 'reviews', title: 'Customer Reviews', reviews: [{ name: 'Mark D.', text: 'Fixed our boiler same day. Fantastic service.', rating: 5 }, { name: 'Lisa R.', text: 'Very professional, tidy and reasonably priced.', rating: 5 }] },
        { type: 'coverage', title: 'Areas We Cover' },
        { type: 'contact', title: 'Get In Touch', subtitle: 'Call us or fill in the form for a free quote' },
      ],
    },
    {
      name: 'Emergency Focus',
      description: 'Quick contact for urgent jobs',
      icon: '🚨',
      blocks: [
        { type: 'hero', headline: 'Emergency Plumber — Available 24/7', subheadline: 'Fast response, fixed prices, no hidden charges', cta_text: 'Call Now for Fast Response' },
        { type: 'quote_form', title: 'Request a Callback', subtitle: "Tell us what's wrong and we'll call you right back" },
        { type: 'services', title: 'What We Fix', services: [{ title: 'Burst Pipes', description: 'Emergency pipe repairs and leak detection' }, { title: 'Boiler Breakdowns', description: 'Same-day boiler repairs when you need them' }, { title: 'Blocked Drains', description: 'Fast drain clearance and repair' }] },
        { type: 'reviews', title: 'Trusted by Locals' },
        { type: 'contact', title: 'Contact Us' },
      ],
    },
  ],

  // ═══════════════════════════════════════
  // ELECTRICIAN
  // ═══════════════════════════════════════
  electrician: [
    {
      name: 'Professional & Certified',
      description: 'Credentials-focused with services',
      icon: '⚡',
      blocks: [
        { type: 'hero', headline: 'Qualified Electrician You Can Trust', subheadline: 'NICEIC approved. Domestic & commercial. All work certified.', cta_text: 'Get a Free Quote' },
        { type: 'services', title: 'Our Services', services: [{ title: 'Rewiring', description: 'Full and partial rewires for homes and businesses' }, { title: 'Consumer Units', description: 'Fuse board upgrades to the latest regulations' }, { title: 'EICRs & Testing', description: 'Electrical inspection and condition reports' }, { title: 'Lighting', description: 'Interior, exterior and smart lighting installation' }] },
        { type: 'about', title: 'Why Choose Us', body: 'Fully qualified and insured electrician covering all domestic and commercial work.', highlights: ['NICEIC Approved', 'Part P Certified', 'Free quotes', 'All work guaranteed'] },
        { type: 'reviews', title: 'What Our Customers Say' },
        { type: 'coverage', title: 'Areas We Cover' },
        { type: 'contact', title: 'Get In Touch' },
      ],
    },
  ],

  // ═══════════════════════════════════════
  // BUILDER
  // ═══════════════════════════════════════
  builder: [
    {
      name: 'Portfolio Showcase',
      description: 'Gallery-led with project types',
      icon: '🏗️',
      blocks: [
        { type: 'hero', headline: 'Quality Building & Construction', subheadline: 'Extensions, renovations and new builds — built to the highest standards', cta_text: 'Discuss Your Project' },
        { type: 'services', title: 'What We Build', services: [{ title: 'Extensions', description: 'Single and double storey extensions' }, { title: 'Loft Conversions', description: 'Create extra living space in your home' }, { title: 'Renovations', description: 'Full property renovation and refurbishment' }, { title: 'New Builds', description: 'Ground-up construction and project management' }] },
        { type: 'gallery', title: 'Recent Projects' },
        { type: 'about', title: 'About Us', body: 'Family-run building company with a reputation for quality craftsmanship and reliable service.', highlights: ['Fully insured', 'Free estimates', 'Project managed', 'References available'] },
        { type: 'reviews', title: 'Client Testimonials' },
        { type: 'contact', title: 'Start Your Project' },
      ],
    },
  ],

  // ═══════════════════════════════════════
  // PAINTER & DECORATOR
  // ═══════════════════════════════════════
  painter: [
    {
      name: 'Before & After',
      description: 'Gallery showcase with services',
      icon: '🎨',
      blocks: [
        { type: 'hero', headline: 'Professional Painting & Decorating', subheadline: 'Transform your home with a quality finish that lasts', cta_text: 'Get a Free Quote' },
        { type: 'services', title: 'Our Services', services: [{ title: 'Interior Painting', description: 'Walls, ceilings, woodwork and trim' }, { title: 'Exterior Painting', description: 'Fascias, soffits, windows and walls' }, { title: 'Wallpapering', description: 'Expert wallpaper hanging and removal' }, { title: 'Restoration', description: 'Period property and heritage restoration' }] },
        { type: 'gallery', title: 'Our Work' },
        { type: 'reviews', title: 'Happy Customers' },
        { type: 'quote_form', title: 'Get Your Free Quote' },
        { type: 'contact', title: 'Get In Touch' },
      ],
    },
  ],

  // ═══════════════════════════════════════
  // CLEANING
  // ═══════════════════════════════════════
  cleaning: [
    {
      name: 'Sparkling Clean',
      description: 'Service-focused with booking form',
      icon: '🧹',
      blocks: [
        { type: 'hero', headline: 'Professional Cleaning Services', subheadline: 'Trusted, reliable and thorough cleaning for your home or office', cta_text: 'Book a Clean' },
        { type: 'services', title: 'Our Services', services: [{ title: 'Regular Cleaning', description: 'Weekly, fortnightly or monthly domestic cleaning' }, { title: 'Deep Clean', description: 'Thorough top-to-bottom deep cleaning' }, { title: 'End of Tenancy', description: 'Get your full deposit back with our professional clean' }, { title: 'Office Cleaning', description: 'Regular commercial cleaning services' }] },
        { type: 'about', title: 'Why Choose Us', body: 'We use eco-friendly products and our cleaners are fully vetted, insured and trained.', highlights: ['Vetted & insured cleaners', 'Eco-friendly products', 'Flexible scheduling', '100% satisfaction guarantee'] },
        { type: 'reviews', title: 'What Our Clients Say' },
        { type: 'quote_form', title: 'Get a Free Quote' },
        { type: 'contact', title: 'Contact Us' },
      ],
    },
    {
      name: 'Quick Booking',
      description: 'Form-first for fast bookings',
      icon: '⚡',
      blocks: [
        { type: 'hero', headline: 'Book Your Cleaner Today', subheadline: 'Affordable, reliable cleaning — from just £15/hour', cta_text: 'Book Now' },
        { type: 'quote_form', title: 'Book a Cleaning', subtitle: 'Tell us what you need and we will get back to you within an hour' },
        { type: 'services', title: 'What We Offer' },
        { type: 'reviews', title: 'Trusted by Hundreds of Homes' },
        { type: 'coverage', title: 'Areas We Cover' },
      ],
    },
  ],

  // ═══════════════════════════════════════
  // ESTATE AGENT
  // ═══════════════════════════════════════
  estate_agent: [
    {
      name: 'Property Professional',
      description: 'Valuation-focused with local expertise',
      icon: '🏡',
      blocks: [
        { type: 'hero', headline: 'Your Local Property Experts', subheadline: 'Selling, buying and letting — we make it happen', cta_text: 'Book a Free Valuation' },
        { type: 'services', title: 'Our Services', services: [{ title: 'Sales', description: 'Achieve the best price for your property with expert marketing' }, { title: 'Lettings', description: 'Find the perfect tenant, hassle-free' }, { title: 'Valuations', description: 'Free, no-obligation property valuations' }, { title: 'Property Management', description: 'Full management service for landlords' }] },
        { type: 'about', title: 'Local Knowledge, National Reach', body: 'We combine deep local knowledge with modern marketing to sell and let properties faster.', highlights: ['Free valuations', 'Professional photography', 'Online & high street marketing', 'Accompanied viewings'] },
        { type: 'reviews', title: 'What Our Clients Say' },
        { type: 'quote_form', title: 'Book a Free Valuation', subtitle: 'Find out what your property is worth' },
        { type: 'contact', title: 'Contact Us' },
      ],
    },
  ],

  // ═══════════════════════════════════════
  // SALON / BEAUTY
  // ═══════════════════════════════════════
  salon: [
    {
      name: 'Elegant & Inviting',
      description: 'Service menu with gallery',
      icon: '💇',
      blocks: [
        { type: 'hero', headline: 'Your Hair, Your Way', subheadline: 'Expert stylists creating looks you will love', cta_text: 'Book an Appointment' },
        { type: 'services', title: 'Our Services', services: [{ title: 'Cut & Style', description: 'Precision cuts tailored to you' }, { title: 'Colour', description: 'Balayage, highlights, full colour and toners' }, { title: 'Treatments', description: 'Keratin, Olaplex and deep conditioning' }, { title: 'Beauty', description: 'Facials, nails, waxing and lash extensions' }] },
        { type: 'gallery', title: 'Our Work' },
        { type: 'about', title: 'About the Salon', body: 'A relaxing, welcoming space where our talented team create beautiful results every day.', highlights: ['Experienced stylists', 'Premium products', 'Relaxing atmosphere', 'Free consultations'] },
        { type: 'reviews', title: 'Loved by Our Clients' },
        { type: 'contact', title: 'Book Your Appointment' },
      ],
    },
  ],

  // ═══════════════════════════════════════
  // BARBER
  // ═══════════════════════════════════════
  barber: [
    {
      name: 'Sharp & Bold',
      description: 'Services and booking',
      icon: '💈',
      blocks: [
        { type: 'hero', headline: 'Fresh Cuts. Sharp Style.', subheadline: 'Walk-ins welcome or book your chair', cta_text: 'Book Now' },
        { type: 'services', title: 'Services & Prices', services: [{ title: 'Haircut', description: 'Precision cut with consultation — £18' }, { title: 'Cut & Beard', description: 'Haircut plus beard trim and shape — £25' }, { title: 'Hot Towel Shave', description: 'Classic straight razor shave — £15' }, { title: 'Skin Fade', description: 'Skin fade with style — £22' }] },
        { type: 'gallery', title: 'Our Work' },
        { type: 'reviews', title: 'What the Lads Say' },
        { type: 'about', title: 'About Us', body: 'Traditional barbershop with a modern twist. Quality cuts in a relaxed atmosphere.', highlights: ['Walk-ins welcome', 'Experienced barbers', 'Premium products'] },
        { type: 'contact', title: 'Find Us' },
      ],
    },
  ],

  // ═══════════════════════════════════════
  // VET
  // ═══════════════════════════════════════
  vet: [
    {
      name: 'Caring & Professional',
      description: 'Services with emergency info',
      icon: '🐾',
      blocks: [
        { type: 'hero', headline: 'Compassionate Care for Your Pets', subheadline: 'Experienced vets providing the highest standard of care', cta_text: 'Book an Appointment' },
        { type: 'services', title: 'Our Services', services: [{ title: 'Consultations', description: 'Thorough health checks and diagnosis' }, { title: 'Vaccinations', description: 'Keep your pet protected with regular vaccinations' }, { title: 'Surgery', description: 'Routine and complex surgical procedures' }, { title: 'Dental Care', description: 'Professional dental cleaning and treatment' }, { title: 'Emergency Care', description: '24/7 emergency cover available' }] },
        { type: 'about', title: 'About Our Practice', body: 'Our friendly team of vets and nurses are passionate about animal welfare and dedicated to giving your pet the best care possible.', highlights: ['RCVS accredited', 'State-of-the-art equipment', 'Free puppy & kitten checks', 'Pet health plans available'] },
        { type: 'reviews', title: 'What Pet Owners Say' },
        { type: 'contact', title: 'Contact Us', subtitle: 'Emergency? Call us immediately on our emergency line.' },
      ],
    },
  ],

  // ═══════════════════════════════════════
  // DENTAL
  // ═══════════════════════════════════════
  dental: [
    {
      name: 'Welcoming Practice',
      description: 'Patient-focused with treatments',
      icon: '🦷',
      blocks: [
        { type: 'hero', headline: 'Gentle, Expert Dental Care', subheadline: 'NHS and private dentistry in a relaxed, modern environment', cta_text: 'Register as a Patient' },
        { type: 'services', title: 'Our Treatments', services: [{ title: 'Check-ups & Hygiene', description: 'Regular examinations and professional cleaning' }, { title: 'Cosmetic Dentistry', description: 'Whitening, veneers and smile makeovers' }, { title: 'Orthodontics', description: 'Invisalign and traditional braces' }, { title: 'Emergency Dental', description: 'Same-day emergency appointments available' }] },
        { type: 'about', title: 'About Our Practice', body: 'We are a friendly, modern dental practice committed to providing excellent care in a comfortable environment.', highlights: ['Accepting new NHS patients', 'Nervous patient specialists', 'Latest technology', 'Interest-free payment plans'] },
        { type: 'reviews', title: 'Patient Reviews' },
        { type: 'contact', title: 'Register or Get In Touch' },
      ],
    },
  ],

  // ═══════════════════════════════════════
  // PERSONAL TRAINER
  // ═══════════════════════════════════════
  personal_trainer: [
    {
      name: 'Results Focused',
      description: 'Packages and transformation stories',
      icon: '💪',
      blocks: [
        { type: 'hero', headline: 'Transform Your Body & Mind', subheadline: 'Personal training tailored to your goals — from complete beginners to athletes', cta_text: 'Book a Free Consultation' },
        { type: 'services', title: 'Training Packages', services: [{ title: '1-to-1 Training', description: 'Personalised sessions focused on your goals' }, { title: 'Online Coaching', description: 'Custom plans and weekly check-ins from anywhere' }, { title: 'Group Sessions', description: 'Fun, motivating small group training' }, { title: 'Nutrition Plans', description: 'Tailored meal plans to support your training' }] },
        { type: 'about', title: 'About Me', body: 'Certified personal trainer passionate about helping people achieve real, lasting results through smart training and nutrition.', highlights: ['Level 3 PT qualified', 'Nutrition certified', 'Flexible scheduling', 'First session free'] },
        { type: 'reviews', title: 'Client Results' },
        { type: 'quote_form', title: 'Book Your Free Consultation' },
        { type: 'contact', title: 'Get In Touch' },
      ],
    },
  ],

  // ═══════════════════════════════════════
  // PHOTOGRAPHER
  // ═══════════════════════════════════════
  photographer: [
    {
      name: 'Portfolio & Booking',
      description: 'Gallery-led with enquiry form',
      icon: '📸',
      blocks: [
        { type: 'hero', headline: 'Capturing Your Special Moments', subheadline: 'Professional photography for weddings, portraits, events and commercial', cta_text: 'View My Work' },
        { type: 'gallery', title: 'Portfolio' },
        { type: 'services', title: 'What I Offer', services: [{ title: 'Weddings', description: 'Full day coverage capturing every moment' }, { title: 'Portraits', description: 'Individual, couple and family portraits' }, { title: 'Events', description: 'Corporate events, parties and celebrations' }, { title: 'Commercial', description: 'Product photography and brand content' }] },
        { type: 'reviews', title: 'What Clients Say' },
        { type: 'about', title: 'About Me', body: 'I am a professional photographer with a passion for capturing authentic moments and creating images that tell your story.' },
        { type: 'quote_form', title: 'Enquire About Availability' },
        { type: 'contact', title: 'Get In Touch' },
      ],
    },
  ],

  // ═══════════════════════════════════════
  // GARDENER / LANDSCAPER
  // ═══════════════════════════════════════
  gardener: [
    {
      name: 'Green & Natural',
      description: 'Services with gallery',
      icon: '🌿',
      blocks: [
        { type: 'hero', headline: 'Beautiful Gardens, Expert Care', subheadline: 'Professional gardening and landscaping services', cta_text: 'Get a Free Quote' },
        { type: 'services', title: 'Our Services', services: [{ title: 'Garden Maintenance', description: 'Regular mowing, weeding, pruning and tidying' }, { title: 'Landscaping', description: 'Complete garden design and transformation' }, { title: 'Tree Surgery', description: 'Tree felling, pruning and stump removal' }, { title: 'Fencing & Decking', description: 'New fences, gates and decking installation' }] },
        { type: 'gallery', title: 'Recent Projects' },
        { type: 'about', title: 'About Us', body: 'Passionate about creating and maintaining beautiful outdoor spaces.', highlights: ['Fully insured', 'Free quotes', 'Reliable & punctual', 'Waste removed'] },
        { type: 'reviews', title: 'Happy Customers' },
        { type: 'coverage', title: 'Areas We Cover' },
        { type: 'quote_form', title: 'Get a Free Quote' },
        { type: 'contact', title: 'Contact Us' },
      ],
    },
  ],

  // ═══════════════════════════════════════
  // DOG GROOMER
  // ═══════════════════════════════════════
  dog_groomer: [
    {
      name: 'Pampered Pooches',
      description: 'Services and gallery',
      icon: '🐕',
      blocks: [
        { type: 'hero', headline: 'Professional Dog Grooming', subheadline: 'A calm, gentle grooming experience your dog will love', cta_text: 'Book a Groom' },
        { type: 'services', title: 'Grooming Services', services: [{ title: 'Full Groom', description: 'Bath, dry, clip, nails and ear clean' }, { title: 'Bath & Tidy', description: 'Bath, blow dry and tidy up' }, { title: 'Puppy Intro', description: 'Gentle first groom for puppies' }, { title: 'Hand Stripping', description: 'Specialist hand stripping for wire-haired breeds' }] },
        { type: 'gallery', title: 'Happy Dogs' },
        { type: 'about', title: 'About Us', body: 'City & Guilds qualified groomer with a passion for making every dog look and feel their best.', highlights: ['Calm, stress-free environment', 'Qualified & insured', 'All breeds welcome', 'Organic shampoos'] },
        { type: 'reviews', title: 'What Owners Say' },
        { type: 'contact', title: 'Book Your Appointment' },
      ],
    },
  ],

  // ═══════════════════════════════════════
  // DRIVING INSTRUCTOR
  // ═══════════════════════════════════════
  driving_instructor: [
    {
      name: 'Pass With Confidence',
      description: 'Packages and pass rates',
      icon: '🚗',
      blocks: [
        { type: 'hero', headline: 'Learn to Drive with Confidence', subheadline: 'Patient, professional instruction — high pass rate', cta_text: 'Book Your First Lesson' },
        { type: 'services', title: 'Lesson Packages', services: [{ title: 'Pay As You Go', description: 'Individual lessons at your own pace' }, { title: '10 Lesson Bundle', description: 'Save with a block booking — best value' }, { title: 'Intensive Course', description: 'Learn fast with a week-long intensive course' }, { title: 'Motorway Lessons', description: 'Post-test motorway confidence building' }] },
        { type: 'about', title: 'About Me', body: 'DVSA approved driving instructor with a calm, patient teaching style and a high first-time pass rate.', highlights: ['DVSA approved', 'High pass rate', 'Manual & automatic', 'Nervous learners welcome'] },
        { type: 'reviews', title: 'Recent Passes' },
        { type: 'coverage', title: 'Areas I Cover' },
        { type: 'contact', title: 'Book a Lesson' },
      ],
    },
  ],

  // ═══════════════════════════════════════
  // ACCOUNTANT
  // ═══════════════════════════════════════
  accountant: [
    {
      name: 'Professional & Trustworthy',
      description: 'Services with credentials',
      icon: '📊',
      blocks: [
        { type: 'hero', headline: 'Expert Accounting & Tax Services', subheadline: 'Helping small businesses and sole traders stay compliant and save money', cta_text: 'Book a Free Consultation' },
        { type: 'services', title: 'Our Services', services: [{ title: 'Annual Accounts', description: 'Year-end accounts preparation and filing' }, { title: 'Self Assessment', description: 'Personal and partnership tax returns' }, { title: 'VAT Returns', description: 'Quarterly VAT submissions and MTD compliance' }, { title: 'Bookkeeping', description: 'Monthly bookkeeping and bank reconciliation' }, { title: 'Payroll', description: 'PAYE, RTI submissions and pension auto-enrolment' }] },
        { type: 'about', title: 'About Us', body: 'We make accounting simple. Friendly, jargon-free service that helps you focus on running your business.', highlights: ['ACCA / AAT qualified', 'Fixed fees — no surprises', 'Cloud accounting experts', 'Free initial consultation'] },
        { type: 'reviews', title: 'What Our Clients Say' },
        { type: 'quote_form', title: 'Get a Free Quote' },
        { type: 'contact', title: 'Contact Us' },
      ],
    },
  ],

  // ═══════════════════════════════════════
  // SOLICITOR
  // ═══════════════════════════════════════
  solicitor: [
    {
      name: 'Authoritative & Approachable',
      description: 'Practice areas with contact',
      icon: '⚖️',
      blocks: [
        { type: 'hero', headline: 'Expert Legal Advice You Can Trust', subheadline: 'Clear, practical legal services for individuals and businesses', cta_text: 'Get Legal Advice' },
        { type: 'services', title: 'Our Practice Areas', services: [{ title: 'Conveyancing', description: 'Buying, selling and remortgaging property' }, { title: 'Family Law', description: 'Divorce, children matters and mediation' }, { title: 'Wills & Probate', description: 'Will writing, estate planning and probate' }, { title: 'Employment Law', description: 'Contracts, disputes and tribunal representation' }] },
        { type: 'about', title: 'About Our Firm', body: 'A modern law firm providing straightforward, affordable legal services without the jargon.', highlights: ['SRA regulated', 'Fixed fee options', 'Free initial consultation', 'No hidden costs'] },
        { type: 'reviews', title: 'Client Testimonials' },
        { type: 'contact', title: 'Speak to a Solicitor' },
      ],
    },
  ],

  // ═══════════════════════════════════════
  // CATERING
  // ═══════════════════════════════════════
  catering: [
    {
      name: 'Event & Wedding',
      description: 'Menu showcase with enquiry',
      icon: '🍽️',
      blocks: [
        { type: 'hero', headline: 'Exceptional Catering for Every Occasion', subheadline: 'From intimate dinners to grand celebrations — food that impresses', cta_text: 'Enquire Now' },
        { type: 'services', title: 'What We Offer', services: [{ title: 'Wedding Catering', description: 'Bespoke menus for your perfect day' }, { title: 'Corporate Events', description: 'Professional catering for business functions' }, { title: 'Private Dining', description: 'Chef-prepared meals in your own home' }, { title: 'BBQ & Hog Roast', description: 'Outdoor catering for parties and events' }] },
        { type: 'gallery', title: 'Our Food' },
        { type: 'about', title: 'About Us', body: 'Passionate about food, dedicated to service. We create memorable dining experiences using fresh, locally sourced ingredients.' },
        { type: 'reviews', title: 'What Clients Say' },
        { type: 'quote_form', title: 'Enquire About Your Event' },
        { type: 'contact', title: 'Contact Us' },
      ],
    },
  ],

  // ═══════════════════════════════════════
  // TATTOO
  // ═══════════════════════════════════════
  tattoo: [
    {
      name: 'Dark & Bold',
      description: 'Portfolio-led with booking',
      icon: '🎨',
      blocks: [
        { type: 'hero', headline: 'Custom Tattoos & Body Art', subheadline: 'Award-winning artists. Bespoke designs. Walk-ins welcome.', cta_text: 'Book a Consultation' },
        { type: 'gallery', title: 'Portfolio' },
        { type: 'services', title: 'What We Do', services: [{ title: 'Custom Designs', description: 'One-of-a-kind tattoos designed just for you' }, { title: 'Cover-ups', description: 'Expert cover-up and rework tattoos' }, { title: 'Piercings', description: 'Professional body piercing services' }] },
        { type: 'about', title: 'About the Studio', body: 'A clean, professional studio with experienced artists specialising in a range of styles.', highlights: ['Licensed & hygienic', 'Custom artwork', 'Aftercare included', 'All styles'] },
        { type: 'reviews', title: 'What Clients Say' },
        { type: 'quote_form', title: 'Book a Consultation', subtitle: 'Describe your idea and we will get back to you' },
        { type: 'contact', title: 'Visit Us' },
      ],
    },
  ],

  // ═══════════════════════════════════════
  // MECHANIC
  // ═══════════════════════════════════════
  mechanic: [
    {
      name: 'Reliable & Local',
      description: 'Services with trust signals',
      icon: '🔩',
      blocks: [
        { type: 'hero', headline: 'Your Local Mobile Mechanic', subheadline: 'We come to you — repairs, servicing and diagnostics at your door', cta_text: 'Book a Service' },
        { type: 'services', title: 'Our Services', services: [{ title: 'Full Service', description: 'Comprehensive vehicle servicing to manufacturer standards' }, { title: 'Diagnostics', description: 'Engine management light investigation and fault finding' }, { title: 'Brake Repairs', description: 'Pads, discs and full brake system overhaul' }, { title: 'MOT Prep', description: 'Pre-MOT checks and repairs to help you pass' }] },
        { type: 'about', title: 'Why Choose Us', body: 'Qualified mechanic bringing the garage to your driveway. Save time and money.', highlights: ['IMI qualified', 'We come to you', 'Competitive prices', 'All makes & models'] },
        { type: 'reviews', title: 'Customer Reviews' },
        { type: 'coverage', title: 'Areas We Cover' },
        { type: 'quote_form', title: 'Get a Quote' },
        { type: 'contact', title: 'Contact Us' },
      ],
    },
  ],

  // ═══════════════════════════════════════
  // IT SUPPORT
  // ═══════════════════════════════════════
  it_support: [
    {
      name: 'Tech Professional',
      description: 'Services with packages',
      icon: '💻',
      blocks: [
        { type: 'hero', headline: 'IT Support That Just Works', subheadline: 'Proactive IT management and support for growing businesses', cta_text: 'Get a Free IT Audit' },
        { type: 'services', title: 'Our Services', services: [{ title: 'IT Support', description: 'Helpdesk, remote and on-site support' }, { title: 'Cloud Solutions', description: 'Microsoft 365, Google Workspace and cloud migration' }, { title: 'Cybersecurity', description: 'Protect your business from cyber threats' }, { title: 'Web Design', description: 'Professional websites that convert visitors to customers' }] },
        { type: 'about', title: 'About Us', body: 'We help small and medium businesses get the most from technology without the jargon or the headaches.', highlights: ['Fast response times', 'Fixed monthly pricing', 'No lock-in contracts', 'Proactive monitoring'] },
        { type: 'reviews', title: 'Client Testimonials' },
        { type: 'quote_form', title: 'Get a Free IT Audit' },
        { type: 'contact', title: 'Contact Us' },
      ],
    },
  ],
};

// ═══════════════════════════════════════
// ALIAS MAPPING — reuse templates across similar industries
// ═══════════════════════════════════════
const templateAliases: Record<string, string> = {
  // Trades share plumber templates
  heating: 'plumber',
  gas_engineer: 'plumber',
  trades: 'plumber',
  // Builder-adjacent
  roofer: 'builder',
  handyman: 'builder',
  hvac: 'plumber',
  // Locksmith uses plumber (emergency focus)
  locksmith: 'plumber',
  // Flooring, window cleaner, pest control use cleaning
  flooring: 'cleaning',
  window_cleaner: 'cleaning',
  pest_control: 'cleaning',
  // Security uses IT
  security: 'it_support',
  // Letting agent shares estate agent
  letting_agent: 'estate_agent',
  // Dog walker shares dog groomer
  dog_walker: 'dog_groomer',
  // Wedding planner shares catering
  wedding_planner: 'catering',
  // Tutor shares personal trainer (coaching style)
  tutor: 'personal_trainer',
  // Physio shares vet (health practice)
  physio: 'vet',
  // Skip hire shares mechanic (service-based)
  skip_hire: 'mechanic',
  // Funeral director gets its own (uses default)
  // Retail gets default
};

// ═══════════════════════════════════════
// DEFAULT TEMPLATES (for any unmatched industry)
// ═══════════════════════════════════════
const defaultTemplates: WebsiteTemplate[] = [
  {
    name: 'Professional Business',
    description: 'Clean layout with services and contact',
    icon: '✨',
    blocks: [
      { type: 'hero', headline: 'Welcome to Our Business', subheadline: 'Professional, reliable services you can count on', cta_text: 'Get in Touch' },
      { type: 'services', title: 'Our Services', services: [{ title: 'Service One', description: 'Description of your first service' }, { title: 'Service Two', description: 'Description of your second service' }, { title: 'Service Three', description: 'Description of your third service' }] },
      { type: 'about', title: 'About Us', body: 'Tell your story here. What makes your business special?', highlights: ['Highlight one', 'Highlight two', 'Highlight three'] },
      { type: 'reviews', title: 'What Our Customers Say' },
      { type: 'contact', title: 'Get In Touch' },
    ],
  },
  {
    name: 'Lead Generator',
    description: 'Enquiry form front and centre',
    icon: '🎯',
    blocks: [
      { type: 'hero', headline: 'Get Started Today', subheadline: 'Fill in the form below for a free, no-obligation quote', cta_text: 'Get a Quote' },
      { type: 'quote_form', title: 'Request a Quote', subtitle: 'We will get back to you within 24 hours' },
      { type: 'services', title: 'What We Offer' },
      { type: 'reviews', title: 'Trusted by Our Customers' },
      { type: 'contact', title: 'Contact Us' },
    ],
  },
];

// ═══════════════════════════════════════
// EXPORT FUNCTION
// ═══════════════════════════════════════

export function getWebsiteTemplates(templateType: string): WebsiteTemplate[] {
  const key = templateType?.toLowerCase().trim() || 'default';

  // Direct match
  if (industryTemplates[key]) return industryTemplates[key];

  // Alias match
  if (templateAliases[key] && industryTemplates[templateAliases[key]]) {
    return industryTemplates[templateAliases[key]];
  }

  // Default
  return defaultTemplates;
}

export function getAllWebsiteTemplates(): Record<string, WebsiteTemplate[]> {
  return { ...industryTemplates, default: defaultTemplates };
}

export type { WebsiteTemplate, Block };