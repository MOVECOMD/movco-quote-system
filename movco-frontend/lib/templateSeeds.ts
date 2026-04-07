// lib/templateSeeds.ts
// Default pipeline stages, event types, and customer fields per industry template

export type TemplateSeed = {
  stages: { name: string; color: string; position: number }[];
  event_types: { key: string; label: string; color: string }[];
  customer_fields: { key: string; label: string; type: string; options?: string[] }[];
};

const seeds: Record<string, TemplateSeed> = {

  // ═══════════════════════════════════════
  // REMOVALS (MOVCO default)
  // ═══════════════════════════════════════
  removals: {
    stages: [
      { name: 'New Lead', color: '#22c55e', position: 1 },
      { name: 'Survey Booked', color: '#3b82f6', position: 2 },
      { name: 'Quote Sent', color: '#8b5cf6', position: 3 },
      { name: 'Quote Followed Up', color: '#f59e0b', position: 4 },
      { name: 'Booked', color: '#06b6d4', position: 5 },
      { name: 'Completed', color: '#10b981', position: 6 },
      { name: 'Lost', color: '#ef4444', position: 7 },
    ],
    event_types: [
      { key: 'job', label: 'Moving Day', color: '#3b82f6' },
      { key: 'survey', label: 'Home Survey', color: '#8b5cf6' },
      { key: 'callback', label: 'Callback', color: '#f59e0b' },
      { key: 'delivery', label: 'Delivery', color: '#22c55e' },
      { key: 'packing', label: 'Packing Day', color: '#f97316' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'bedrooms', label: 'Bedrooms', type: 'select', options: ['1', '2', '3', '4', '5+'] },
      { key: 'property_type', label: 'Property Type', type: 'select', options: ['Flat', 'Terraced', 'Semi-Detached', 'Detached', 'Bungalow', 'Other'] },
      { key: 'access_notes', label: 'Access Notes', type: 'textarea' },
      { key: 'parking', label: 'Parking Available', type: 'select', options: ['Yes', 'No', 'Permit Required'] },
    ],
  },

  // ═══════════════════════════════════════
  // PLUMBER
  // ═══════════════════════════════════════
  plumber: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'Quote Sent', color: '#3b82f6', position: 2 },
      { name: 'Awaiting Response', color: '#f59e0b', position: 3 },
      { name: 'Job Booked', color: '#8b5cf6', position: 4 },
      { name: 'In Progress', color: '#06b6d4', position: 5 },
      { name: 'Completed', color: '#10b981', position: 6 },
      { name: 'Invoiced', color: '#14b8a6', position: 7 },
      { name: 'Lost', color: '#ef4444', position: 8 },
    ],
    event_types: [
      { key: 'job', label: 'Job', color: '#3b82f6' },
      { key: 'callout', label: 'Emergency Callout', color: '#ef4444' },
      { key: 'quote_visit', label: 'Quote Visit', color: '#8b5cf6' },
      { key: 'callback', label: 'Callback', color: '#f59e0b' },
      { key: 'follow_up', label: 'Follow Up', color: '#06b6d4' },
      { key: 'inspection', label: 'Inspection', color: '#14b8a6' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'property_type', label: 'Property Type', type: 'select', options: ['House', 'Flat', 'Commercial', 'New Build', 'Other'] },
      { key: 'boiler_make', label: 'Boiler Make/Model', type: 'text' },
      { key: 'gas_safe_ref', label: 'Gas Safe Ref', type: 'text' },
      { key: 'heating_type', label: 'Heating Type', type: 'select', options: ['Gas', 'Electric', 'Oil', 'Heat Pump', 'Other'] },
      { key: 'last_service', label: 'Last Service Date', type: 'date' },
      { key: 'access_notes', label: 'Access Notes', type: 'textarea' },
    ],
  },

  // ═══════════════════════════════════════
  // ELECTRICIAN
  // ═══════════════════════════════════════
  electrician: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'Site Visit Booked', color: '#3b82f6', position: 2 },
      { name: 'Quote Sent', color: '#8b5cf6', position: 3 },
      { name: 'Awaiting Response', color: '#f59e0b', position: 4 },
      { name: 'Job Booked', color: '#06b6d4', position: 5 },
      { name: 'In Progress', color: '#14b8a6', position: 6 },
      { name: 'Completed', color: '#10b981', position: 7 },
      { name: 'Invoiced', color: '#84cc16', position: 8 },
      { name: 'Lost', color: '#ef4444', position: 9 },
    ],
    event_types: [
      { key: 'job', label: 'Job', color: '#3b82f6' },
      { key: 'callout', label: 'Emergency Callout', color: '#ef4444' },
      { key: 'inspection', label: 'EICR Inspection', color: '#8b5cf6' },
      { key: 'quote_visit', label: 'Quote Visit', color: '#f59e0b' },
      { key: 'testing', label: 'Testing & Certification', color: '#14b8a6' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'property_type', label: 'Property Type', type: 'select', options: ['House', 'Flat', 'Commercial', 'New Build', 'HMO', 'Other'] },
      { key: 'fuse_board_type', label: 'Fuse Board Type', type: 'select', options: ['Consumer Unit', 'Old Fuse Box', 'Unknown'] },
      { key: 'last_eicr', label: 'Last EICR Date', type: 'date' },
      { key: 'certification_needed', label: 'Certification Needed', type: 'select', options: ['None', 'Part P', 'EICR', 'EPC', 'Minor Works'] },
      { key: 'access_notes', label: 'Access Notes', type: 'textarea' },
    ],
  },

  // ═══════════════════════════════════════
  // GENERAL BUILDER / TRADES
  // ═══════════════════════════════════════
  builder: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'Site Visit', color: '#3b82f6', position: 2 },
      { name: 'Quote Sent', color: '#8b5cf6', position: 3 },
      { name: 'Negotiation', color: '#f59e0b', position: 4 },
      { name: 'Deposit Paid', color: '#06b6d4', position: 5 },
      { name: 'Work In Progress', color: '#14b8a6', position: 6 },
      { name: 'Snagging', color: '#f97316', position: 7 },
      { name: 'Completed', color: '#10b981', position: 8 },
      { name: 'Invoiced', color: '#84cc16', position: 9 },
      { name: 'Lost', color: '#ef4444', position: 10 },
    ],
    event_types: [
      { key: 'job', label: 'Work Day', color: '#3b82f6' },
      { key: 'site_visit', label: 'Site Visit', color: '#8b5cf6' },
      { key: 'quote_visit', label: 'Quote Visit', color: '#f59e0b' },
      { key: 'delivery', label: 'Materials Delivery', color: '#22c55e' },
      { key: 'inspection', label: 'Building Control', color: '#14b8a6' },
      { key: 'snagging', label: 'Snagging', color: '#f97316' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'property_type', label: 'Property Type', type: 'select', options: ['House', 'Flat', 'Commercial', 'New Build', 'Listed Building', 'Other'] },
      { key: 'job_type', label: 'Job Type', type: 'select', options: ['Extension', 'Loft Conversion', 'Renovation', 'New Build', 'Repair', 'Landscaping', 'Other'] },
      { key: 'planning_permission', label: 'Planning Permission', type: 'select', options: ['Not Required', 'Applied', 'Approved', 'Rejected', 'Unknown'] },
      { key: 'estimated_duration', label: 'Estimated Duration', type: 'text' },
      { key: 'access_notes', label: 'Access / Parking Notes', type: 'textarea' },
    ],
  },

  // ═══════════════════════════════════════
  // PAINTER & DECORATOR
  // ═══════════════════════════════════════
  painter: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'Quote Visit Booked', color: '#3b82f6', position: 2 },
      { name: 'Quote Sent', color: '#8b5cf6', position: 3 },
      { name: 'Awaiting Response', color: '#f59e0b', position: 4 },
      { name: 'Booked In', color: '#06b6d4', position: 5 },
      { name: 'In Progress', color: '#14b8a6', position: 6 },
      { name: 'Completed', color: '#10b981', position: 7 },
      { name: 'Lost', color: '#ef4444', position: 8 },
    ],
    event_types: [
      { key: 'job', label: 'Painting Day', color: '#3b82f6' },
      { key: 'quote_visit', label: 'Quote Visit', color: '#8b5cf6' },
      { key: 'prep', label: 'Prep Day', color: '#f59e0b' },
      { key: 'wallpaper', label: 'Wallpapering', color: '#ec4899' },
      { key: 'exterior', label: 'Exterior Work', color: '#22c55e' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'property_type', label: 'Property Type', type: 'select', options: ['House', 'Flat', 'Commercial', 'New Build', 'Other'] },
      { key: 'rooms', label: 'Number of Rooms', type: 'number' },
      { key: 'job_type', label: 'Job Type', type: 'select', options: ['Interior', 'Exterior', 'Both', 'Wallpapering', 'Restoration'] },
      { key: 'colour_choices', label: 'Colour Choices', type: 'textarea' },
      { key: 'access_notes', label: 'Access Notes', type: 'textarea' },
    ],
  },

  // ═══════════════════════════════════════
  // ROOFER
  // ═══════════════════════════════════════
  roofer: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'Inspection Booked', color: '#3b82f6', position: 2 },
      { name: 'Quote Sent', color: '#8b5cf6', position: 3 },
      { name: 'Awaiting Response', color: '#f59e0b', position: 4 },
      { name: 'Job Booked', color: '#06b6d4', position: 5 },
      { name: 'In Progress', color: '#14b8a6', position: 6 },
      { name: 'Completed', color: '#10b981', position: 7 },
      { name: 'Lost', color: '#ef4444', position: 8 },
    ],
    event_types: [
      { key: 'job', label: 'Roofing Day', color: '#3b82f6' },
      { key: 'inspection', label: 'Roof Inspection', color: '#8b5cf6' },
      { key: 'emergency', label: 'Emergency Repair', color: '#ef4444' },
      { key: 'scaffolding', label: 'Scaffolding Up/Down', color: '#f97316' },
      { key: 'quote_visit', label: 'Quote Visit', color: '#f59e0b' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'property_type', label: 'Property Type', type: 'select', options: ['House', 'Flat', 'Commercial', 'Bungalow', 'Other'] },
      { key: 'roof_type', label: 'Roof Type', type: 'select', options: ['Pitched - Tile', 'Pitched - Slate', 'Flat - Felt', 'Flat - GRP', 'Other'] },
      { key: 'job_type', label: 'Job Type', type: 'select', options: ['Full Re-roof', 'Repair', 'Flat Roof', 'Guttering', 'Fascias & Soffits', 'Chimney', 'Other'] },
      { key: 'scaffolding_needed', label: 'Scaffolding Needed', type: 'select', options: ['Yes', 'No', 'TBC'] },
      { key: 'access_notes', label: 'Access Notes', type: 'textarea' },
    ],
  },

  // ═══════════════════════════════════════
  // LOCKSMITH
  // ═══════════════════════════════════════
  locksmith: {
    stages: [
      { name: 'New Call', color: '#22c55e', position: 1 },
      { name: 'En Route', color: '#3b82f6', position: 2 },
      { name: 'On Site', color: '#f59e0b', position: 3 },
      { name: 'Completed', color: '#10b981', position: 4 },
      { name: 'Quote Sent', color: '#8b5cf6', position: 5 },
      { name: 'Booked In', color: '#06b6d4', position: 6 },
      { name: 'Lost', color: '#ef4444', position: 7 },
    ],
    event_types: [
      { key: 'emergency', label: 'Emergency Lockout', color: '#ef4444' },
      { key: 'lock_change', label: 'Lock Change', color: '#3b82f6' },
      { key: 'security_survey', label: 'Security Survey', color: '#8b5cf6' },
      { key: 'safe_work', label: 'Safe Work', color: '#f59e0b' },
      { key: 'boarding', label: 'Boarding Up', color: '#f97316' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'property_type', label: 'Property Type', type: 'select', options: ['House', 'Flat', 'Commercial', 'Vehicle', 'Other'] },
      { key: 'lock_type', label: 'Lock Type', type: 'select', options: ['Yale', 'Mortice', 'Euro Cylinder', 'Multi-point', 'Padlock', 'Smart Lock', 'Other'] },
      { key: 'urgency', label: 'Urgency', type: 'select', options: ['Emergency (now)', 'Today', 'This Week', 'Flexible'] },
      { key: 'insurance_claim', label: 'Insurance Claim', type: 'select', options: ['Yes', 'No', 'TBC'] },
    ],
  },

  // ═══════════════════════════════════════
  // GARDENER / LANDSCAPER
  // ═══════════════════════════════════════
  gardener: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'Site Visit Booked', color: '#3b82f6', position: 2 },
      { name: 'Quote Sent', color: '#8b5cf6', position: 3 },
      { name: 'Booked In', color: '#06b6d4', position: 4 },
      { name: 'Recurring Client', color: '#14b8a6', position: 5 },
      { name: 'Completed', color: '#10b981', position: 6 },
      { name: 'Lost', color: '#ef4444', position: 7 },
    ],
    event_types: [
      { key: 'maintenance', label: 'Garden Maintenance', color: '#22c55e' },
      { key: 'landscaping', label: 'Landscaping', color: '#3b82f6' },
      { key: 'lawn_care', label: 'Lawn Care', color: '#84cc16' },
      { key: 'tree_work', label: 'Tree Surgery', color: '#f97316' },
      { key: 'quote_visit', label: 'Quote Visit', color: '#8b5cf6' },
      { key: 'planting', label: 'Planting', color: '#14b8a6' },
      { key: 'fencing', label: 'Fencing', color: '#f59e0b' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'property_type', label: 'Property Type', type: 'select', options: ['House', 'Flat (communal)', 'Commercial', 'Estate', 'Other'] },
      { key: 'garden_size', label: 'Garden Size', type: 'select', options: ['Small', 'Medium', 'Large', 'Very Large', 'Commercial'] },
      { key: 'frequency', label: 'Service Frequency', type: 'select', options: ['One-off', 'Weekly', 'Fortnightly', 'Monthly', 'Seasonal'] },
      { key: 'services_needed', label: 'Services Needed', type: 'textarea' },
      { key: 'access_notes', label: 'Access / Gate Code', type: 'textarea' },
      { key: 'waste_disposal', label: 'Waste Disposal', type: 'select', options: ['Customer disposes', 'We take away', 'Skip needed'] },
    ],
  },

  // ═══════════════════════════════════════
  // PEST CONTROL
  // ═══════════════════════════════════════
  pest_control: {
    stages: [
      { name: 'New Call', color: '#22c55e', position: 1 },
      { name: 'Survey Booked', color: '#3b82f6', position: 2 },
      { name: 'Quote Sent', color: '#8b5cf6', position: 3 },
      { name: 'Treatment Booked', color: '#06b6d4', position: 4 },
      { name: 'Treatment Done', color: '#f59e0b', position: 5 },
      { name: 'Follow Up Due', color: '#f97316', position: 6 },
      { name: 'Resolved', color: '#10b981', position: 7 },
      { name: 'Lost', color: '#ef4444', position: 8 },
    ],
    event_types: [
      { key: 'survey', label: 'Pest Survey', color: '#8b5cf6' },
      { key: 'treatment', label: 'Treatment', color: '#3b82f6' },
      { key: 'follow_up', label: 'Follow Up Visit', color: '#f59e0b' },
      { key: 'emergency', label: 'Emergency Callout', color: '#ef4444' },
      { key: 'proofing', label: 'Proofing Work', color: '#14b8a6' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'property_type', label: 'Property Type', type: 'select', options: ['House', 'Flat', 'Restaurant', 'Office', 'Warehouse', 'Other'] },
      { key: 'pest_type', label: 'Pest Type', type: 'select', options: ['Rats', 'Mice', 'Wasps', 'Bed Bugs', 'Cockroaches', 'Ants', 'Moths', 'Squirrels', 'Pigeons', 'Foxes', 'Other'] },
      { key: 'severity', label: 'Severity', type: 'select', options: ['Minor', 'Moderate', 'Severe', 'Infestation'] },
      { key: 'previous_treatment', label: 'Previous Treatment', type: 'select', options: ['None', 'DIY', 'Professional - Recent', 'Professional - Old'] },
      { key: 'food_business', label: 'Food Business', type: 'select', options: ['Yes', 'No'] },
      { key: 'access_notes', label: 'Access Notes', type: 'textarea' },
    ],
  },

  // ═══════════════════════════════════════
  // CARPET / FLOORING
  // ═══════════════════════════════════════
  flooring: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'Measure Booked', color: '#3b82f6', position: 2 },
      { name: 'Quote Sent', color: '#8b5cf6', position: 3 },
      { name: 'Awaiting Response', color: '#f59e0b', position: 4 },
      { name: 'Order Placed', color: '#06b6d4', position: 5 },
      { name: 'Fitting Booked', color: '#14b8a6', position: 6 },
      { name: 'Fitted', color: '#10b981', position: 7 },
      { name: 'Lost', color: '#ef4444', position: 8 },
    ],
    event_types: [
      { key: 'measure', label: 'Measure Up', color: '#3b82f6' },
      { key: 'fitting', label: 'Fitting Day', color: '#8b5cf6' },
      { key: 'delivery', label: 'Materials Delivery', color: '#22c55e' },
      { key: 'uplift', label: 'Uplift Old Flooring', color: '#f97316' },
      { key: 'callback', label: 'Callback', color: '#f59e0b' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'property_type', label: 'Property Type', type: 'select', options: ['House', 'Flat', 'Commercial', 'New Build', 'Other'] },
      { key: 'flooring_type', label: 'Flooring Type', type: 'select', options: ['Carpet', 'Laminate', 'LVT', 'Hardwood', 'Vinyl', 'Tiles', 'Other'] },
      { key: 'rooms', label: 'Number of Rooms', type: 'number' },
      { key: 'total_sqm', label: 'Total Area (m²)', type: 'number' },
      { key: 'subfloor', label: 'Subfloor Type', type: 'select', options: ['Concrete', 'Wood', 'Unknown'] },
      { key: 'furniture_move', label: 'Furniture Moving Required', type: 'select', options: ['Yes', 'No', 'Some'] },
    ],
  },

  // ═══════════════════════════════════════
  // WINDOW CLEANER
  // ═══════════════════════════════════════
  window_cleaner: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'Quote Sent', color: '#3b82f6', position: 2 },
      { name: 'Booked In', color: '#8b5cf6', position: 3 },
      { name: 'Regular Client', color: '#06b6d4', position: 4 },
      { name: 'Paused', color: '#f59e0b', position: 5 },
      { name: 'Lost', color: '#ef4444', position: 6 },
    ],
    event_types: [
      { key: 'clean', label: 'Window Clean', color: '#3b82f6' },
      { key: 'gutter_clean', label: 'Gutter Clean', color: '#f97316' },
      { key: 'conservatory', label: 'Conservatory Clean', color: '#8b5cf6' },
      { key: 'fascia', label: 'Fascia & Soffit Clean', color: '#14b8a6' },
      { key: 'quote_visit', label: 'Quote Visit', color: '#f59e0b' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'property_type', label: 'Property Type', type: 'select', options: ['House', 'Flat', 'Bungalow', 'Commercial', 'Other'] },
      { key: 'windows_count', label: 'Number of Windows', type: 'number' },
      { key: 'frequency', label: 'Clean Frequency', type: 'select', options: ['4 Weekly', '6 Weekly', '8 Weekly', 'Monthly', 'One-off'] },
      { key: 'access_issues', label: 'Access Issues', type: 'select', options: ['None', 'Side gate locked', 'High windows', 'Conservatory roof', 'Other'] },
      { key: 'round_day', label: 'Round Day', type: 'select', options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] },
    ],
  },

  // ═══════════════════════════════════════
  // HANDYMAN
  // ═══════════════════════════════════════
  handyman: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'Quote Sent', color: '#3b82f6', position: 2 },
      { name: 'Booked In', color: '#8b5cf6', position: 3 },
      { name: 'In Progress', color: '#06b6d4', position: 4 },
      { name: 'Completed', color: '#10b981', position: 5 },
      { name: 'Invoiced', color: '#14b8a6', position: 6 },
      { name: 'Lost', color: '#ef4444', position: 7 },
    ],
    event_types: [
      { key: 'job', label: 'Job', color: '#3b82f6' },
      { key: 'quote_visit', label: 'Quote Visit', color: '#8b5cf6' },
      { key: 'assembly', label: 'Furniture Assembly', color: '#f59e0b' },
      { key: 'repair', label: 'Repair', color: '#ef4444' },
      { key: 'installation', label: 'Installation', color: '#22c55e' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'property_type', label: 'Property Type', type: 'select', options: ['House', 'Flat', 'Commercial', 'Other'] },
      { key: 'job_type', label: 'Job Type', type: 'select', options: ['Shelving', 'Assembly', 'Plumbing', 'Electrical', 'Decorating', 'Tiling', 'General Repairs', 'Other'] },
      { key: 'access_notes', label: 'Access Notes', type: 'textarea' },
      { key: 'materials', label: 'Materials Provided', type: 'select', options: ['Customer provides', 'We supply', 'TBC'] },
    ],
  },

  // ═══════════════════════════════════════
  // HVAC / AIR CONDITIONING
  // ═══════════════════════════════════════
  hvac: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'Site Survey Booked', color: '#3b82f6', position: 2 },
      { name: 'Quote Sent', color: '#8b5cf6', position: 3 },
      { name: 'Awaiting Response', color: '#f59e0b', position: 4 },
      { name: 'Order Placed', color: '#06b6d4', position: 5 },
      { name: 'Installation Booked', color: '#14b8a6', position: 6 },
      { name: 'Installed', color: '#10b981', position: 7 },
      { name: 'Lost', color: '#ef4444', position: 8 },
    ],
    event_types: [
      { key: 'installation', label: 'Installation', color: '#3b82f6' },
      { key: 'service', label: 'Service / Maintenance', color: '#8b5cf6' },
      { key: 'survey', label: 'Site Survey', color: '#f59e0b' },
      { key: 'repair', label: 'Repair', color: '#ef4444' },
      { key: 'commissioning', label: 'Commissioning', color: '#22c55e' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'property_type', label: 'Property Type', type: 'select', options: ['House', 'Flat', 'Office', 'Retail', 'Server Room', 'Other'] },
      { key: 'system_type', label: 'System Type', type: 'select', options: ['Split System', 'Multi-Split', 'Ducted', 'VRF', 'Portable', 'Other'] },
      { key: 'brand', label: 'Brand / Model', type: 'text' },
      { key: 'rooms_to_cool', label: 'Rooms to Cool/Heat', type: 'number' },
      { key: 'f_gas_cert', label: 'F-Gas Certification Needed', type: 'select', options: ['Yes', 'No'] },
    ],
  },

  // ═══════════════════════════════════════
  // ESTATE AGENT
  // ═══════════════════════════════════════
  estate_agent: {
    stages: [
      { name: 'Valuation Booked', color: '#22c55e', position: 1 },
      { name: 'Valuation Done', color: '#3b82f6', position: 2 },
      { name: 'Instructed', color: '#8b5cf6', position: 3 },
      { name: 'Listed', color: '#06b6d4', position: 4 },
      { name: 'Viewings', color: '#f59e0b', position: 5 },
      { name: 'Offer Received', color: '#f97316', position: 6 },
      { name: 'Under Offer', color: '#14b8a6', position: 7 },
      { name: 'Exchanged', color: '#10b981', position: 8 },
      { name: 'Completed', color: '#059669', position: 9 },
      { name: 'Withdrawn', color: '#ef4444', position: 10 },
    ],
    event_types: [
      { key: 'valuation', label: 'Valuation', color: '#8b5cf6' },
      { key: 'viewing', label: 'Viewing', color: '#3b82f6' },
      { key: 'open_day', label: 'Open Day', color: '#f59e0b' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'meeting', label: 'Meeting', color: '#14b8a6' },
      { key: 'inspection', label: 'Property Inspection', color: '#f97316' },
      { key: 'photography', label: 'Photography', color: '#ec4899' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'property_address', label: 'Property Address', type: 'textarea' },
      { key: 'bedrooms', label: 'Bedrooms', type: 'select', options: ['1', '2', '3', '4', '5', '6+'] },
      { key: 'property_type', label: 'Property Type', type: 'select', options: ['Detached', 'Semi-Detached', 'Terraced', 'Flat', 'Bungalow', 'Cottage', 'Other'] },
      { key: 'asking_price', label: 'Asking Price', type: 'number' },
      { key: 'chain_status', label: 'Chain Status', type: 'select', options: ['No Chain', 'Chain - Proceeding', 'Chain - Stuck', 'First Time Buyer', 'Cash Buyer'] },
      { key: 'tenure', label: 'Tenure', type: 'select', options: ['Freehold', 'Leasehold', 'Share of Freehold'] },
      { key: 'epc_rating', label: 'EPC Rating', type: 'select', options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] },
    ],
  },

  // ═══════════════════════════════════════
  // LETTING AGENT
  // ═══════════════════════════════════════
  letting_agent: {
    stages: [
      { name: 'New Landlord', color: '#22c55e', position: 1 },
      { name: 'Valuation Booked', color: '#3b82f6', position: 2 },
      { name: 'Instructed', color: '#8b5cf6', position: 3 },
      { name: 'Listed', color: '#06b6d4', position: 4 },
      { name: 'Viewings', color: '#f59e0b', position: 5 },
      { name: 'Application', color: '#f97316', position: 6 },
      { name: 'Referencing', color: '#14b8a6', position: 7 },
      { name: 'Tenancy Agreed', color: '#10b981', position: 8 },
      { name: 'Moved In', color: '#059669', position: 9 },
      { name: 'Withdrawn', color: '#ef4444', position: 10 },
    ],
    event_types: [
      { key: 'viewing', label: 'Viewing', color: '#3b82f6' },
      { key: 'valuation', label: 'Valuation', color: '#8b5cf6' },
      { key: 'inventory', label: 'Inventory Check', color: '#f59e0b' },
      { key: 'inspection', label: 'Property Inspection', color: '#f97316' },
      { key: 'checkout', label: 'Checkout', color: '#14b8a6' },
      { key: 'meeting', label: 'Meeting', color: '#06b6d4' },
      { key: 'callback', label: 'Callback', color: '#22c55e' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'property_address', label: 'Property Address', type: 'textarea' },
      { key: 'bedrooms', label: 'Bedrooms', type: 'select', options: ['Studio', '1', '2', '3', '4', '5+'] },
      { key: 'monthly_rent', label: 'Monthly Rent (£)', type: 'number' },
      { key: 'property_type', label: 'Property Type', type: 'select', options: ['Flat', 'House', 'HMO', 'Studio', 'Room', 'Other'] },
      { key: 'furnished', label: 'Furnished', type: 'select', options: ['Furnished', 'Part-Furnished', 'Unfurnished'] },
      { key: 'epc_rating', label: 'EPC Rating', type: 'select', options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] },
      { key: 'tenant_type', label: 'Tenant Type', type: 'select', options: ['Professional', 'Student', 'DSS', 'Family', 'Any'] },
    ],
  },

  // ═══════════════════════════════════════
  // CLEANING
  // ═══════════════════════════════════════
  cleaning: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'Quote Sent', color: '#3b82f6', position: 2 },
      { name: 'Booked', color: '#8b5cf6', position: 3 },
      { name: 'Recurring', color: '#06b6d4', position: 4 },
      { name: 'Completed', color: '#10b981', position: 5 },
      { name: 'Paused', color: '#f59e0b', position: 6 },
      { name: 'Lost', color: '#ef4444', position: 7 },
    ],
    event_types: [
      { key: 'clean', label: 'Clean', color: '#3b82f6' },
      { key: 'deep_clean', label: 'Deep Clean', color: '#8b5cf6' },
      { key: 'end_of_tenancy', label: 'End of Tenancy', color: '#f97316' },
      { key: 'quote_visit', label: 'Quote Visit', color: '#f59e0b' },
      { key: 'carpet_clean', label: 'Carpet Clean', color: '#14b8a6' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'property_type', label: 'Property Type', type: 'select', options: ['House', 'Flat', 'Office', 'Commercial', 'Airbnb', 'Other'] },
      { key: 'bedrooms', label: 'Bedrooms', type: 'select', options: ['Studio', '1', '2', '3', '4', '5+'] },
      { key: 'frequency', label: 'Cleaning Frequency', type: 'select', options: ['One-off', 'Weekly', 'Fortnightly', 'Monthly'] },
      { key: 'access_method', label: 'Access Method', type: 'select', options: ['Customer home', 'Key safe', 'Key held', 'Concierge'] },
      { key: 'special_requirements', label: 'Special Requirements', type: 'textarea' },
      { key: 'pets', label: 'Pets', type: 'select', options: ['None', 'Dog', 'Cat', 'Multiple', 'Other'] },
    ],
  },

  // ═══════════════════════════════════════
  // VETERINARY
  // ═══════════════════════════════════════
  vet: {
    stages: [
      { name: 'New Patient', color: '#22c55e', position: 1 },
      { name: 'Consultation Booked', color: '#3b82f6', position: 2 },
      { name: 'Awaiting Results', color: '#f59e0b', position: 3 },
      { name: 'Treatment Plan', color: '#8b5cf6', position: 4 },
      { name: 'Ongoing Treatment', color: '#06b6d4', position: 5 },
      { name: 'Recovered', color: '#10b981', position: 6 },
      { name: 'Follow Up Required', color: '#f97316', position: 7 },
    ],
    event_types: [
      { key: 'consultation', label: 'Consultation', color: '#3b82f6' },
      { key: 'surgery', label: 'Surgery', color: '#ef4444' },
      { key: 'vaccination', label: 'Vaccination', color: '#22c55e' },
      { key: 'checkup', label: 'Check-up', color: '#8b5cf6' },
      { key: 'emergency', label: 'Emergency', color: '#f97316' },
      { key: 'dental', label: 'Dental', color: '#06b6d4' },
      { key: 'grooming', label: 'Grooming', color: '#ec4899' },
      { key: 'callback', label: 'Callback', color: '#f59e0b' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'pet_name', label: 'Pet Name', type: 'text' },
      { key: 'species', label: 'Species', type: 'select', options: ['Dog', 'Cat', 'Rabbit', 'Bird', 'Reptile', 'Small Animal', 'Other'] },
      { key: 'breed', label: 'Breed', type: 'text' },
      { key: 'pet_age', label: 'Pet Age', type: 'text' },
      { key: 'weight_kg', label: 'Weight (kg)', type: 'number' },
      { key: 'microchip', label: 'Microchip Number', type: 'text' },
      { key: 'allergies', label: 'Known Allergies', type: 'textarea' },
      { key: 'insurance', label: 'Pet Insurance', type: 'select', options: ['None', 'Petplan', 'Direct Line', 'More Than', 'Other'] },
    ],
  },

  // ═══════════════════════════════════════
  // DENTAL
  // ═══════════════════════════════════════
  dental: {
    stages: [
      { name: 'New Patient', color: '#22c55e', position: 1 },
      { name: 'Assessment Booked', color: '#3b82f6', position: 2 },
      { name: 'Treatment Plan Sent', color: '#8b5cf6', position: 3 },
      { name: 'Treatment Accepted', color: '#06b6d4', position: 4 },
      { name: 'In Treatment', color: '#f59e0b', position: 5 },
      { name: 'Treatment Complete', color: '#10b981', position: 6 },
      { name: 'Recall Due', color: '#f97316', position: 7 },
    ],
    event_types: [
      { key: 'checkup', label: 'Check-up', color: '#3b82f6' },
      { key: 'hygiene', label: 'Hygiene', color: '#22c55e' },
      { key: 'treatment', label: 'Treatment', color: '#8b5cf6' },
      { key: 'consultation', label: 'Consultation', color: '#06b6d4' },
      { key: 'emergency', label: 'Emergency', color: '#ef4444' },
      { key: 'cosmetic', label: 'Cosmetic', color: '#ec4899' },
      { key: 'xray', label: 'X-Ray', color: '#f59e0b' },
      { key: 'callback', label: 'Callback', color: '#f97316' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'nhs_number', label: 'NHS Number', type: 'text' },
      { key: 'patient_type', label: 'Patient Type', type: 'select', options: ['NHS', 'Private', 'NHS Exempt', 'Plan Member'] },
      { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
      { key: 'medical_conditions', label: 'Medical Conditions', type: 'textarea' },
      { key: 'allergies', label: 'Allergies', type: 'textarea' },
      { key: 'last_xray', label: 'Last X-Ray Date', type: 'date' },
      { key: 'dentist', label: 'Assigned Dentist', type: 'text' },
    ],
  },

  // ═══════════════════════════════════════
  // SALON / BEAUTY
  // ═══════════════════════════════════════
  salon: {
    stages: [
      { name: 'New Client', color: '#22c55e', position: 1 },
      { name: 'Consultation Booked', color: '#ec4899', position: 2 },
      { name: 'Patch Test Done', color: '#8b5cf6', position: 3 },
      { name: 'Regular Client', color: '#06b6d4', position: 4 },
      { name: 'VIP Client', color: '#f59e0b', position: 5 },
      { name: 'Inactive', color: '#6b7280', position: 6 },
    ],
    event_types: [
      { key: 'cut', label: 'Cut', color: '#3b82f6' },
      { key: 'colour', label: 'Colour', color: '#ec4899' },
      { key: 'treatment', label: 'Treatment', color: '#8b5cf6' },
      { key: 'consultation', label: 'Consultation', color: '#f59e0b' },
      { key: 'nails', label: 'Nails', color: '#f97316' },
      { key: 'facial', label: 'Facial', color: '#14b8a6' },
      { key: 'wax', label: 'Waxing', color: '#06b6d4' },
      { key: 'callback', label: 'Callback', color: '#22c55e' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'hair_type', label: 'Hair Type', type: 'select', options: ['Straight', 'Wavy', 'Curly', 'Coily', 'N/A'] },
      { key: 'colour_history', label: 'Colour History', type: 'textarea' },
      { key: 'allergies', label: 'Allergies / Sensitivities', type: 'textarea' },
      { key: 'patch_test_date', label: 'Last Patch Test', type: 'date' },
      { key: 'preferred_stylist', label: 'Preferred Stylist', type: 'text' },
      { key: 'rebooking', label: 'Rebooking Frequency', type: 'select', options: ['4 weeks', '6 weeks', '8 weeks', '12 weeks', 'Ad hoc'] },
    ],
  },

  // ═══════════════════════════════════════
  // BARBER
  // ═══════════════════════════════════════
  barber: {
    stages: [
      { name: 'New Client', color: '#22c55e', position: 1 },
      { name: 'Regular', color: '#3b82f6', position: 2 },
      { name: 'VIP', color: '#f59e0b', position: 3 },
      { name: 'Inactive', color: '#6b7280', position: 4 },
    ],
    event_types: [
      { key: 'cut', label: 'Haircut', color: '#3b82f6' },
      { key: 'cut_beard', label: 'Cut & Beard', color: '#8b5cf6' },
      { key: 'beard', label: 'Beard Trim', color: '#f59e0b' },
      { key: 'shave', label: 'Hot Towel Shave', color: '#14b8a6' },
      { key: 'colour', label: 'Colour', color: '#ec4899' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'preferred_barber', label: 'Preferred Barber', type: 'text' },
      { key: 'usual_style', label: 'Usual Style / Notes', type: 'textarea' },
      { key: 'frequency', label: 'Visit Frequency', type: 'select', options: ['Weekly', '2 weeks', '3 weeks', '4 weeks', '6 weeks', 'Ad hoc'] },
    ],
  },

  // ═══════════════════════════════════════
  // PERSONAL TRAINER / FITNESS
  // ═══════════════════════════════════════
  personal_trainer: {
    stages: [
      { name: 'New Lead', color: '#22c55e', position: 1 },
      { name: 'Consultation Booked', color: '#3b82f6', position: 2 },
      { name: 'Trial Session', color: '#8b5cf6', position: 3 },
      { name: 'Active Client', color: '#06b6d4', position: 4 },
      { name: 'Package Expiring', color: '#f59e0b', position: 5 },
      { name: 'Paused', color: '#f97316', position: 6 },
      { name: 'Inactive', color: '#6b7280', position: 7 },
    ],
    event_types: [
      { key: 'session', label: 'PT Session', color: '#3b82f6' },
      { key: 'consultation', label: 'Consultation', color: '#8b5cf6' },
      { key: 'assessment', label: 'Fitness Assessment', color: '#f59e0b' },
      { key: 'group', label: 'Group Session', color: '#22c55e' },
      { key: 'online', label: 'Online Session', color: '#06b6d4' },
      { key: 'callback', label: 'Callback', color: '#f97316' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'goal', label: 'Fitness Goal', type: 'select', options: ['Weight Loss', 'Muscle Gain', 'General Fitness', 'Rehab', 'Sports Performance', 'Flexibility', 'Other'] },
      { key: 'medical_conditions', label: 'Medical Conditions / Injuries', type: 'textarea' },
      { key: 'experience', label: 'Training Experience', type: 'select', options: ['Complete Beginner', 'Some Experience', 'Intermediate', 'Advanced'] },
      { key: 'sessions_per_week', label: 'Sessions Per Week', type: 'select', options: ['1', '2', '3', '4', '5+'] },
      { key: 'package', label: 'Package', type: 'select', options: ['Pay As You Go', '5 Sessions', '10 Sessions', '20 Sessions', 'Monthly Unlimited'] },
      { key: 'sessions_remaining', label: 'Sessions Remaining', type: 'number' },
    ],
  },

  // ═══════════════════════════════════════
  // PHOTOGRAPHER
  // ═══════════════════════════════════════
  photographer: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'Consultation', color: '#3b82f6', position: 2 },
      { name: 'Quote Sent', color: '#8b5cf6', position: 3 },
      { name: 'Deposit Paid', color: '#06b6d4', position: 4 },
      { name: 'Shoot Booked', color: '#f59e0b', position: 5 },
      { name: 'Editing', color: '#14b8a6', position: 6 },
      { name: 'Gallery Delivered', color: '#10b981', position: 7 },
      { name: 'Complete', color: '#059669', position: 8 },
      { name: 'Lost', color: '#ef4444', position: 9 },
    ],
    event_types: [
      { key: 'shoot', label: 'Photo Shoot', color: '#3b82f6' },
      { key: 'consultation', label: 'Consultation', color: '#8b5cf6' },
      { key: 'wedding', label: 'Wedding', color: '#ec4899' },
      { key: 'event', label: 'Event Coverage', color: '#f59e0b' },
      { key: 'editing', label: 'Editing Session', color: '#14b8a6' },
      { key: 'delivery', label: 'Gallery Delivery', color: '#22c55e' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'shoot_type', label: 'Shoot Type', type: 'select', options: ['Wedding', 'Portrait', 'Family', 'Newborn', 'Event', 'Commercial', 'Product', 'Property', 'Other'] },
      { key: 'shoot_date', label: 'Shoot Date', type: 'date' },
      { key: 'location', label: 'Shoot Location', type: 'text' },
      { key: 'package', label: 'Package', type: 'text' },
      { key: 'special_requests', label: 'Special Requests', type: 'textarea' },
      { key: 'referral_source', label: 'How Found Us', type: 'select', options: ['Instagram', 'Google', 'Referral', 'Wedding Fair', 'Facebook', 'Other'] },
    ],
  },

  // ═══════════════════════════════════════
  // WEDDING PLANNER
  // ═══════════════════════════════════════
  wedding_planner: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'Consultation', color: '#ec4899', position: 2 },
      { name: 'Proposal Sent', color: '#8b5cf6', position: 3 },
      { name: 'Deposit Paid', color: '#06b6d4', position: 4 },
      { name: 'Planning', color: '#f59e0b', position: 5 },
      { name: 'Final Details', color: '#14b8a6', position: 6 },
      { name: 'Wedding Day', color: '#f97316', position: 7 },
      { name: 'Post-Wedding', color: '#10b981', position: 8 },
      { name: 'Lost', color: '#ef4444', position: 9 },
    ],
    event_types: [
      { key: 'consultation', label: 'Consultation', color: '#ec4899' },
      { key: 'venue_visit', label: 'Venue Visit', color: '#3b82f6' },
      { key: 'tasting', label: 'Tasting', color: '#f59e0b' },
      { key: 'rehearsal', label: 'Rehearsal', color: '#8b5cf6' },
      { key: 'wedding_day', label: 'Wedding Day', color: '#ef4444' },
      { key: 'supplier_meeting', label: 'Supplier Meeting', color: '#14b8a6' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'wedding_date', label: 'Wedding Date', type: 'date' },
      { key: 'venue', label: 'Venue', type: 'text' },
      { key: 'guest_count', label: 'Guest Count', type: 'number' },
      { key: 'budget', label: 'Budget (£)', type: 'number' },
      { key: 'package', label: 'Package', type: 'select', options: ['On the Day', 'Partial Planning', 'Full Planning', 'Bespoke'] },
      { key: 'style', label: 'Wedding Style', type: 'select', options: ['Classic', 'Rustic', 'Modern', 'Bohemian', 'Vintage', 'Destination', 'Other'] },
    ],
  },

  // ═══════════════════════════════════════
  // DOG GROOMER
  // ═══════════════════════════════════════
  dog_groomer: {
    stages: [
      { name: 'New Client', color: '#22c55e', position: 1 },
      { name: 'First Groom Booked', color: '#3b82f6', position: 2 },
      { name: 'Regular Client', color: '#06b6d4', position: 3 },
      { name: 'VIP', color: '#f59e0b', position: 4 },
      { name: 'Inactive', color: '#6b7280', position: 5 },
    ],
    event_types: [
      { key: 'full_groom', label: 'Full Groom', color: '#3b82f6' },
      { key: 'bath_dry', label: 'Bath & Dry', color: '#22c55e' },
      { key: 'puppy_groom', label: 'Puppy Intro Groom', color: '#ec4899' },
      { key: 'nail_trim', label: 'Nail Trim', color: '#f59e0b' },
      { key: 'hand_strip', label: 'Hand Stripping', color: '#8b5cf6' },
      { key: 'deshed', label: 'De-shed Treatment', color: '#14b8a6' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'dog_name', label: 'Dog Name', type: 'text' },
      { key: 'breed', label: 'Breed', type: 'text' },
      { key: 'dog_age', label: 'Dog Age', type: 'text' },
      { key: 'weight', label: 'Weight (kg)', type: 'number' },
      { key: 'temperament', label: 'Temperament', type: 'select', options: ['Calm', 'Nervous', 'Excitable', 'Aggressive', 'Puppy'] },
      { key: 'allergies', label: 'Allergies / Skin Issues', type: 'textarea' },
      { key: 'vaccination_status', label: 'Vaccinations Up to Date', type: 'select', options: ['Yes', 'No', 'Unknown'] },
      { key: 'groom_frequency', label: 'Groom Frequency', type: 'select', options: ['4 weeks', '6 weeks', '8 weeks', '12 weeks', 'Ad hoc'] },
    ],
  },

  // ═══════════════════════════════════════
  // DOG WALKER / PET SITTER
  // ═══════════════════════════════════════
  dog_walker: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'Meet & Greet Booked', color: '#3b82f6', position: 2 },
      { name: 'Trial Walk', color: '#8b5cf6', position: 3 },
      { name: 'Regular Client', color: '#06b6d4', position: 4 },
      { name: 'Paused', color: '#f59e0b', position: 5 },
      { name: 'Inactive', color: '#6b7280', position: 6 },
    ],
    event_types: [
      { key: 'group_walk', label: 'Group Walk', color: '#22c55e' },
      { key: 'solo_walk', label: 'Solo Walk', color: '#3b82f6' },
      { key: 'pet_sitting', label: 'Pet Sitting', color: '#8b5cf6' },
      { key: 'boarding', label: 'Overnight Boarding', color: '#f59e0b' },
      { key: 'meet_greet', label: 'Meet & Greet', color: '#ec4899' },
      { key: 'pop_in', label: 'Pop-in Visit', color: '#14b8a6' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'dog_name', label: 'Dog Name', type: 'text' },
      { key: 'breed', label: 'Breed', type: 'text' },
      { key: 'dog_age', label: 'Dog Age', type: 'text' },
      { key: 'temperament', label: 'Temperament', type: 'select', options: ['Friendly', 'Nervous', 'Reactive', 'Puppy', 'Elderly'] },
      { key: 'recall', label: 'Recall', type: 'select', options: ['Excellent', 'Good', 'Poor', 'No off-lead'] },
      { key: 'walk_frequency', label: 'Walk Frequency', type: 'select', options: ['Daily', '3x Week', '2x Week', 'Occasional'] },
      { key: 'key_location', label: 'Key Location', type: 'text' },
      { key: 'vet_details', label: 'Vet Details', type: 'text' },
      { key: 'special_needs', label: 'Special Needs / Medication', type: 'textarea' },
    ],
  },

  // ═══════════════════════════════════════
  // DRIVING INSTRUCTOR
  // ═══════════════════════════════════════
  driving_instructor: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'First Lesson Booked', color: '#3b82f6', position: 2 },
      { name: 'Learning', color: '#8b5cf6', position: 3 },
      { name: 'Test Ready', color: '#f59e0b', position: 4 },
      { name: 'Test Booked', color: '#06b6d4', position: 5 },
      { name: 'Passed', color: '#10b981', position: 6 },
      { name: 'Dropped Out', color: '#ef4444', position: 7 },
    ],
    event_types: [
      { key: 'lesson', label: 'Driving Lesson', color: '#3b82f6' },
      { key: 'assessment', label: 'Assessment Lesson', color: '#8b5cf6' },
      { key: 'mock_test', label: 'Mock Test', color: '#f59e0b' },
      { key: 'test_day', label: 'Test Day', color: '#ef4444' },
      { key: 'motorway', label: 'Motorway Lesson', color: '#22c55e' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'licence_type', label: 'Licence Type', type: 'select', options: ['Provisional', 'Full (Refresher)', 'International'] },
      { key: 'experience', label: 'Experience', type: 'select', options: ['Complete Beginner', 'Some Lessons', 'Previous Test Fail', 'Experienced (Refresher)'] },
      { key: 'test_centre', label: 'Preferred Test Centre', type: 'text' },
      { key: 'test_date', label: 'Test Date', type: 'date' },
      { key: 'theory_passed', label: 'Theory Test Passed', type: 'select', options: ['Yes', 'No', 'Not Yet Taken'] },
      { key: 'lessons_completed', label: 'Lessons Completed', type: 'number' },
      { key: 'transmission', label: 'Transmission', type: 'select', options: ['Manual', 'Automatic'] },
    ],
  },

  // ═══════════════════════════════════════
  // TUTOR / EDUCATION
  // ═══════════════════════════════════════
  tutor: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'Assessment Booked', color: '#3b82f6', position: 2 },
      { name: 'Trial Lesson', color: '#8b5cf6', position: 3 },
      { name: 'Active Student', color: '#06b6d4', position: 4 },
      { name: 'Exam Prep', color: '#f59e0b', position: 5 },
      { name: 'Paused', color: '#f97316', position: 6 },
      { name: 'Completed', color: '#10b981', position: 7 },
    ],
    event_types: [
      { key: 'lesson', label: 'Lesson', color: '#3b82f6' },
      { key: 'assessment', label: 'Assessment', color: '#8b5cf6' },
      { key: 'mock_exam', label: 'Mock Exam', color: '#f59e0b' },
      { key: 'parent_meeting', label: 'Parent Meeting', color: '#22c55e' },
      { key: 'online_lesson', label: 'Online Lesson', color: '#06b6d4' },
      { key: 'group_session', label: 'Group Session', color: '#14b8a6' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'student_name', label: 'Student Name', type: 'text' },
      { key: 'student_age', label: 'Student Age / Year', type: 'text' },
      { key: 'subject', label: 'Subject', type: 'select', options: ['Maths', 'English', 'Science', 'Physics', 'Chemistry', 'Biology', 'Languages', '11+', 'GCSE', 'A-Level', 'Other'] },
      { key: 'exam_board', label: 'Exam Board', type: 'select', options: ['AQA', 'Edexcel', 'OCR', 'WJEC', 'N/A'] },
      { key: 'lesson_frequency', label: 'Lesson Frequency', type: 'select', options: ['Weekly', 'Twice Weekly', 'Fortnightly', 'Ad hoc'] },
      { key: 'lesson_format', label: 'Lesson Format', type: 'select', options: ['In-person', 'Online', 'Mix'] },
      { key: 'goals', label: 'Learning Goals', type: 'textarea' },
    ],
  },

  // ═══════════════════════════════════════
  // ACCOUNTANT / BOOKKEEPER
  // ═══════════════════════════════════════
  accountant: {
    stages: [
      { name: 'New Lead', color: '#22c55e', position: 1 },
      { name: 'Discovery Call', color: '#3b82f6', position: 2 },
      { name: 'Proposal Sent', color: '#8b5cf6', position: 3 },
      { name: 'Onboarding', color: '#06b6d4', position: 4 },
      { name: 'Active Client', color: '#10b981', position: 5 },
      { name: 'Year End Due', color: '#f59e0b', position: 6 },
      { name: 'Lost', color: '#ef4444', position: 7 },
    ],
    event_types: [
      { key: 'meeting', label: 'Client Meeting', color: '#3b82f6' },
      { key: 'call', label: 'Phone Call', color: '#8b5cf6' },
      { key: 'year_end', label: 'Year End', color: '#ef4444' },
      { key: 'vat_return', label: 'VAT Return', color: '#f59e0b' },
      { key: 'payroll', label: 'Payroll Run', color: '#22c55e' },
      { key: 'tax_return', label: 'Tax Return', color: '#f97316' },
      { key: 'onboarding', label: 'Onboarding', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'business_type', label: 'Business Type', type: 'select', options: ['Sole Trader', 'Ltd Company', 'Partnership', 'LLP', 'Charity', 'Personal'] },
      { key: 'company_number', label: 'Company Number', type: 'text' },
      { key: 'utr', label: 'UTR Number', type: 'text' },
      { key: 'vat_registered', label: 'VAT Registered', type: 'select', options: ['Yes', 'No', 'Flat Rate'] },
      { key: 'year_end_date', label: 'Year End Date', type: 'date' },
      { key: 'accounting_software', label: 'Accounting Software', type: 'select', options: ['Xero', 'QuickBooks', 'FreeAgent', 'Sage', 'Spreadsheets', 'None'] },
      { key: 'services', label: 'Services Required', type: 'textarea' },
    ],
  },

  // ═══════════════════════════════════════
  // SOLICITOR / LAW
  // ═══════════════════════════════════════
  solicitor: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'Initial Consultation', color: '#3b82f6', position: 2 },
      { name: 'Quote Sent', color: '#8b5cf6', position: 3 },
      { name: 'Instructed', color: '#06b6d4', position: 4 },
      { name: 'In Progress', color: '#f59e0b', position: 5 },
      { name: 'Awaiting Third Party', color: '#f97316', position: 6 },
      { name: 'Completed', color: '#10b981', position: 7 },
      { name: 'Lost', color: '#ef4444', position: 8 },
    ],
    event_types: [
      { key: 'consultation', label: 'Consultation', color: '#3b82f6' },
      { key: 'court', label: 'Court Hearing', color: '#ef4444' },
      { key: 'meeting', label: 'Client Meeting', color: '#8b5cf6' },
      { key: 'exchange', label: 'Exchange', color: '#22c55e' },
      { key: 'completion', label: 'Completion', color: '#10b981' },
      { key: 'callback', label: 'Callback', color: '#f59e0b' },
      { key: 'deadline', label: 'Deadline', color: '#f97316' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'matter_type', label: 'Matter Type', type: 'select', options: ['Conveyancing', 'Family', 'Wills & Probate', 'Personal Injury', 'Employment', 'Commercial', 'Immigration', 'Criminal', 'Other'] },
      { key: 'matter_ref', label: 'Matter Reference', type: 'text' },
      { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
      { key: 'id_verified', label: 'ID Verified', type: 'select', options: ['Yes', 'No', 'Pending'] },
      { key: 'funding', label: 'Funding', type: 'select', options: ['Private', 'Legal Aid', 'No Win No Fee', 'Insurance'] },
    ],
  },

  // ═══════════════════════════════════════
  // CATERING
  // ═══════════════════════════════════════
  catering: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'Menu Discussion', color: '#3b82f6', position: 2 },
      { name: 'Quote Sent', color: '#8b5cf6', position: 3 },
      { name: 'Deposit Paid', color: '#06b6d4', position: 4 },
      { name: 'Planning', color: '#f59e0b', position: 5 },
      { name: 'Event Day', color: '#f97316', position: 6 },
      { name: 'Completed', color: '#10b981', position: 7 },
      { name: 'Lost', color: '#ef4444', position: 8 },
    ],
    event_types: [
      { key: 'tasting', label: 'Tasting Session', color: '#ec4899' },
      { key: 'consultation', label: 'Consultation', color: '#3b82f6' },
      { key: 'event', label: 'Event Catering', color: '#f59e0b' },
      { key: 'prep', label: 'Prep Day', color: '#8b5cf6' },
      { key: 'delivery', label: 'Delivery', color: '#22c55e' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'event_type', label: 'Event Type', type: 'select', options: ['Wedding', 'Corporate', 'Birthday', 'Funeral', 'Christening', 'BBQ', 'Buffet', 'Other'] },
      { key: 'event_date', label: 'Event Date', type: 'date' },
      { key: 'guest_count', label: 'Guest Count', type: 'number' },
      { key: 'budget_per_head', label: 'Budget Per Head (£)', type: 'number' },
      { key: 'dietary', label: 'Dietary Requirements', type: 'textarea' },
      { key: 'venue', label: 'Venue / Location', type: 'text' },
    ],
  },

  // ═══════════════════════════════════════
  // TATTOO ARTIST
  // ═══════════════════════════════════════
  tattoo: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'Consultation', color: '#3b82f6', position: 2 },
      { name: 'Design In Progress', color: '#8b5cf6', position: 3 },
      { name: 'Deposit Paid', color: '#06b6d4', position: 4 },
      { name: 'Session Booked', color: '#f59e0b', position: 5 },
      { name: 'In Progress (Multi)', color: '#14b8a6', position: 6 },
      { name: 'Completed', color: '#10b981', position: 7 },
      { name: 'Lost', color: '#ef4444', position: 8 },
    ],
    event_types: [
      { key: 'session', label: 'Tattoo Session', color: '#3b82f6' },
      { key: 'consultation', label: 'Consultation', color: '#8b5cf6' },
      { key: 'touch_up', label: 'Touch Up', color: '#22c55e' },
      { key: 'cover_up', label: 'Cover Up', color: '#f97316' },
      { key: 'piercing', label: 'Piercing', color: '#ec4899' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'design_description', label: 'Design Description', type: 'textarea' },
      { key: 'placement', label: 'Placement', type: 'text' },
      { key: 'size', label: 'Size', type: 'select', options: ['Small (< 5cm)', 'Medium (5-15cm)', 'Large (15-30cm)', 'Extra Large / Sleeve', 'Full Back'] },
      { key: 'style', label: 'Style', type: 'select', options: ['Traditional', 'Neo-Traditional', 'Realism', 'Blackwork', 'Geometric', 'Watercolour', 'Japanese', 'Tribal', 'Lettering', 'Other'] },
      { key: 'estimated_sessions', label: 'Estimated Sessions', type: 'number' },
      { key: 'allergies', label: 'Allergies / Medical', type: 'textarea' },
    ],
  },

  // ═══════════════════════════════════════
  // MOBILE MECHANIC
  // ═══════════════════════════════════════
  mechanic: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'Diagnostic Booked', color: '#3b82f6', position: 2 },
      { name: 'Quote Sent', color: '#8b5cf6', position: 3 },
      { name: 'Parts Ordered', color: '#f59e0b', position: 4 },
      { name: 'Repair Booked', color: '#06b6d4', position: 5 },
      { name: 'Completed', color: '#10b981', position: 6 },
      { name: 'Lost', color: '#ef4444', position: 7 },
    ],
    event_types: [
      { key: 'diagnostic', label: 'Diagnostic', color: '#3b82f6' },
      { key: 'service', label: 'Service', color: '#22c55e' },
      { key: 'repair', label: 'Repair', color: '#8b5cf6' },
      { key: 'mot_prep', label: 'MOT Prep', color: '#f59e0b' },
      { key: 'breakdown', label: 'Breakdown', color: '#ef4444' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'vehicle_reg', label: 'Vehicle Registration', type: 'text' },
      { key: 'vehicle_make', label: 'Make', type: 'text' },
      { key: 'vehicle_model', label: 'Model', type: 'text' },
      { key: 'vehicle_year', label: 'Year', type: 'number' },
      { key: 'mileage', label: 'Mileage', type: 'number' },
      { key: 'mot_due', label: 'MOT Due Date', type: 'date' },
      { key: 'service_history', label: 'Service History Notes', type: 'textarea' },
    ],
  },

  // ═══════════════════════════════════════
  // RETAIL
  // ═══════════════════════════════════════
  retail: {
    stages: [
      { name: 'New Lead', color: '#22c55e', position: 1 },
      { name: 'Interested', color: '#3b82f6', position: 2 },
      { name: 'Quote Requested', color: '#8b5cf6', position: 3 },
      { name: 'Order Placed', color: '#06b6d4', position: 4 },
      { name: 'Processing', color: '#f59e0b', position: 5 },
      { name: 'Dispatched', color: '#14b8a6', position: 6 },
      { name: 'Delivered', color: '#10b981', position: 7 },
      { name: 'Returned', color: '#ef4444', position: 8 },
    ],
    event_types: [
      { key: 'delivery', label: 'Delivery', color: '#22c55e' },
      { key: 'collection', label: 'Collection', color: '#3b82f6' },
      { key: 'consultation', label: 'Consultation', color: '#8b5cf6' },
      { key: 'fitting', label: 'Fitting/Install', color: '#f97316' },
      { key: 'callback', label: 'Callback', color: '#f59e0b' },
      { key: 'return', label: 'Return/Exchange', color: '#ef4444' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'customer_type', label: 'Customer Type', type: 'select', options: ['Retail', 'Trade', 'Wholesale', 'VIP'] },
      { key: 'company_name', label: 'Company Name', type: 'text' },
      { key: 'vat_number', label: 'VAT Number', type: 'text' },
      { key: 'delivery_address', label: 'Delivery Address', type: 'textarea' },
      { key: 'preferred_contact', label: 'Preferred Contact Method', type: 'select', options: ['Phone', 'Email', 'WhatsApp', 'Text'] },
    ],
  },

  // ═══════════════════════════════════════
  // PHYSIOTHERAPY / OSTEOPATH
  // ═══════════════════════════════════════
  physio: {
    stages: [
      { name: 'New Patient', color: '#22c55e', position: 1 },
      { name: 'Assessment Booked', color: '#3b82f6', position: 2 },
      { name: 'Treatment Plan', color: '#8b5cf6', position: 3 },
      { name: 'Active Treatment', color: '#06b6d4', position: 4 },
      { name: 'Maintenance', color: '#f59e0b', position: 5 },
      { name: 'Discharged', color: '#10b981', position: 6 },
      { name: 'Did Not Attend', color: '#ef4444', position: 7 },
    ],
    event_types: [
      { key: 'assessment', label: 'Initial Assessment', color: '#3b82f6' },
      { key: 'treatment', label: 'Treatment Session', color: '#8b5cf6' },
      { key: 'follow_up', label: 'Follow Up', color: '#f59e0b' },
      { key: 'sports_massage', label: 'Sports Massage', color: '#22c55e' },
      { key: 'rehab', label: 'Rehab Session', color: '#14b8a6' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
      { key: 'condition', label: 'Presenting Condition', type: 'textarea' },
      { key: 'referred_by', label: 'Referred By', type: 'select', options: ['GP', 'Consultant', 'Self', 'Insurance', 'Other'] },
      { key: 'medical_history', label: 'Medical History', type: 'textarea' },
      { key: 'medications', label: 'Current Medications', type: 'textarea' },
      { key: 'insurance', label: 'Insurance Provider', type: 'select', options: ['None (Self-pay)', 'BUPA', 'AXA', 'Vitality', 'Aviva', 'Other'] },
      { key: 'sessions_remaining', label: 'Sessions Remaining', type: 'number' },
    ],
  },

  // ═══════════════════════════════════════
  // SKIP HIRE / WASTE
  // ═══════════════════════════════════════
  skip_hire: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'Quote Sent', color: '#3b82f6', position: 2 },
      { name: 'Booked', color: '#8b5cf6', position: 3 },
      { name: 'Delivered', color: '#06b6d4', position: 4 },
      { name: 'On Hire', color: '#f59e0b', position: 5 },
      { name: 'Collection Due', color: '#f97316', position: 6 },
      { name: 'Collected', color: '#10b981', position: 7 },
      { name: 'Lost', color: '#ef4444', position: 8 },
    ],
    event_types: [
      { key: 'delivery', label: 'Skip Delivery', color: '#3b82f6' },
      { key: 'collection', label: 'Skip Collection', color: '#22c55e' },
      { key: 'swap', label: 'Skip Swap', color: '#8b5cf6' },
      { key: 'site_visit', label: 'Site Visit', color: '#f59e0b' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'skip_size', label: 'Skip Size', type: 'select', options: ['2 Yard Mini', '4 Yard Midi', '6 Yard', '8 Yard', '12 Yard', '16 Yard Roll-on', '20 Yard Roll-on', '40 Yard Roll-on'] },
      { key: 'waste_type', label: 'Waste Type', type: 'select', options: ['General', 'Heavy/Soil', 'Clean Timber', 'Mixed', 'Plasterboard', 'Asbestos'] },
      { key: 'permit_needed', label: 'Permit Needed', type: 'select', options: ['Yes (public road)', 'No (private land)'] },
      { key: 'hire_duration', label: 'Hire Duration', type: 'select', options: ['1-2 Days', '1 Week', '2 Weeks', '4 Weeks', 'Ongoing'] },
      { key: 'delivery_address', label: 'Delivery Address', type: 'textarea' },
      { key: 'access_notes', label: 'Access Notes', type: 'textarea' },
    ],
  },

  // ═══════════════════════════════════════
  // SECURITY / CCTV
  // ═══════════════════════════════════════
  security: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'Site Survey Booked', color: '#3b82f6', position: 2 },
      { name: 'Quote Sent', color: '#8b5cf6', position: 3 },
      { name: 'Awaiting Response', color: '#f59e0b', position: 4 },
      { name: 'Installation Booked', color: '#06b6d4', position: 5 },
      { name: 'Installed', color: '#10b981', position: 6 },
      { name: 'Monitoring', color: '#14b8a6', position: 7 },
      { name: 'Lost', color: '#ef4444', position: 8 },
    ],
    event_types: [
      { key: 'survey', label: 'Site Survey', color: '#3b82f6' },
      { key: 'installation', label: 'Installation', color: '#8b5cf6' },
      { key: 'service', label: 'Service / Maintenance', color: '#f59e0b' },
      { key: 'callout', label: 'Callout', color: '#ef4444' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'property_type', label: 'Property Type', type: 'select', options: ['Residential', 'Commercial', 'Industrial', 'Retail', 'Other'] },
      { key: 'system_type', label: 'System Type', type: 'select', options: ['CCTV', 'Alarm', 'Access Control', 'Intercom', 'Fire', 'Combined'] },
      { key: 'cameras_count', label: 'Number of Cameras', type: 'number' },
      { key: 'monitoring', label: 'Monitoring Required', type: 'select', options: ['Self-monitored', '24/7 Monitoring', 'Keyholder Only', 'TBC'] },
      { key: 'existing_system', label: 'Existing System', type: 'select', options: ['None', 'Upgrade Needed', 'Working - Adding', 'Faulty'] },
    ],
  },

  // ═══════════════════════════════════════
  // IT SUPPORT / WEB DESIGN
  // ═══════════════════════════════════════
  it_support: {
    stages: [
      { name: 'New Lead', color: '#22c55e', position: 1 },
      { name: 'Discovery Call', color: '#3b82f6', position: 2 },
      { name: 'Proposal Sent', color: '#8b5cf6', position: 3 },
      { name: 'Negotiation', color: '#f59e0b', position: 4 },
      { name: 'Onboarding', color: '#06b6d4', position: 5 },
      { name: 'Active Client', color: '#10b981', position: 6 },
      { name: 'Support Contract', color: '#14b8a6', position: 7 },
      { name: 'Lost', color: '#ef4444', position: 8 },
    ],
    event_types: [
      { key: 'call', label: 'Support Call', color: '#3b82f6' },
      { key: 'meeting', label: 'Meeting', color: '#8b5cf6' },
      { key: 'onsite', label: 'On-Site Visit', color: '#f59e0b' },
      { key: 'project', label: 'Project Work', color: '#22c55e' },
      { key: 'maintenance', label: 'Maintenance', color: '#14b8a6' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'business_type', label: 'Business Type', type: 'text' },
      { key: 'employees', label: 'Number of Employees', type: 'select', options: ['1-5', '6-10', '11-25', '26-50', '51-100', '100+'] },
      { key: 'services_needed', label: 'Services Needed', type: 'select', options: ['Website', 'IT Support', 'Cloud Migration', 'Cybersecurity', 'Phone System', 'Managed Services', 'Other'] },
      { key: 'current_setup', label: 'Current Setup', type: 'textarea' },
      { key: 'monthly_budget', label: 'Monthly Budget', type: 'select', options: ['Under £200', '£200-500', '£500-1000', '£1000-2500', '£2500+'] },
    ],
  },

  // ═══════════════════════════════════════
  // FUNERAL DIRECTOR
  // ═══════════════════════════════════════
  funeral_director: {
    stages: [
      { name: 'Initial Call', color: '#6b7280', position: 1 },
      { name: 'Arrangement Meeting', color: '#3b82f6', position: 2 },
      { name: 'Arrangements Made', color: '#8b5cf6', position: 3 },
      { name: 'Awaiting Paperwork', color: '#f59e0b', position: 4 },
      { name: 'Service Scheduled', color: '#06b6d4', position: 5 },
      { name: 'Service Complete', color: '#10b981', position: 6 },
      { name: 'Aftercare', color: '#14b8a6', position: 7 },
    ],
    event_types: [
      { key: 'arrangement', label: 'Arrangement Meeting', color: '#3b82f6' },
      { key: 'funeral', label: 'Funeral Service', color: '#6b7280' },
      { key: 'cremation', label: 'Cremation', color: '#8b5cf6' },
      { key: 'burial', label: 'Burial', color: '#14b8a6' },
      { key: 'viewing', label: 'Viewing / Chapel', color: '#f59e0b' },
      { key: 'collection', label: 'Collection', color: '#f97316' },
      { key: 'memorial', label: 'Memorial Service', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'deceased_name', label: 'Name of Deceased', type: 'text' },
      { key: 'date_of_death', label: 'Date of Death', type: 'date' },
      { key: 'service_type', label: 'Service Type', type: 'select', options: ['Burial', 'Cremation', 'Direct Cremation', 'Direct Burial', 'Memorial Only'] },
      { key: 'venue', label: 'Church / Venue', type: 'text' },
      { key: 'service_date', label: 'Service Date', type: 'date' },
      { key: 'flowers', label: 'Flowers', type: 'select', options: ['Family arranging', 'We arrange', 'None', 'Donations instead'] },
      { key: 'obituary', label: 'Obituary Notes', type: 'textarea' },
    ],
  },

  // ═══════════════════════════════════════
  // GENERIC / DEFAULT
  // ═══════════════════════════════════════
  default: {
    stages: [
      { name: 'New Lead', color: '#22c55e', position: 1 },
      { name: 'Contacted', color: '#3b82f6', position: 2 },
      { name: 'Proposal Sent', color: '#8b5cf6', position: 3 },
      { name: 'Negotiation', color: '#f59e0b', position: 4 },
      { name: 'Won', color: '#10b981', position: 5 },
      { name: 'Lost', color: '#ef4444', position: 6 },
    ],
    event_types: [
      { key: 'meeting', label: 'Meeting', color: '#3b82f6' },
      { key: 'call', label: 'Call', color: '#8b5cf6' },
      { key: 'follow_up', label: 'Follow Up', color: '#f59e0b' },
      { key: 'site_visit', label: 'Site Visit', color: '#22c55e' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'company_name', label: 'Company Name', type: 'text' },
      { key: 'job_title', label: 'Job Title', type: 'text' },
      { key: 'preferred_contact', label: 'Preferred Contact', type: 'select', options: ['Phone', 'Email', 'WhatsApp'] },
    ],
  },
};

// ═══════════════════════════════════════
// ALIASES — map variations to main keys
// ═══════════════════════════════════════
const aliases: Record<string, string> = {
  trades: 'plumber',
  heating: 'plumber',
  gas_engineer: 'plumber',
  boiler: 'plumber',
  electrical: 'electrician',
  sparky: 'electrician',
  construction: 'builder',
  contractor: 'builder',
  decorator: 'painter',
  painting: 'painter',
  roofing: 'roofer',
  guttering: 'roofer',
  landscape: 'gardener',
  landscaping: 'gardener',
  lawn_care: 'gardener',
  tree_surgeon: 'gardener',
  carpet: 'flooring',
  carpet_fitter: 'flooring',
  tiler: 'flooring',
  windows: 'window_cleaner',
  window_cleaning: 'window_cleaner',
  diy: 'handyman',
  property_maintenance: 'handyman',
  air_conditioning: 'hvac',
  aircon: 'hvac',
  ac: 'hvac',
  property: 'estate_agent',
  real_estate: 'estate_agent',
  lettings: 'letting_agent',
  rental: 'letting_agent',
  property_management: 'letting_agent',
  cleaner: 'cleaning',
  domestic_cleaning: 'cleaning',
  commercial_cleaning: 'cleaning',
  veterinary: 'vet',
  animal: 'vet',
  dentist: 'dental',
  orthodontist: 'dental',
  hair: 'salon',
  beauty: 'salon',
  hairdresser: 'salon',
  spa: 'salon',
  barbershop: 'barber',
  pt: 'personal_trainer',
  fitness: 'personal_trainer',
  gym: 'personal_trainer',
  yoga: 'personal_trainer',
  pilates: 'personal_trainer',
  photo: 'photographer',
  videographer: 'photographer',
  wedding: 'wedding_planner',
  event_planner: 'wedding_planner',
  events: 'wedding_planner',
  grooming: 'dog_groomer',
  pet_grooming: 'dog_groomer',
  dog_walking: 'dog_walker',
  pet_sitting: 'dog_walker',
  pet_care: 'dog_walker',
  driving_school: 'driving_instructor',
  driving: 'driving_instructor',
  tutoring: 'tutor',
  education: 'tutor',
  teaching: 'tutor',
  bookkeeper: 'accountant',
  bookkeeping: 'accountant',
  tax: 'accountant',
  lawyer: 'solicitor',
  legal: 'solicitor',
  conveyancer: 'solicitor',
  conveyancing: 'solicitor',
  food: 'catering',
  chef: 'catering',
  tattoo_artist: 'tattoo',
  tattooist: 'tattoo',
  piercing: 'tattoo',
  garage: 'mechanic',
  auto: 'mechanic',
  car_repair: 'mechanic',
  mobile_mechanic: 'mechanic',
  mot: 'mechanic',
  shop: 'retail',
  ecommerce: 'retail',
  physiotherapy: 'physio',
  physiotherapist: 'physio',
  osteopath: 'physio',
  chiropractor: 'physio',
  massage: 'physio',
  sports_therapy: 'physio',
  skip: 'skip_hire',
  waste: 'skip_hire',
  rubbish_removal: 'skip_hire',
  junk: 'skip_hire',
  cctv: 'security',
  alarm: 'security',
  access_control: 'security',
  web_design: 'it_support',
  web_developer: 'it_support',
  it: 'it_support',
  tech: 'it_support',
  managed_services: 'it_support',
  funeral: 'funeral_director',
  undertaker: 'funeral_director',
  pest: 'pest_control',
  exterminator: 'pest_control',
  vermin: 'pest_control',
  moving: 'removals',
  movers: 'removals',
  man_and_van: 'removals',
  courier: 'removals',
  lockout: 'locksmith',
  locks: 'locksmith',
};

export function getSeedData(templateType: string): TemplateSeed {
  const key = templateType?.toLowerCase().trim() || 'default';
  // Direct match
  if (seeds[key]) return seeds[key];
  // Alias match
  if (aliases[key] && seeds[aliases[key]]) return seeds[aliases[key]];
  // Fallback
  return seeds.default;
}

export function getAvailableTemplates(): { key: string; label: string }[] {
  return [
    { key: 'removals', label: 'Removals / Man & Van' },
    { key: 'plumber', label: 'Plumber / Gas Engineer' },
    { key: 'electrician', label: 'Electrician' },
    { key: 'builder', label: 'Builder / Contractor' },
    { key: 'painter', label: 'Painter & Decorator' },
    { key: 'roofer', label: 'Roofer' },
    { key: 'locksmith', label: 'Locksmith' },
    { key: 'gardener', label: 'Gardener / Landscaper' },
    { key: 'pest_control', label: 'Pest Control' },
    { key: 'flooring', label: 'Carpet / Flooring' },
    { key: 'window_cleaner', label: 'Window Cleaner' },
    { key: 'handyman', label: 'Handyman' },
    { key: 'hvac', label: 'HVAC / Air Conditioning' },
    { key: 'estate_agent', label: 'Estate Agent' },
    { key: 'letting_agent', label: 'Letting Agent' },
    { key: 'cleaning', label: 'Cleaning' },
    { key: 'vet', label: 'Veterinary' },
    { key: 'dental', label: 'Dental' },
    { key: 'salon', label: 'Salon / Beauty' },
    { key: 'barber', label: 'Barber' },
    { key: 'personal_trainer', label: 'Personal Trainer / Fitness' },
    { key: 'photographer', label: 'Photographer' },
    { key: 'wedding_planner', label: 'Wedding Planner / Events' },
    { key: 'dog_groomer', label: 'Dog Groomer' },
    { key: 'dog_walker', label: 'Dog Walker / Pet Sitter' },
    { key: 'driving_instructor', label: 'Driving Instructor' },
    { key: 'tutor', label: 'Tutor / Education' },
    { key: 'accountant', label: 'Accountant / Bookkeeper' },
    { key: 'solicitor', label: 'Solicitor / Law' },
    { key: 'catering', label: 'Catering' },
    { key: 'tattoo', label: 'Tattoo Artist' },
    { key: 'mechanic', label: 'Mobile Mechanic / Garage' },
    { key: 'retail', label: 'Retail / E-commerce' },
    { key: 'physio', label: 'Physiotherapy / Osteopath' },
    { key: 'skip_hire', label: 'Skip Hire / Waste' },
    { key: 'security', label: 'Security / CCTV' },
    { key: 'it_support', label: 'IT Support / Web Design' },
    { key: 'funeral_director', label: 'Funeral Director' },
    { key: 'default', label: 'Other / General Business' },
  ];
}

export default seeds;