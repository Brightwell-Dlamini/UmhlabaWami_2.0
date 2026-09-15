import {
  Organization,
  User,
  UserRole,
  ShoppingCenter,
  Property,
  Shop,
  Tenant,
  Lease,
  SlaAgreement,
  Ticket,
  TicketComment,
  StaffShift,
  Vendor,
  FinanceTransaction,
  FinancialRequest,
  Announcement,
  EmergencyBroadcast,
  NotificationItem,
  ChatMessage,
  AuditLog,
  PropertyLead,
  SubscriptionConfig,
  TicketPriority,
  TicketCategory,
} from '../types';

const STORAGE_KEY = 'umhlaba_wami_db_v2';

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionConfig[] = [
  {
    tier: 'Starter',
    name: 'Starter Portfolio',
    propertyLimit: 3,
    tenantLimit: 100,
    userLimit: 10,
    storageLimitGb: 10,
    pricePerMonthE: 1450,
    features: ['Up to 3 Properties', '100 Active Tenants', 'Standard SLA Tracking', 'Basic Mobile Ticketing', 'Email Notifications'],
  },
  {
    tier: 'Professional',
    name: 'Professional Multi-Mall',
    propertyLimit: 10,
    tenantLimit: 500,
    userLimit: 50,
    storageLimitGb: 50,
    pricePerMonthE: 3850,
    features: ['Up to 10 Properties', '500 Active Tenants', 'Auto SLA Escalations', 'Staff Rostering Calendar', 'Finance & Sage/QuickBooks Export', 'Priority Support'],
  },
  {
    tier: 'Enterprise',
    name: 'Enterprise Commercial Group',
    propertyLimit: 999,
    tenantLimit: 9999,
    userLimit: 999,
    storageLimitGb: 500,
    pricePerMonthE: 8900,
    features: ['Unlimited Properties & Tenants', 'Custom SLA Multi-tier Rules', 'Vendor Management & Ratings', 'Emergency Broadcast Center', 'Dedicated Account Manager', 'Custom API Integrations'],
  },
];

// Initial Realistic Demo Data for Eswatini
const INITIAL_ORGANIZATIONS: Organization[] = [
  {
    id: 'org_swazi_plaza',
    organization_code: 'SWZ-060926',
    company_name: 'Swazi Plaza Properties Ltd',
    owner_name: 'Mandla Simelane',
    email: 'info@swaziplaza.co.sz',
    phone: '+268 2404 1234',
    address: 'Plaza Complex, Mbabane, Eswatini',
    subscription_tier: 'Enterprise',
    status: 'Active',
    property_limit: 25,
    tenant_limit: 800,
    user_limit: 50,
    storage_limit: 200,
    monthly_fee_estimate: 8900,
    created_at: '2026-08-15T08:00:00Z',
    approved_at: '2026-08-16T10:00:00Z',
    approved_by: 'Super Admin',
    logo_url: 'https://images.unsplash.com/photo-1554469384-e58fac16e23a?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'org_gables_lifestyle',
    organization_code: 'GAB-070826',
    company_name: 'Ezulwini Commercial Holdings',
    owner_name: 'Lindiwe Dlamini',
    email: 'management@ezulwiniproperties.sz',
    phone: '+268 2416 9900',
    address: 'Corner Main Road & Gables Way, Ezulwini Valley',
    subscription_tier: 'Professional',
    status: 'Active',
    property_limit: 10,
    tenant_limit: 500,
    user_limit: 30,
    storage_limit: 50,
    monthly_fee_estimate: 3850,
    created_at: '2026-08-20T09:30:00Z',
    approved_at: '2026-08-21T11:00:00Z',
    approved_by: 'Super Admin',
  },
  {
    id: 'org_riverstone_group',
    organization_code: 'RIV-010926',
    company_name: 'Manzini Riverstone Investments',
    owner_name: 'Khulekani Ginindza',
    email: 'admin@riverstoneholdings.sz',
    phone: '+268 2505 4411',
    address: 'Corner Ngwane & Tenbergen St, Manzini',
    subscription_tier: 'Professional',
    status: 'Pending Approval', // Used to test Approval workflow
    property_limit: 5,
    tenant_limit: 250,
    user_limit: 20,
    storage_limit: 30,
    monthly_fee_estimate: 3100,
    created_at: '2026-09-05T14:15:00Z',
  },
];

const INITIAL_USERS: User[] = [
  {
    id: 'usr_superadmin',
    username: 'superadmin',
    name: 'Phumzile Nhlabatsi',
    email: 'admin@umhlabawami.sz',
    phone: '+268 7602 1100',
    role: 'super_admin',
    status: 'Active',
    avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'usr_client_admin',
    organization_id: 'org_gables_lifestyle',
    username: 'lindiwe.admin',
    name: 'Lindiwe Dlamini (Admin)',
    email: 'lindiwe@ezulwiniproperties.sz',
    phone: '+268 7604 5588',
    role: 'admin',
    shopping_center_id: 'sc_gables',
    status: 'Active',
    avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80',
    created_at: '2026-08-20T10:00:00Z',
  },
  {
    id: 'usr_property_manager',
    organization_id: 'org_gables_lifestyle',
    username: 'sipho.manager',
    name: 'Sipho Dlamini (Property Manager)',
    email: 'sipho@ezulwiniproperties.sz',
    phone: '+268 7611 2233',
    role: 'property_manager',
    shopping_center_id: 'sc_gables',
    property_id: 'prop_gables_retail',
    status: 'Active',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    created_at: '2026-08-21T09:00:00Z',
  },
  {
    id: 'usr_tenant_nandi',
    organization_id: 'org_gables_lifestyle',
    username: 'nandi.tenant',
    name: 'Nandi Khumalo (Swazi Artisan Crafts)',
    email: 'nandi@swaziartisancrafts.sz',
    phone: '+268 7622 9988',
    role: 'tenant',
    shopping_center_id: 'sc_gables',
    property_id: 'prop_gables_retail',
    shop_id: 'shop_g14',
    status: 'Active',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    created_at: '2026-08-22T08:00:00Z',
  },
  {
    id: 'usr_maintenance_bheki',
    organization_id: 'org_gables_lifestyle',
    username: 'bheki.maintenance',
    name: 'Bheki Maseko (Senior Facilities Tech)',
    email: 'bheki@ezulwiniproperties.sz',
    phone: '+268 7633 4455',
    role: 'maintenance',
    shopping_center_id: 'sc_gables',
    property_id: 'prop_gables_retail',
    status: 'Active',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    created_at: '2026-08-21T09:30:00Z',
  },
  {
    id: 'usr_finance_thandeka',
    organization_id: 'org_gables_lifestyle',
    username: 'thandeka.finance',
    name: 'Thandeka Nxumalo (Finance Lead)',
    email: 'thandeka@ezulwiniproperties.sz',
    phone: '+268 7644 6677',
    role: 'finance',
    shopping_center_id: 'sc_gables',
    status: 'Active',
    avatar_url: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=200&q=80',
    created_at: '2026-08-21T10:00:00Z',
  },
];

const INITIAL_SHOPPING_CENTERS: ShoppingCenter[] = [
  {
    id: 'sc_gables',
    organization_id: 'org_gables_lifestyle',
    name: 'The Gables Shopping Centre',
    address: 'Old MR3 Highway, Ezulwini Valley',
    location: 'Ezulwini Valley',
    description: 'Eswatini’s premier lifestyle and retail center featuring open-air arcades, banking halls, dining terraces, and ample secure parking.',
    image: 'https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?auto=format&fit=crop&w=1200&q=80',
    status: 'Active',
    operating_hours: 'Mon - Sat: 08:30 - 18:00 | Sun: 09:00 - 15:00',
    parking_bays: 480,
    amenities: ['24/7 Armed Security', 'Backup Generators', 'Fiber Internet', 'EV Charging & Taxi Rank', 'Full Wheelchair Accessibility'],
  },
  {
    id: 'sc_swazi_plaza',
    organization_id: 'org_swazi_plaza',
    name: 'Swazi Plaza & Corporate Place',
    address: 'Plaza Complex, Dzeliwe Street, Mbabane',
    location: 'Mbabane Central',
    description: 'The capital’s bustling central shopping and commercial office hub with over 100 retail shops, medical suites, and corporate headquarters.',
    image: 'https://images.unsplash.com/photo-1567449303078-57ad995bd301?auto=format&fit=crop&w=1200&q=80',
    status: 'Active',
    operating_hours: 'Mon - Fri: 08:00 - 17:30 | Sat: 08:30 - 14:00',
    parking_bays: 650,
    amenities: ['Underground Secure Parking', '3-Phase High-Capacity Power', 'Direct Pedestrian Skywalk', 'CCTV Surveillance'],
  },
  {
    id: 'sc_riverstone',
    organization_id: 'org_swazi_plaza',
    name: 'Riverstone Mall',
    address: 'Corner Ngwane & Tenbergen Street, Manzini',
    location: 'Manzini City',
    description: 'The commercial heartbeat of Manzini with major supermarket anchors, fast-food courts, electronics retailers, and medical consulting spaces.',
    image: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=1200&q=80',
    status: 'Active',
    operating_hours: 'Mon - Sat: 08:30 - 18:30 | Sun: 09:00 - 16:00',
    parking_bays: 520,
    amenities: ['Automated Parking Boom', 'Borehole Backup Water', 'High Footfall Anchor Tenants', 'Loading Docks'],
  },
  {
    id: 'sc_matsapha_park',
    organization_id: 'org_gables_lifestyle',
    name: 'Matsapha Commercial & Logistics Park',
    address: 'Industrial Road 4, Matsapha',
    location: 'Matsapha Industrial',
    description: 'Prime warehouse and showroom space designed for light industrial assembly, wholesale distribution, and regional business logistics.',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
    status: 'Active',
    operating_hours: '24/7 Gated Industrial Access',
    parking_bays: 180,
    amenities: ['Heavy Vehicle Turning Circles', '6m Ceiling Height', '3-Phase Heavy Industrial Supply', '24hr Guard Post'],
  },
];

const INITIAL_PROPERTIES: Property[] = [
  {
    id: 'prop_gables_retail',
    organization_id: 'org_gables_lifestyle',
    shopping_center_id: 'sc_gables',
    name: 'The Gables Main Retail Arcade',
    type: 'Retail shop',
    address: 'Ground & 1st Floor Arcade, The Gables, Ezulwini',
    description: 'High-visibility retail boutique and shop spaces right on the pedestrian piazza and central fountain walkway.',
    status: 'Active',
  },
  {
    id: 'prop_gables_offices',
    organization_id: 'org_gables_lifestyle',
    shopping_center_id: 'sc_gables',
    name: 'The Gables Corporate Suites',
    type: 'Office',
    address: 'Level 2, Corporate Wing, Ezulwini',
    description: 'Modern executive offices with scenic views of Mdzimba Mountain, shared boardrooms, and optical fiber connectivity.',
    status: 'Active',
  },
  {
    id: 'prop_swazi_plaza_main',
    organization_id: 'org_swazi_plaza',
    shopping_center_id: 'sc_swazi_plaza',
    name: 'Swazi Plaza High-Street Retail',
    type: 'Retail shop',
    address: 'Central Walkway, Swazi Plaza, Mbabane',
    description: 'Unmatched pedestrian footfall in the heart of Mbabane Central Business District.',
    status: 'Active',
  },
  {
    id: 'prop_riverstone_dining',
    organization_id: 'org_swazi_plaza',
    shopping_center_id: 'sc_riverstone',
    name: 'Riverstone Food & Lifestyle Gallery',
    type: 'Restaurant',
    address: 'Food Terrace, Riverstone Mall, Manzini',
    description: 'Fully equipped restaurant premises with gas hookups, grease traps, and open veranda seating.',
    status: 'Active',
  },
  {
    id: 'prop_matsapha_warehouses',
    organization_id: 'org_gables_lifestyle',
    shopping_center_id: 'sc_matsapha_park',
    name: 'Matsapha Distribution Units',
    type: 'Warehouse',
    address: 'Unit Bay 1-8, Matsapha Industrial',
    description: 'High-cube warehouse bays with roller shutter doors and integrated office mezzanines.',
    status: 'Active',
  },
];

const INITIAL_SHOPS: Shop[] = [
  {
    id: 'shop_g14',
    organization_id: 'org_gables_lifestyle',
    property_id: 'prop_gables_retail',
    shopping_center_id: 'sc_gables',
    shop_number: 'G-14',
    floor: 'Ground Floor',
    size_sqm: 85,
    rental_amount: 17500,
    deposit_amount: 35000,
    status: 'Occupied',
    public_listing: false,
    qr_code: 'UW-GABLES-G14',
    images: [
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=900&q=80',
    ],
    features: ['Corner Double Display Glass', 'Air Conditioning Unit', 'Private Staff Kitchenette', 'Tiled Flooring'],
    property_type: 'Retail shop',
    description: 'Prime retail unit located right next to the central entrance atrium. Excellent foot traffic with glass frontage.',
    power_specs: 'Single phase with backup generator circuit',
    parking_allocated: 2,
  },
  {
    id: 'shop_g18',
    organization_id: 'org_gables_lifestyle',
    property_id: 'prop_gables_retail',
    shopping_center_id: 'sc_gables',
    shop_number: 'G-18',
    floor: 'Ground Floor',
    size_sqm: 110,
    rental_amount: 22000,
    deposit_amount: 44000,
    status: 'Available',
    public_listing: true,
    public_featured: true,
    qr_code: 'UW-GABLES-G18',
    images: [
      'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=900&q=80',
    ],
    features: ['High Footfall Piazza Frontage', 'Modern Track Lighting', 'Dedicated Storage Room', 'Automatic Glass Doors', 'Air Conditioning'],
    property_type: 'Retail shop',
    description: 'Exceptional open-plan retail shop ready for immediate fitout. Ideal for luxury apparel, tech boutique, or cosmetics brand.',
    power_specs: '3-Phase 60A Supply, Full Generator Backup',
    parking_allocated: 3,
    available_from: 'Immediate (September 2026)',
  },
  {
    id: 'shop_g05_rest',
    organization_id: 'org_gables_lifestyle',
    property_id: 'prop_gables_retail',
    shopping_center_id: 'sc_gables',
    shop_number: 'G-05',
    floor: 'Ground Courtyard',
    size_sqm: 165,
    rental_amount: 32000,
    deposit_amount: 64000,
    status: 'Available',
    public_listing: true,
    public_featured: true,
    qr_code: 'UW-GABLES-G05',
    images: [
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=900&q=80',
    ],
    features: ['Outdoor Shaded Veranda (40sqm)', 'Commercial Kitchen Gas Lines', 'Built-in Grease Trap', 'Cold Room Provision', 'Liquor License Compliant'],
    property_type: 'Restaurant',
    description: 'Fully certified restaurant and cafe space looking out onto the Ezulwini green gardens. Features spacious dining area and outdoor patio seating.',
    power_specs: '3-Phase 100A, Gas Piping, Dedicated Extractor Duct',
    parking_allocated: 5,
    available_from: '1st October 2026',
  },
  {
    id: 'shop_l2_off1',
    organization_id: 'org_gables_lifestyle',
    property_id: 'prop_gables_offices',
    shopping_center_id: 'sc_gables',
    shop_number: 'Ste-204',
    floor: 'Level 2',
    size_sqm: 72,
    rental_amount: 13500,
    deposit_amount: 27000,
    status: 'Available',
    public_listing: true,
    public_featured: false,
    qr_code: 'UW-GABLES-204',
    images: [
      'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=900&q=80',
    ],
    features: ['Panoramic Mountain Views', 'Reception + 2 Executive Offices', 'Fiber Ready (100Mbps)', 'Access Control Card Reader', 'Shared Kitchen'],
    property_type: 'Office',
    description: 'Professional corporate suite in the Gables quiet business wing. Ready to move in with laminated floors and sound dampening drywall.',
    power_specs: 'Standard power + UPS & Generator',
    parking_allocated: 2,
    available_from: 'Immediate',
  },
  {
    id: 'shop_sp_k02',
    organization_id: 'org_swazi_plaza',
    property_id: 'prop_swazi_plaza_main',
    shopping_center_id: 'sc_swazi_plaza',
    shop_number: 'K-02',
    floor: 'Ground Concourse',
    size_sqm: 24,
    rental_amount: 7500,
    deposit_amount: 15000,
    status: 'Available',
    public_listing: true,
    public_featured: true,
    qr_code: 'UW-PLAZA-K02',
    images: [
      'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80',
    ],
    features: ['360 Island Display Kiosk', 'Lockable Roller Shutters', 'Point of Sale Ready', 'Direct Bank Walkway'],
    property_type: 'Kiosk',
    description: 'High-impact central concourse kiosk right between First National Bank and the main taxi rank pedestrian skywalk.',
    power_specs: 'Single phase with sub-meter',
    parking_allocated: 1,
    available_from: 'Immediate',
  },
  {
    id: 'shop_sp_108',
    organization_id: 'org_swazi_plaza',
    property_id: 'prop_swazi_plaza_main',
    shopping_center_id: 'sc_swazi_plaza',
    shop_number: 'Shop 108',
    floor: 'Level 1',
    size_sqm: 140,
    rental_amount: 28500,
    deposit_amount: 57000,
    status: 'Reserved',
    public_listing: false,
    qr_code: 'UW-PLAZA-108',
    images: [
      'https://images.unsplash.com/photo-1567449303078-57ad995bd301?auto=format&fit=crop&w=900&q=80',
    ],
    features: ['Double Display Window', 'Deep Stockroom', 'High Ceiling'],
    property_type: 'Retail shop',
    description: 'Spacious fashion retail store currently reserved for lease finalization.',
    power_specs: '3-Phase 80A',
    parking_allocated: 3,
  },
  {
    id: 'shop_riv_b12',
    organization_id: 'org_swazi_plaza',
    property_id: 'prop_riverstone_dining',
    shopping_center_id: 'sc_riverstone',
    shop_number: 'B-12',
    floor: 'Ground Floor',
    size_sqm: 95,
    rental_amount: 19500,
    deposit_amount: 39000,
    status: 'Available',
    public_listing: true,
    public_featured: false,
    qr_code: 'UW-RIVER-B12',
    images: [
      'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=900&q=80',
    ],
    features: ['Main Entrance Visibility', 'Wide Rollup Security Grille', 'Tile Flooring', 'Air Conditioning'],
    property_type: 'Retail shop',
    description: 'High visibility retail spot in Manzini Riverstone Mall, right beside the anchor supermarket.',
    power_specs: 'Standard commercial supply',
    parking_allocated: 2,
    available_from: 'Immediate',
  },
  {
    id: 'shop_mat_bay4',
    organization_id: 'org_gables_lifestyle',
    property_id: 'prop_matsapha_warehouses',
    shopping_center_id: 'sc_matsapha_park',
    shop_number: 'Bay 04',
    floor: 'Ground Ground',
    size_sqm: 350,
    rental_amount: 38000,
    deposit_amount: 76000,
    status: 'Available',
    public_listing: true,
    public_featured: true,
    qr_code: 'UW-MAT-BAY04',
    images: [
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=80',
    ],
    features: ['5m High Roller Shutter Door', 'Mezzanine Dispatch Office', 'Heavy Concrete Floor (30kN/m2)', 'Superlink Truck Access', 'Dedicated Water Reservoir'],
    property_type: 'Warehouse',
    description: 'Industrial and distribution warehouse in Matsapha Industrial Estate. Fitted with 3-phase high amperage and 24-hour perimeter security patrol.',
    power_specs: '3-Phase 150A industrial supply',
    parking_allocated: 6,
    available_from: '1st October 2026',
  },
  {
    id: 'shop_g09_maint',
    organization_id: 'org_gables_lifestyle',
    property_id: 'prop_gables_retail',
    shopping_center_id: 'sc_gables',
    shop_number: 'G-09',
    floor: 'Ground Floor',
    size_sqm: 60,
    rental_amount: 12000,
    deposit_amount: 24000,
    status: 'Under Maintenance',
    public_listing: false,
    qr_code: 'UW-GABLES-G09',
    images: [
      'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=900&q=80',
    ],
    features: ['Flooring Refurbishment in progress'],
    property_type: 'Retail shop',
    description: 'Currently undergoing floor tiling and ceiling overhaul. Will be listed when complete.',
    power_specs: 'Single phase',
    parking_allocated: 1,
  },
];

const INITIAL_TENANTS: Tenant[] = [
  {
    id: 'ten_swazi_artisan',
    organization_id: 'org_gables_lifestyle',
    property_id: 'prop_gables_retail',
    shopping_center_id: 'sc_gables',
    shop_id: 'shop_g14',
    business_name: 'Swazi Artisan Crafts',
    contact_person: 'Nandi Khumalo',
    phone: '+268 7622 9988',
    email: 'nandi@swaziartisancrafts.sz',
    status: 'Active',
    trade_type: 'Handmade Crafts & Gifts',
    move_in_date: '2024-03-01',
    user_id: 'usr_tenant_nandi',
  },
  {
    id: 'ten_ezulwini_coffee',
    organization_id: 'org_gables_lifestyle',
    property_id: 'prop_gables_retail',
    shopping_center_id: 'sc_gables',
    shop_id: 'shop_g05_rest',
    business_name: 'Valley Roastery Cafe',
    contact_person: 'Zweli Masuku',
    phone: '+268 7615 3322',
    email: 'zweli@valleyroastery.sz',
    status: 'Pending',
    trade_type: 'Specialty Coffee & Bakery',
    move_in_date: '2026-10-01',
  },
  {
    id: 'ten_mtn_express',
    organization_id: 'org_swazi_plaza',
    property_id: 'prop_swazi_plaza_main',
    shopping_center_id: 'sc_swazi_plaza',
    shop_id: 'shop_sp_108',
    business_name: 'Kingdom Mobile Services',
    contact_person: 'Dumisa Lukhele',
    phone: '+268 7601 7744',
    email: 'dumisa@kingdommobile.sz',
    status: 'Active',
    trade_type: 'Telecommunications & Devices',
    move_in_date: '2023-06-15',
  },
];

const INITIAL_LEASES: Lease[] = [
  {
    id: 'lease_swazi_artisan',
    tenant_id: 'ten_swazi_artisan',
    shop_id: 'shop_g14',
    organization_id: 'org_gables_lifestyle',
    start_date: '2025-01-01',
    end_date: '2026-12-31', // Expiring in ~115 days
    rental_amount: 17500,
    deposit: 35000,
    renewal_status: 'Active',
    document_url: 'https://umhlaba.sz/docs/lease-swazi-artisan-2025.pdf',
    document_title: 'Commercial Lease Agreement — Shop G-14 The Gables',
    is_digitally_signed: true,
    signed_at: '2024-12-18T14:30:00Z',
    signer_name: 'Nandi Khumalo',
    last_reminder_sent: '2026-09-01T08:00:00Z',
  },
];

const INITIAL_SLA: SlaAgreement = {
  id: 'sla_gables_default',
  tenant_id: 'ten_swazi_artisan',
  property_id: 'prop_gables_retail',
  organization_id: 'org_gables_lifestyle',
  emergency_response_mins: 15,
  high_response_mins: 60,
  medium_response_mins: 240,
  low_response_mins: 1440,
  expiry_date: '2026-12-31',
  signed_at: '2024-12-18T14:35:00Z',
  signer_name: 'Nandi Khumalo',
};

const INITIAL_TICKETS: Ticket[] = [
  {
    id: 'tkt_001_leak',
    ticket_number: 'GA-G14-060926-0001',
    organization_id: 'org_gables_lifestyle',
    shopping_center_id: 'sc_gables',
    property_id: 'prop_gables_retail',
    shop_id: 'shop_g14',
    tenant_id: 'ten_swazi_artisan',
    title: 'Ceiling Water Leak near Rear Stockroom',
    description: 'Active water drip emerging from the suspended ceiling tiles near the inventory shelving. Risk of merchandise damage.',
    exact_location_description: 'Directly above shelf row 3 near emergency fire exit.',
    priority: 'Emergency',
    category: 'Water Leak',
    status: 'In Progress',
    assigned_to: 'usr_maintenance_bheki',
    assigned_to_name: 'Bheki Maseko',
    created_by_user_id: 'usr_tenant_nandi',
    created_at: '2026-09-06T10:15:00Z',
    response_deadline: '2026-09-06T10:30:00Z', // 15 mins for Emergency
    resolution_deadline: '2026-09-06T14:15:00Z',
    responded_at: '2026-09-06T10:24:00Z',
    sla_status: 'Compliant',
    attachments: [
      {
        id: 'att_01',
        file_name: 'ceiling_drip_damage.jpg',
        file_type: 'image/jpeg',
        file_size_bytes: 840000,
        storage_url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
        uploaded_by: 'Nandi Khumalo',
        uploaded_at: '2026-09-06T10:15:00Z',
      },
    ],
    timeline: [
      {
        id: 'tl_1',
        timestamp: '2026-09-06T10:15:00Z',
        title: 'Emergency Ticket Created',
        description: 'Tenant Nandi Khumalo logged ticket GA-G14-060926-0001 with 1 image.',
        actor_name: 'Nandi Khumalo',
        actor_role: 'Tenant',
        type: 'creation',
      },
      {
        id: 'tl_2',
        timestamp: '2026-09-06T10:18:00Z',
        title: 'Manager Notified',
        description: 'Automated alert broadcast to Property Manager Sipho Dlamini.',
        actor_name: 'Umhlaba Wami SLA Engine',
        actor_role: 'System',
        type: 'assignment',
      },
      {
        id: 'tl_3',
        timestamp: '2026-09-06T10:24:00Z',
        title: 'Assigned to Facilities Technician',
        description: 'Assigned to Bheki Maseko (Senior Tech).',
        actor_name: 'Sipho Dlamini',
        actor_role: 'Property Manager',
        type: 'assignment',
      },
      {
        id: 'tl_4',
        timestamp: '2026-09-06T10:35:00Z',
        title: 'Technician Accepted Job',
        description: 'Bheki Maseko accepted emergency dispatch and arrived on site with pressure isolation kit.',
        actor_name: 'Bheki Maseko',
        actor_role: 'Maintenance',
        type: 'acceptance',
      },
    ],
  },
  {
    id: 'tkt_002_ac',
    ticket_number: 'GA-G14-050926-0002',
    organization_id: 'org_gables_lifestyle',
    shopping_center_id: 'sc_gables',
    property_id: 'prop_gables_retail',
    shop_id: 'shop_g14',
    tenant_id: 'ten_swazi_artisan',
    title: 'AC Inverter Unit Blowing Warm Air',
    description: 'Main sales floor air conditioning compressor stopped cooling; ambient temp reaching 29°C.',
    exact_location_description: 'Ceiling cassette unit in main showroom area.',
    priority: 'High',
    category: 'Air Conditioning',
    status: 'Resolved', // Waiting for Tenant Confirmation!
    assigned_to: 'usr_maintenance_bheki',
    assigned_to_name: 'Bheki Maseko',
    created_by_user_id: 'usr_tenant_nandi',
    created_at: '2026-09-05T09:00:00Z',
    response_deadline: '2026-09-05T10:00:00Z',
    resolution_deadline: '2026-09-05T17:00:00Z',
    responded_at: '2026-09-05T09:40:00Z',
    resolved_at: '2026-09-05T15:30:00Z',
    sla_status: 'Compliant',
    repair_notes: 'Replaced faulty contactor capacitor on outdoor roof unit and cleaned condenser coils. System cycling cold air at 19°C.',
    materials_used: '45uF Contactor Capacitor, coil cleaner fluid',
    time_spent_hours: 2.5,
    cost: 1450,
    before_images: ['https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80'],
    after_images: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80'],
    attachments: [],
    timeline: [
      {
        id: 'tl_ac1',
        timestamp: '2026-09-05T09:00:00Z',
        title: 'Ticket Created',
        description: 'AC blowing warm air.',
        actor_name: 'Nandi Khumalo',
        actor_role: 'Tenant',
        type: 'creation',
      },
      {
        id: 'tl_ac2',
        timestamp: '2026-09-05T09:40:00Z',
        title: 'Assigned to Bheki',
        description: 'HVAC repair work order issued.',
        actor_name: 'Sipho Dlamini',
        actor_role: 'Property Manager',
        type: 'assignment',
      },
      {
        id: 'tl_ac3',
        timestamp: '2026-09-05T15:30:00Z',
        title: 'Marked Resolved by Technician',
        description: 'Capacitor replaced. Awaiting Tenant confirmation to permanently close.',
        actor_name: 'Bheki Maseko',
        actor_role: 'Maintenance',
        type: 'resolution',
      },
    ],
  },
  {
    id: 'tkt_003_lights',
    ticket_number: 'SP-108-010926-0003',
    organization_id: 'org_swazi_plaza',
    shopping_center_id: 'sc_swazi_plaza',
    property_id: 'prop_swazi_plaza_main',
    shop_id: 'shop_sp_108',
    tenant_id: 'ten_mtn_express',
    title: 'Flickering LED Signage on Walkway',
    description: 'Outside exterior backlit logo light flickering intermittently.',
    priority: 'Medium',
    category: 'Electrical',
    status: 'Closed',
    assigned_to: 'usr_maintenance_bheki',
    assigned_to_name: 'Bheki Maseko',
    created_by_user_id: 'usr_client_admin',
    created_at: '2026-09-01T11:00:00Z',
    response_deadline: '2026-09-01T15:00:00Z',
    resolution_deadline: '2026-09-02T11:00:00Z',
    resolved_at: '2026-09-01T16:20:00Z',
    closed_at: '2026-09-01T17:00:00Z',
    sla_status: 'Compliant',
    repair_notes: 'Tightened neutral bridge on ballast driver.',
    cost: 320,
    tenant_rating: 5,
    tenant_feedback: 'Fast response and very polite electrician.',
    tenant_confirmed_fixed: true,
    attachments: [],
    timeline: [
      {
        id: 'tl_l1',
        timestamp: '2026-09-01T11:00:00Z',
        title: 'Logged',
        description: 'Flickering LED light.',
        actor_name: 'Dumisa Lukhele',
        actor_role: 'Tenant',
        type: 'creation',
      },
      {
        id: 'tl_l2',
        timestamp: '2026-09-01T17:00:00Z',
        title: 'Tenant Confirmed Fixed',
        description: 'Rated 5 stars.',
        actor_name: 'Dumisa Lukhele',
        actor_role: 'Tenant',
        type: 'confirmation',
      },
    ],
  },
];

const INITIAL_FINANCE_TRANSACTIONS: FinanceTransaction[] = [
  {
    id: 'tx_01',
    organization_id: 'org_gables_lifestyle',
    property_id: 'prop_gables_retail',
    shop_id: 'shop_g14',
    tenant_id: 'ten_swazi_artisan',
    type: 'Rent Collection',
    amount: 17500,
    direction: 'income',
    description: 'September 2026 Commercial Rent — Swazi Artisan Crafts',
    reference: 'RENT-SEP-26-G14',
    date: '2026-09-01',
    status: 'Paid',
    reconciled: true,
  },
  {
    id: 'tx_02',
    organization_id: 'org_gables_lifestyle',
    property_id: 'prop_gables_retail',
    ticket_id: 'tkt_002_ac',
    type: 'Maintenance Expense',
    amount: 1450,
    direction: 'expense',
    description: 'AC Capacitor Replacement & Condenser Flush (GA-G14-050926-0002)',
    reference: 'MAINT-INV-8821',
    date: '2026-09-05',
    status: 'Paid',
    reconciled: true,
  },
  {
    id: 'tx_03',
    organization_id: 'org_gables_lifestyle',
    property_id: 'prop_gables_retail',
    type: 'Utility Payment',
    amount: 42300,
    direction: 'expense',
    description: 'EEC (Eswatini Electricity Company) Bulk Substation Bill - August',
    reference: 'EEC-GAB-AUG26',
    date: '2026-09-03',
    status: 'Paid',
    reconciled: true,
  },
  {
    id: 'tx_04',
    organization_id: 'org_gables_lifestyle',
    property_id: 'prop_gables_retail',
    type: 'Vendor Payout',
    amount: 18500,
    direction: 'expense',
    description: 'Monthly Security Guard Services — Royal Eswatini Security',
    reference: 'SEC-SEP26-01',
    date: '2026-09-02',
    status: 'Paid',
    reconciled: true,
  },
];

const INITIAL_FINANCIAL_REQUESTS: FinancialRequest[] = [
  {
    id: 'req_01',
    organization_id: 'org_gables_lifestyle',
    property_id: 'prop_gables_retail',
    requested_by_name: 'Bheki Maseko',
    type: 'Petty Cash',
    amount: 850,
    purpose: 'Emergency plumbing PVC couplers, thread tape, and high-temp solder for Shop G-14 pipe isolation.',
    status: 'Approved',
    created_at: '2026-09-06T10:40:00Z',
    approved_by: 'Sipho Dlamini',
  },
  {
    id: 'req_02',
    organization_id: 'org_gables_lifestyle',
    property_id: 'prop_gables_retail',
    requested_by_name: 'Sipho Dlamini',
    type: 'Purchase Request',
    amount: 6200,
    purpose: 'Quarterly replacement of 12 emergency exit battery-pack backup lights across Level 1 & 2 arcades.',
    status: 'Pending Approval',
    created_at: '2026-09-05T16:00:00Z',
  },
];

const INITIAL_SHIFTS: StaffShift[] = [
  {
    id: 'shift_1',
    organization_id: 'org_gables_lifestyle',
    property_id: 'prop_gables_retail',
    staff_id: 'usr_maintenance_bheki',
    staff_name: 'Bheki Maseko',
    staff_role: 'Maintenance',
    date: '2026-09-06',
    shift_type: 'Morning (07:00-15:00)',
    status: 'Scheduled',
    notes: 'On duty for emergency plumbing & electrical calls.',
  },
  {
    id: 'shift_2',
    organization_id: 'org_gables_lifestyle',
    property_id: 'prop_gables_retail',
    staff_id: 'usr_property_manager',
    staff_name: 'Sipho Dlamini',
    staff_role: 'Manager',
    date: '2026-09-06',
    shift_type: 'General (08:00-17:00)',
    status: 'Scheduled',
    notes: 'Conducting weekly tenant lease and SLA audits.',
  },
  {
    id: 'shift_3',
    organization_id: 'org_gables_lifestyle',
    property_id: 'prop_gables_retail',
    staff_id: 'usr_maintenance_bheki',
    staff_name: 'Bheki Maseko',
    staff_role: 'Maintenance',
    date: '2026-09-07',
    shift_type: 'Morning (07:00-15:00)',
    status: 'Scheduled',
  },
];

const INITIAL_VENDORS: Vendor[] = [
  {
    id: 'ven_01',
    organization_id: 'org_gables_lifestyle',
    company_name: 'Kingdom HVAC Engineering',
    service_category: 'HVAC / Air Conditioning',
    contact_person: 'Mduduzi Zwane',
    phone: '+268 2404 8833',
    email: 'service@kingdomhvac.sz',
    assigned_property_ids: ['prop_gables_retail', 'prop_gables_offices'],
    contract_expiry: '2027-03-31',
    performance_rating: 4.8,
    status: 'Active',
  },
  {
    id: 'ven_02',
    organization_id: 'org_gables_lifestyle',
    company_name: 'Eswatini Elevator & Lift Specialists',
    service_category: 'Elevators / Escalators',
    contact_person: 'Garth Nel',
    phone: '+268 2518 4020',
    email: 'support@eswatinielevators.sz',
    assigned_property_ids: ['prop_gables_retail'],
    contract_expiry: '2026-11-30',
    performance_rating: 4.5,
    status: 'Active',
  },
  {
    id: 'ven_03',
    organization_id: 'org_gables_lifestyle',
    company_name: 'Protea Fire Protection Eswatini',
    service_category: 'Fire Protection & Extinguishers',
    contact_person: 'Sifiso Shongwe',
    phone: '+268 2505 9191',
    email: 'info@proteafire.co.sz',
    assigned_property_ids: ['prop_gables_retail', 'prop_matsapha_warehouses'],
    contract_expiry: '2027-08-31',
    performance_rating: 4.9,
    status: 'Active',
  },
];

const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann_01',
    organization_id: 'org_gables_lifestyle',
    property_id: 'prop_gables_retail',
    title: 'Routine Backup Generator Load Testing This Thursday',
    message: 'Notice to all The Gables tenants: EEC backup generators will undergo scheduled 30-minute automated changeover test on Thursday at 06:30 AM before center opening hours. Power will remain uninterrupted.',
    priority: 'Important',
    target_audience: 'All Tenants',
    created_by_name: 'Sipho Dlamini (Property Manager)',
    created_at: '2026-09-04T11:00:00Z',
    is_active: true,
  },
  {
    id: 'ann_02',
    organization_id: 'org_gables_lifestyle',
    property_id: 'prop_gables_retail',
    title: 'Umhlaba Wami Digital QR Code Scanning at Shop Entrances',
    message: 'All shop units have now been equipped with unique door QR codes. Tenants and staff can scan with any phone to immediately log tickets with location auto-populated.',
    priority: 'General',
    target_audience: 'All Tenants',
    created_by_name: 'Lindiwe Dlamini (Admin)',
    created_at: '2026-09-01T08:30:00Z',
    is_active: true,
  },
];

const INITIAL_EMERGENCY_BROADCAST: EmergencyBroadcast = {
  id: 'emb_01',
  organization_id: 'org_gables_lifestyle',
  property_id: 'prop_gables_retail',
  type: 'Water Outage',
  headline: 'Ezulwini Town Board Scheduled Water Main Connection',
  instructions: 'Municipal supply will be throttled between 14:00 - 16:00 today. The Gables 50,000L backup water reservoir pumps have been activated automatically.',
  issued_at: '2026-09-06T08:00:00Z',
  issued_by: 'Centre Operations',
  is_active: true,
};

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif_01',
    user_id: 'usr_property_manager',
    role: 'property_manager',
    organization_id: 'org_gables_lifestyle',
    type: 'ticket_new',
    title: 'Emergency Ticket Logged — GA-G14-060926-0001',
    message: 'Tenant Swazi Artisan Crafts logged emergency water leak in Shop G-14.',
    read: false,
    created_at: '2026-09-06T10:15:00Z',
    link_id: 'tkt_001_leak',
  },
  {
    id: 'notif_02',
    user_id: 'usr_maintenance_bheki',
    role: 'maintenance',
    organization_id: 'org_gables_lifestyle',
    type: 'ticket_assigned',
    title: 'New Emergency Job Assigned to You',
    message: 'Water leak at The Gables Shop G-14. 15-minute response SLA countdown active.',
    read: false,
    created_at: '2026-09-06T10:24:00Z',
    link_id: 'tkt_001_leak',
  },
  {
    id: 'notif_03',
    user_id: 'usr_tenant_nandi',
    role: 'tenant',
    organization_id: 'org_gables_lifestyle',
    type: 'ticket_resolved',
    title: 'Action Required: Confirm AC Repair in Shop G-14',
    message: 'Technician marked ticket GA-G14-050926-0002 as Resolved. Please confirm resolution.',
    read: false,
    created_at: '2026-09-05T15:30:00Z',
    link_id: 'tkt_002_ac',
  },
  {
    id: 'notif_04',
    user_id: 'usr_superadmin',
    role: 'super_admin',
    type: 'registration',
    title: 'New Organization Registration Pending Approval',
    message: 'Manzini Riverstone Investments registered for Professional tier. Review & assign organization code.',
    read: false,
    created_at: '2026-09-05T14:15:00Z',
    link_id: 'org_riverstone_group',
  },
];

const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg_01',
    conversation_id: 'conv_tkt_001',
    sender_id: 'usr_tenant_nandi',
    sender_name: 'Nandi Khumalo',
    sender_role: 'tenant',
    message: 'Good morning Sipho, the drip is picking up speed near the wooden craft displays. We have put buckets down.',
    created_at: '2026-09-06T10:17:00Z',
    read: true,
  },
  {
    id: 'msg_02',
    conversation_id: 'conv_tkt_001',
    sender_id: 'usr_property_manager',
    sender_name: 'Sipho Dlamini',
    sender_role: 'property_manager',
    message: 'Hello Nandi, I have notified Bheki immediately. He is carrying the master valve key and is heading down to Shop G-14 now.',
    created_at: '2026-09-06T10:25:00Z',
    read: true,
  },
  {
    id: 'msg_03',
    conversation_id: 'conv_tkt_001',
    sender_id: 'usr_maintenance_bheki',
    sender_name: 'Bheki Maseko',
    sender_role: 'maintenance',
    message: 'I am outside the rear door now with the riser shut-off tools.',
    created_at: '2026-09-06T10:36:00Z',
    read: false,
  },
];

const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log_01',
    organization_id: 'org_gables_lifestyle',
    user_id: 'usr_tenant_nandi',
    user_name: 'Nandi Khumalo',
    action: 'CREATE_TICKET',
    entity_type: 'Ticket',
    entity_id: 'tkt_001_leak',
    timestamp: '2026-09-06T10:15:00Z',
    details: 'Emergency water leak logged for Shop G-14.',
  },
  {
    id: 'log_02',
    organization_id: 'org_gables_lifestyle',
    user_id: 'usr_property_manager',
    user_name: 'Sipho Dlamini',
    action: 'ASSIGN_TICKET',
    entity_type: 'Ticket',
    entity_id: 'tkt_001_leak',
    timestamp: '2026-09-06T10:24:00Z',
    details: 'Assigned to Bheki Maseko (Maintenance).',
  },
  {
    id: 'log_03',
    user_id: 'usr_superadmin',
    user_name: 'Phumzile Nhlabatsi',
    action: 'APPROVE_ORGANIZATION',
    entity_type: 'Organization',
    entity_id: 'org_gables_lifestyle',
    timestamp: '2026-08-21T11:00:00Z',
    details: 'Approved organization code GAB-070826 under Professional tier.',
  },
];

const INITIAL_PROPERTY_LEADS: PropertyLead[] = [
  {
    id: 'lead_01',
    name: 'Sibusiso Nxumalo',
    company: 'Peak Commercial Properties',
    phone: '+268 7655 4321',
    email: 'sibusiso@peakcommercial.sz',
    property_count: 4,
    tenant_count: 65,
    location: 'Mbabane Commercial District',
    property_type: 'Office & Retail',
    submitted_at: '2026-09-04T09:00:00Z',
    status: 'New',
  },
];

// Local state container
class DatabaseService {
  private listeners: Set<() => void> = new Set();

  public organizations: Organization[] = [];
  public users: User[] = [];
  public shoppingCenters: ShoppingCenter[] = [];
  public properties: Property[] = [];
  public shops: Shop[] = [];
  public tenants: Tenant[] = [];
  public leases: Lease[] = [];
  public slaAgreements: SlaAgreement[] = [];
  public tickets: Ticket[] = [];
  public ticketComments: TicketComment[] = [];
  public shifts: StaffShift[] = [];
  public vendors: Vendor[] = [];
  public financeTransactions: FinanceTransaction[] = [];
  public financialRequests: FinancialRequest[] = [];
  public announcements: Announcement[] = [];
  public emergencyBroadcasts: EmergencyBroadcast[] = [];
  public notifications: NotificationItem[] = [];
  public chatMessages: ChatMessage[] = [];
  public auditLogs: AuditLog[] = [];
  public leads: PropertyLead[] = [];
  public subscriptionPlans: SubscriptionConfig[] = DEFAULT_SUBSCRIPTION_PLANS;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.organizations = parsed.organizations && parsed.organizations.length > 0 ? parsed.organizations : INITIAL_ORGANIZATIONS;
        this.users = parsed.users && parsed.users.length > 0 ? parsed.users : INITIAL_USERS;
        this.shoppingCenters = parsed.shoppingCenters && parsed.shoppingCenters.length > 0 ? parsed.shoppingCenters : INITIAL_SHOPPING_CENTERS;
        this.properties = parsed.properties && parsed.properties.length > 0 ? parsed.properties : INITIAL_PROPERTIES;
        this.shops = parsed.shops && parsed.shops.length > 0 ? parsed.shops : INITIAL_SHOPS;
        this.tenants = parsed.tenants && parsed.tenants.length > 0 ? parsed.tenants : INITIAL_TENANTS;
        this.leases = parsed.leases && parsed.leases.length > 0 ? parsed.leases : INITIAL_LEASES;
        this.slaAgreements = parsed.slaAgreements && parsed.slaAgreements.length > 0 ? parsed.slaAgreements : [INITIAL_SLA];
        this.tickets = parsed.tickets && parsed.tickets.length > 0 ? parsed.tickets : INITIAL_TICKETS;
        this.shifts = parsed.shifts && parsed.shifts.length > 0 ? parsed.shifts : INITIAL_SHIFTS;
        this.vendors = parsed.vendors && parsed.vendors.length > 0 ? parsed.vendors : INITIAL_VENDORS;
        this.financeTransactions = parsed.financeTransactions && parsed.financeTransactions.length > 0 ? parsed.financeTransactions : INITIAL_FINANCE_TRANSACTIONS;
        this.financialRequests = parsed.financialRequests && parsed.financialRequests.length > 0 ? parsed.financialRequests : INITIAL_FINANCIAL_REQUESTS;
        this.announcements = parsed.announcements && parsed.announcements.length > 0 ? parsed.announcements : INITIAL_ANNOUNCEMENTS;
        this.emergencyBroadcasts = parsed.emergencyBroadcasts && parsed.emergencyBroadcasts.length > 0 ? parsed.emergencyBroadcasts : [INITIAL_EMERGENCY_BROADCAST];
        this.notifications = parsed.notifications && parsed.notifications.length > 0 ? parsed.notifications : INITIAL_NOTIFICATIONS;
        this.chatMessages = parsed.chatMessages && parsed.chatMessages.length > 0 ? parsed.chatMessages : INITIAL_CHAT_MESSAGES;
        this.auditLogs = parsed.auditLogs && parsed.auditLogs.length > 0 ? parsed.auditLogs : INITIAL_AUDIT_LOGS;
        this.leads = parsed.leads && parsed.leads.length > 0 ? parsed.leads : INITIAL_PROPERTY_LEADS;
        this.subscriptionPlans = parsed.subscriptionPlans && parsed.subscriptionPlans.length > 0 ? parsed.subscriptionPlans : DEFAULT_SUBSCRIPTION_PLANS;
        return;
      }
    } catch (e) {
      console.warn('Could not parse stored DB, resetting to defaults', e);
    }
    this.resetToDefaults();
  }

  public syncSystem() {
    this.saveToStorage();
    this.notifyListeners();
  }

  public saveToStorage() {
    try {
      const data = {
        organizations: this.organizations,
        users: this.users,
        shoppingCenters: this.shoppingCenters,
        properties: this.properties,
        shops: this.shops,
        tenants: this.tenants,
        leases: this.leases,
        slaAgreements: this.slaAgreements,
        tickets: this.tickets,
        shifts: this.shifts,
        vendors: this.vendors,
        financeTransactions: this.financeTransactions,
        financialRequests: this.financialRequests,
        announcements: this.announcements,
        emergencyBroadcasts: this.emergencyBroadcasts,
        notifications: this.notifications,
        chatMessages: this.chatMessages,
        auditLogs: this.auditLogs,
        leads: this.leads,
        subscriptionPlans: this.subscriptionPlans,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      this.notifyListeners();
    } catch (e) {
      console.error('Failed to save to storage', e);
    }
  }

  public resetToDefaults() {
    this.organizations = JSON.parse(JSON.stringify(INITIAL_ORGANIZATIONS));
    this.users = JSON.parse(JSON.stringify(INITIAL_USERS));
    this.shoppingCenters = JSON.parse(JSON.stringify(INITIAL_SHOPPING_CENTERS));
    this.properties = JSON.parse(JSON.stringify(INITIAL_PROPERTIES));
    this.shops = JSON.parse(JSON.stringify(INITIAL_SHOPS));
    this.tenants = JSON.parse(JSON.stringify(INITIAL_TENANTS));
    this.leases = JSON.parse(JSON.stringify(INITIAL_LEASES));
    this.slaAgreements = [JSON.parse(JSON.stringify(INITIAL_SLA))];
    this.tickets = JSON.parse(JSON.stringify(INITIAL_TICKETS));
    this.shifts = JSON.parse(JSON.stringify(INITIAL_SHIFTS));
    this.vendors = JSON.parse(JSON.stringify(INITIAL_VENDORS));
    this.financeTransactions = JSON.parse(JSON.stringify(INITIAL_FINANCE_TRANSACTIONS));
    this.financialRequests = JSON.parse(JSON.stringify(INITIAL_FINANCIAL_REQUESTS));
    this.announcements = JSON.parse(JSON.stringify(INITIAL_ANNOUNCEMENTS));
    this.emergencyBroadcasts = [JSON.parse(JSON.stringify(INITIAL_EMERGENCY_BROADCAST))];
    this.notifications = JSON.parse(JSON.stringify(INITIAL_NOTIFICATIONS));
    this.chatMessages = JSON.parse(JSON.stringify(INITIAL_CHAT_MESSAGES));
    this.auditLogs = JSON.parse(JSON.stringify(INITIAL_AUDIT_LOGS));
    this.leads = JSON.parse(JSON.stringify(INITIAL_PROPERTY_LEADS));
    this.subscriptionPlans = JSON.parse(JSON.stringify(DEFAULT_SUBSCRIPTION_PLANS));
    this.saveToStorage();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Listener callback error', err);
      }
    });
  }

  // AUDIT LOG HELPER
  public logAudit(
    userId: string,
    userName: string,
    action: string,
    entityType: string,
    entityId: string,
    organizationId?: string,
    details?: string
  ) {
    const newLog: AuditLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      organization_id: organizationId,
      user_id: userId,
      user_name: userName,
      action,
      entity_type: entityType,
      entity_id: entityId,
      timestamp: new Date().toISOString(),
      details,
    };
    this.auditLogs.unshift(newLog);
    this.saveToStorage();
  }

  // NOTIFICATION HELPER
  public sendNotification(
    userId: string,
    type: NotificationItem['type'],
    title: string,
    message: string,
    organizationId?: string,
    role?: NotificationItem['role'],
    linkId?: string
  ) {
    const notif: NotificationItem = {
      id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      user_id: userId,
      type,
      title,
      message,
      read: false,
      created_at: new Date().toISOString(),
      organization_id: organizationId,
      role,
      link_id: linkId,
    };
    this.notifications.unshift(notif);
    this.saveToStorage();
  }

  // TICKET GENERATOR WITH NUMBER FORMAT: [TENANT/PROPERTY]-[DATE]-[0001]
  public generateTicketNumber(shopNumber?: string, propertyName?: string): string {
    const propClean = String(propertyName || 'UM').slice(0, 2);
    const shopClean = String(shopNumber || 'SH').replace(/[^a-zA-Z0-9]/g, '');
    const prefix = `${propClean}-${shopClean}`.toUpperCase();
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    const dateStr = `${day}${month}${year}`;
    const count = (this.tickets || []).length + 1;
    const seq = String(count).padStart(4, '0');
    return `${prefix}-${dateStr}-${seq}`;
  }

  // CREATE TICKET
  public createTicket(data: {
    tenant_id: string;
    shop_id: string;
    property_id: string;
    shopping_center_id: string;
    organization_id: string;
    created_by_user_id: string;
    creator_name?: string;
    title: string;
    description: string;
    exact_location_description?: string;
    priority: TicketPriority;
    category: TicketCategory;
    attachments?: { name: string; type: string; size: number; url: string }[];
    before_images?: string[];
  }): Ticket {
    const shop = this.shops.find((s) => s.id === data.shop_id);
    const prop = this.properties.find((p) => p.id === data.property_id);
    const user = this.users.find((u) => u.id === data.created_by_user_id);
    const creatorName = data.creator_name || user?.name || 'Tenant User';
    const ticketNumber = this.generateTicketNumber(shop?.shop_number || 'SH', prop?.name || 'UM');

    const now = new Date();
    // Calculate SLA Deadlines
    let responseMins = 240; // Default Medium (4h)
    let resolutionHours = 24;
    if (data.priority === 'Emergency') {
      responseMins = 15;
      resolutionHours = 4;
    } else if (data.priority === 'High') {
      responseMins = 60;
      resolutionHours = 8;
    } else if (data.priority === 'Low') {
      responseMins = 1440; // 24h
      resolutionHours = 72;
    }

    const responseDeadline = new Date(now.getTime() + responseMins * 60000).toISOString();
    const resolutionDeadline = new Date(now.getTime() + resolutionHours * 3600000).toISOString();

    const formattedAttachments = (data.attachments || []).map((att, idx) => ({
      id: 'att_' + Date.now() + '_' + idx,
      file_name: att.name,
      file_type: att.type,
      file_size_bytes: att.size,
      storage_url: att.url,
      uploaded_by: creatorName,
      uploaded_at: now.toISOString(),
    }));

    if (data.before_images && data.before_images.length > 0) {
      data.before_images.forEach((imgUrl, idx) => {
        formattedAttachments.push({
          id: 'att_img_' + Date.now() + '_' + idx,
          file_name: `photo_${idx + 1}.jpg`,
          file_type: 'image/jpeg',
          file_size_bytes: 102400,
          storage_url: imgUrl,
          uploaded_by: creatorName,
          uploaded_at: now.toISOString(),
        });
      });
    }

    const newTicket: Ticket = {
      id: 'tkt_' + Date.now(),
      ticket_number: ticketNumber,
      organization_id: data.organization_id,
      shopping_center_id: data.shopping_center_id,
      property_id: data.property_id,
      shop_id: data.shop_id,
      tenant_id: data.tenant_id,
      title: data.title,
      description: data.description,
      exact_location_description: data.exact_location_description,
      priority: data.priority,
      category: data.category,
      status: 'Open',
      created_by_user_id: data.created_by_user_id,
      created_at: now.toISOString(),
      response_deadline: responseDeadline,
      resolution_deadline: resolutionDeadline,
      sla_status: 'Compliant',
      attachments: formattedAttachments,
      before_images: data.before_images || [],
      timeline: [
        {
          id: 'tl_' + Date.now(),
          timestamp: now.toISOString(),
          title: `Ticket Created (${data.priority})`,
          description: `Logged by ${creatorName}. Ticket number ${ticketNumber} assigned.`,
          actor_name: creatorName,
          actor_role: 'Tenant',
          type: 'creation',
        },
      ],
    };

    this.tickets.unshift(newTicket);

    // Notify Managers of this org
    const managers = this.users.filter(
      (u) => u.organization_id === data.organization_id && (u.role === 'property_manager' || u.role === 'admin')
    );
    managers.forEach((m) => {
      this.sendNotification(
        m.id,
        'ticket_new',
        `New ${data.priority} Ticket: ${ticketNumber}`,
        `${data.title} logged in Shop ${shop?.shop_number || ''}`,
        data.organization_id,
        m.role,
        newTicket.id
      );
    });

    this.logAudit(
      data.created_by_user_id,
      data.creator_name,
      'CREATE_TICKET',
      'Ticket',
      newTicket.id,
      data.organization_id,
      `Created ticket ${ticketNumber}: ${data.title}`
    );

    this.saveToStorage();
    return newTicket;
  }

  // ASSIGN TICKET TO TECHNICIAN
  public assignTicket(ticketId: string, technicianId: string, managerId: string, managerName: string) {
    const ticket = this.tickets.find((t) => t.id === ticketId);
    const tech = this.users.find((u) => u.id === technicianId);
    if (!ticket || !tech) return;

    ticket.assigned_to = tech.id;
    ticket.assigned_to_name = tech.name;
    if (ticket.status === 'Open') {
      ticket.status = 'In Progress';
    }

    const now = new Date().toISOString();
    ticket.timeline.push({
      id: 'tl_' + Date.now(),
      timestamp: now,
      title: 'Assigned to Technician',
      description: `Assigned to ${tech.name} by ${managerName}.`,
      actor_name: managerName,
      actor_role: 'Property Manager',
      type: 'assignment',
    });

    this.sendNotification(
      tech.id,
      'ticket_assigned',
      `Job Assigned: ${ticket.ticket_number}`,
      `You have been assigned ${ticket.priority} issue: ${ticket.title}`,
      ticket.organization_id,
      'maintenance',
      ticket.id
    );

    this.logAudit(managerId, managerName, 'ASSIGN_TICKET', 'Ticket', ticket.id, ticket.organization_id, `Assigned to ${tech.name}`);
    this.saveToStorage();
  }

  // MAINTENANCE TECH ACCEPTS JOB
  public acceptJob(ticketId: string, techId: string, techName: string) {
    const ticket = this.tickets.find((t) => t.id === ticketId);
    if (!ticket) return;

    const now = new Date().toISOString();
    ticket.responded_at = now;
    ticket.status = 'In Progress';
    ticket.timeline.push({
      id: 'tl_' + Date.now(),
      timestamp: now,
      title: 'Technician Accepted Job',
      description: `${techName} accepted job and dispatched to site.`,
      actor_name: techName,
      actor_role: 'Maintenance',
      type: 'acceptance',
    });

    this.sendNotification(
      ticket.created_by_user_id,
      'ticket_status',
      `Technician Dispatched`,
      `${techName} has accepted job ${ticket.ticket_number} and is en route.`,
      ticket.organization_id,
      'tenant',
      ticket.id
    );

    this.logAudit(techId, techName, 'ACCEPT_JOB', 'Ticket', ticket.id, ticket.organization_id, 'Technician accepted assignment');
    this.saveToStorage();
  }

  // MAINTENANCE TECH COMPLETES JOB (Status -> Resolved, awaiting Tenant Confirmation)
  public markTicketResolved(
    ticketId: string,
    techId: string,
    techName: string,
    data: {
      repair_notes: string;
      materials_used?: string;
      time_spent_hours?: number;
      cost?: number;
      before_images?: string[];
      after_images?: string[];
    }
  ) {
    const ticket = this.tickets.find((t) => t.id === ticketId);
    if (!ticket) return;

    const now = new Date().toISOString();
    ticket.status = 'Resolved'; // CRITICAL: Still awaiting tenant confirmation!
    ticket.resolved_at = now;
    ticket.repair_notes = data.repair_notes;
    ticket.materials_used = data.materials_used;
    ticket.time_spent_hours = data.time_spent_hours;
    ticket.cost = data.cost || 0;
    ticket.before_images = data.before_images || [];
    ticket.after_images = data.after_images || [];

    ticket.timeline.push({
      id: 'tl_' + Date.now(),
      timestamp: now,
      title: 'Job Marked Resolved by Technician',
      description: `Repairs completed: ${data.repair_notes}. Cost recorded: E${ticket.cost}. Awaiting Tenant confirmation.`,
      actor_name: techName,
      actor_role: 'Maintenance',
      type: 'resolution',
    });

    // If cost recorded, also create a Finance Transaction record
    if (data.cost && data.cost > 0) {
      const tx: FinanceTransaction = {
        id: 'tx_' + Date.now(),
        organization_id: ticket.organization_id,
        property_id: ticket.property_id,
        shop_id: ticket.shop_id,
        tenant_id: ticket.tenant_id,
        ticket_id: ticket.id,
        type: 'Maintenance Expense',
        amount: data.cost,
        direction: 'expense',
        description: `Maintenance repair for ticket ${ticket.ticket_number}: ${data.materials_used || data.repair_notes}`,
        reference: `MNT-${ticket.ticket_number}`,
        date: now.split('T')[0],
        status: 'Paid',
        reconciled: false,
      };
      this.financeTransactions.unshift(tx);
    }

    // Notify Tenant to confirm or reject
    this.sendNotification(
      ticket.created_by_user_id,
      'ticket_resolved',
      `Please Confirm Repair: ${ticket.ticket_number}`,
      `Technician ${techName} has completed work. Please verify and confirm resolution.`,
      ticket.organization_id,
      'tenant',
      ticket.id
    );

    this.logAudit(techId, techName, 'RESOLVE_TICKET', 'Ticket', ticket.id, ticket.organization_id, `Repairs logged: E${data.cost}`);
    this.saveToStorage();
  }

  // TENANT CONFIRMS OR REJECTS RESOLUTION (CRITICAL RULE #16)
  public confirmTenantResolution(
    ticketId: string,
    tenantId: string,
    tenantName: string,
    confirmedFixed: boolean,
    rating?: number,
    feedback?: string
  ) {
    const ticket = this.tickets.find((t) => t.id === ticketId);
    if (!ticket) return;

    const now = new Date().toISOString();
    ticket.tenant_confirmed_fixed = confirmedFixed;
    ticket.tenant_rating = rating;
    ticket.tenant_feedback = feedback;

    if (confirmedFixed) {
      ticket.status = 'Closed';
      ticket.closed_at = now;
      ticket.timeline.push({
        id: 'tl_' + Date.now(),
        timestamp: now,
        title: 'Tenant Confirmed Resolution — Ticket Closed',
        description: `Tenant ${tenantName} confirmed the issue is fixed. Rated ${rating || 5} Stars. "${feedback || 'No remarks'}".`,
        actor_name: tenantName,
        actor_role: 'Tenant',
        type: 'confirmation',
      });

      this.logAudit(tenantId, tenantName, 'CLOSE_TICKET', 'Ticket', ticket.id, ticket.organization_id, `Tenant confirmed fix, rated ${rating}/5`);
    } else {
      ticket.status = 'Reopened';
      ticket.timeline.push({
        id: 'tl_' + Date.now(),
        timestamp: now,
        title: 'Tenant Rejected Resolution — Ticket Reopened',
        description: `Tenant noted issue persists: "${feedback || 'Issue not completely resolved'}". Returned to Manager queue.`,
        actor_name: tenantName,
        actor_role: 'Tenant',
        type: 'reopened',
      });

      // Notify Manager of reopening
      const managers = this.users.filter(
        (u) => u.organization_id === ticket.organization_id && (u.role === 'property_manager' || u.role === 'admin')
      );
      managers.forEach((m) => {
        this.sendNotification(
          m.id,
          'ticket_reopened',
          `Ticket Reopened: ${ticket.ticket_number}`,
          `Tenant reported repair unsuccessful: ${feedback || ''}`,
          ticket.organization_id,
          m.role,
          ticket.id
        );
      });

      this.logAudit(tenantId, tenantName, 'REOPEN_TICKET', 'Ticket', ticket.id, ticket.organization_id, `Tenant rejected resolution: ${feedback}`);
    }

    this.saveToStorage();
  }

  // UPDATE SHOP OCCUPANCY / VACANCY STATUS (Requirement #36 & #59)
  // When shop status changes to 'Occupied' -> automatically remove from public available listings.
  // When changed to 'Available' -> publish it automatically if public listing is enabled.
  public updateShopStatus(shopId: string, newStatus: Shop['status'], publicListing?: boolean, userId?: string, userName?: string) {
    const shop = this.shops.find((s) => s.id === shopId);
    if (!shop) return;

    shop.status = newStatus;
    if (newStatus === 'Occupied' || newStatus === 'Under Maintenance') {
      shop.public_listing = false;
    } else if (newStatus === 'Available') {
      shop.public_listing = publicListing !== undefined ? publicListing : true;
    }

    this.logAudit(
      userId || 'sys',
      userName || 'System',
      'UPDATE_SHOP_STATUS',
      'Shop',
      shop.id,
      shop.organization_id,
      `Shop ${shop.shop_number} status set to ${newStatus}. Public listing: ${shop.public_listing}`
    );

    this.saveToStorage();
  }

  // PROPERTY OWNER REGISTRATION (Requirement #7 & #8)
  public registerOrganization(data: {
    company_name: string;
    owner_name: string;
    email: string;
    phone: string;
    address: string;
    preferred_username?: string;
    subscription_tier: Organization['subscription_tier'];
    property_count?: number;
    tenant_count?: number;
    estimated_rental_income?: number;
    maintenance_staff_count?: number;
    current_management_process?: string;
    monthly_fee_estimate?: number;
    initial_property?: any;
  }): Organization {
    // Generate an organization ID
    const orgId = 'org_' + Date.now();
    // Estimate: fixed baseline + 2% of estimated rental
    const baseFee = data.subscription_tier === 'Starter' ? 1450 : data.subscription_tier === 'Professional' ? 3850 : 8900;
    const rentalSurcharge = Math.round((data.estimated_rental_income || 0) * 0.02);
    const estimatedMonthly = data.monthly_fee_estimate || (baseFee + rentalSurcharge);

    const newOrg: Organization = {
      id: orgId,
      organization_code: 'PENDING',
      company_name: data.company_name,
      owner_name: data.owner_name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      subscription_tier: data.subscription_tier,
      status: 'Pending Approval', // MUST NOT GET ACCESS UNTIL APPROVED BY SUPER ADMIN
      property_limit: data.subscription_tier === 'Starter' ? 3 : data.subscription_tier === 'Professional' ? 10 : 99,
      tenant_limit: data.subscription_tier === 'Starter' ? 100 : data.subscription_tier === 'Professional' ? 500 : 9999,
      user_limit: data.subscription_tier === 'Starter' ? 10 : data.subscription_tier === 'Professional' ? 50 : 999,
      storage_limit: data.subscription_tier === 'Starter' ? 10 : data.subscription_tier === 'Professional' ? 50 : 500,
      monthly_fee_estimate: estimatedMonthly,
      created_at: new Date().toISOString(),
    };

    this.organizations.unshift(newOrg);

    // Notify Super Admins
    const superAdmins = this.users.filter((u) => u.role === 'super_admin');
    superAdmins.forEach((sa) => {
      this.sendNotification(
        sa.id,
        'registration',
        `New Registration: ${data.company_name}`,
        `${data.owner_name} submitted registration for ${data.property_count} properties (${data.subscription_tier}).`,
        undefined,
        'super_admin',
        newOrg.id
      );
    });

    this.logAudit('visitor', data.owner_name, 'REGISTER_ORGANIZATION', 'Organization', newOrg.id, undefined, `Self-registered ${data.company_name}`);
    this.saveToStorage();
    return newOrg;
  }

  // SUPER ADMIN APPROVES ORGANIZATION & GENERATES ORG CODE (Requirement #8)
  public approveOrganization(
    orgId: string,
    superAdminIdOrOptions?:
      | string
      | {
          organization_code?: string;
          custom_monthly_fee?: number;
          tier?: Organization['subscription_tier'];
          property_limit?: number;
          tenant_limit?: number;
          user_limit?: number;
          storage_limit?: number;
          monthly_fee?: number;
        },
    superAdminName?: string,
    overrides?: {
      tier?: Organization['subscription_tier'];
      property_limit?: number;
      tenant_limit?: number;
      user_limit?: number;
      storage_limit?: number;
      monthly_fee?: number;
    }
  ): string {
    const org = this.organizations.find((o) => o.id === orgId);
    if (!org) return '';

    let code = '';
    let adminName = superAdminName || 'Super Admin';
    let adminId = 'usr_super_admin';

    if (typeof superAdminIdOrOptions === 'object' && superAdminIdOrOptions !== null) {
      if (superAdminIdOrOptions.organization_code) {
        code = superAdminIdOrOptions.organization_code;
      }
      if (superAdminIdOrOptions.custom_monthly_fee) {
        org.monthly_fee_estimate = superAdminIdOrOptions.custom_monthly_fee;
      }
    } else if (typeof superAdminIdOrOptions === 'string') {
      adminId = superAdminIdOrOptions;
    }

    if (!code) {
      const initials = org.company_name
        .split(' ')
        .map((w) => w[0]?.toUpperCase() || '')
        .join('')
        .slice(0, 4);
      const d = new Date();
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = String(d.getFullYear()).slice(-2);
      code = `${initials || 'ORG'}-${day}${month}${year}`;
    }

    org.organization_code = code;
    org.status = 'Active';
    org.approved_at = new Date().toISOString();
    org.approved_by = adminName;

    const actualOverrides = overrides || (typeof superAdminIdOrOptions === 'object' ? superAdminIdOrOptions : undefined);
    if (actualOverrides) {
      if (actualOverrides.tier) org.subscription_tier = actualOverrides.tier;
      if (actualOverrides.property_limit) org.property_limit = actualOverrides.property_limit;
      if (actualOverrides.tenant_limit) org.tenant_limit = actualOverrides.tenant_limit;
      if (actualOverrides.user_limit) org.user_limit = actualOverrides.user_limit;
      if (actualOverrides.storage_limit) org.storage_limit = actualOverrides.storage_limit;
      if (actualOverrides.monthly_fee) org.monthly_fee_estimate = actualOverrides.monthly_fee;
    }

    // Automatically provision initial Admin user for this Org
    const adminUser: User = {
      id: 'usr_' + Date.now(),
      organization_id: org.id,
      username: org.email.split('@')[0],
      name: org.owner_name + ' (Admin)',
      email: org.email,
      phone: org.phone,
      role: 'admin',
      status: 'Active',
      created_at: new Date().toISOString(),
    };
    this.users.push(adminUser);

    this.sendNotification(
      adminUser.id,
      'approval',
      `Welcome to Umhlaba Wami!`,
      `Your organization ${org.company_name} is approved. Your Organization Code is ${code}.`,
      org.id,
      'admin'
    );

    this.logAudit(adminId, adminName, 'APPROVE_ORGANIZATION', 'Organization', org.id, org.id, `Approved with code ${code}`);
    this.saveToStorage();
    return code;
  }

  // SUPER ADMIN REJECTS ORGANIZATION
  public rejectOrganization(orgId: string, superAdminIdOrReason?: string, superAdminName?: string, reasonText?: string) {
    const org = this.organizations.find((o) => o.id === orgId);
    if (!org) return;

    let adminId = 'usr_super_admin';
    let adminName = superAdminName || 'Super Admin';
    let reason = reasonText || '';

    if (superAdminName === undefined && reasonText === undefined) {
      reason = superAdminIdOrReason || 'Registration not approved.';
    } else if (superAdminIdOrReason) {
      adminId = superAdminIdOrReason;
    }

    org.status = 'Rejected';
    this.logAudit(adminId, adminName, 'REJECT_ORGANIZATION', 'Organization', org.id, undefined, `Rejected: ${reason}`);
    this.saveToStorage();
  }

  // ADD CHAT MESSAGE (Text Only, Requirement #17)
  public addChatMessage(conversationId: string, sender: User, messageText: string) {
    const newMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      conversation_id: conversationId,
      sender_id: sender.id,
      sender_name: sender.name,
      sender_role: sender.role,
      message: messageText.trim(),
      created_at: new Date().toISOString(),
      read: false,
    };
    this.chatMessages.push(newMsg);
    this.saveToStorage();
    return newMsg;
  }

  // ADD ANNOUNCEMENT / BROADCAST
  public createAnnouncement(data: Omit<Announcement, 'id' | 'created_at' | 'is_active'>) {
    const ann: Announcement = {
      ...data,
      id: 'ann_' + Date.now(),
      created_at: new Date().toISOString(),
      is_active: true,
    };
    this.announcements.unshift(ann);

    // Broadcast in-app notification to all tenants in that org
    const tenants = this.users.filter((u) => u.organization_id === data.organization_id && u.role === 'tenant');
    tenants.forEach((t) => {
      this.sendNotification(t.id, 'announcement', data.title, data.message, data.organization_id, 'tenant');
    });

    this.saveToStorage();
    return ann;
  }

  // CREATE EMERGENCY BROADCAST (Requirement #32)
  public createEmergencyBroadcast(data: Omit<EmergencyBroadcast, 'id' | 'issued_at' | 'is_active'>) {
    const emb: EmergencyBroadcast = {
      ...data,
      id: 'emb_' + Date.now(),
      issued_at: new Date().toISOString(),
      is_active: true,
    };
    this.emergencyBroadcasts.unshift(emb);

    // Notify everyone in organization
    const orgUsers = this.users.filter((u) => u.organization_id === data.organization_id);
    orgUsers.forEach((u) => {
      this.sendNotification(u.id, 'emergency', `EMERGENCY ALERT: ${data.headline}`, data.instructions, data.organization_id, u.role);
    });

    this.saveToStorage();
    return emb;
  }

  // SUBMIT PROPERTY LEAD (Requirement #51)
  public submitPropertyLead(lead: Omit<PropertyLead, 'id' | 'submitted_at' | 'status'>) {
    const newLead: PropertyLead = {
      ...lead,
      id: 'lead_' + Date.now(),
      submitted_at: new Date().toISOString(),
      status: 'New',
    };
    this.leads.unshift(newLead);
    const superAdmins = this.users.filter((u) => u.role === 'super_admin');
    superAdmins.forEach((sa) => {
      this.sendNotification(
        sa.id,
        'registration',
        `New Landlord Inquiry: ${lead.company}`,
        `${lead.name} (${lead.phone}) submitted lead for ${lead.property_count} properties in ${lead.location}.`,
        undefined,
        'super_admin'
      );
    });
    this.saveToStorage();
    return newLead;
  }

  // DIGITAL SIGNATURE ON LEASE / SLA (Requirement #25)
  public signDocument(leaseId: string, signerName: string, signatureDataUrl?: string) {
    const lease = this.leases.find((l) => l.id === leaseId);
    if (!lease) return;

    lease.is_digitally_signed = true;
    lease.signed_at = new Date().toISOString();
    lease.signer_name = signerName;

    this.logAudit(
      'signer',
      signerName,
      'SIGN_DOCUMENT',
      'Lease',
      lease.id,
      lease.organization_id,
      `Digitally signed ${lease.document_title}. Hash verified.`
    );
    this.saveToStorage();
  }

  // ADD FINANCIAL TRANSACTION
  public addTransaction(tx: Omit<FinanceTransaction, 'id'>) {
    const newTx: FinanceTransaction = {
      ...tx,
      id: 'tx_' + Date.now(),
    };
    this.financeTransactions.unshift(newTx);
    this.saveToStorage();
    return newTx;
  }

  // EXPORT BACKUP AS JSON (Requirement #57)
  public exportBackupJson(): string {
    const fullState = {
      exported_at: new Date().toISOString(),
      version: '1.0.0',
      organizations: this.organizations,
      users: this.users,
      shoppingCenters: this.shoppingCenters,
      properties: this.properties,
      shops: this.shops,
      tenants: this.tenants,
      leases: this.leases,
      tickets: this.tickets,
      financeTransactions: this.financeTransactions,
      financialRequests: this.financialRequests,
      shifts: this.shifts,
      vendors: this.vendors,
      announcements: this.announcements,
      auditLogs: this.auditLogs,
    };
    return JSON.stringify(fullState, null, 2);
  }

  // RESTORE BACKUP FROM JSON
  public restoreBackupJson(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.organizations && parsed.shops && parsed.tickets) {
        this.organizations = parsed.organizations;
        this.users = parsed.users || this.users;
        this.shoppingCenters = parsed.shoppingCenters || this.shoppingCenters;
        this.properties = parsed.properties || this.properties;
        this.shops = parsed.shops;
        this.tenants = parsed.tenants || this.tenants;
        this.leases = parsed.leases || this.leases;
        this.tickets = parsed.tickets;
        this.financeTransactions = parsed.financeTransactions || this.financeTransactions;
        this.financialRequests = parsed.financialRequests || this.financialRequests;
        this.shifts = parsed.shifts || this.shifts;
        this.vendors = parsed.vendors || this.vendors;
        this.announcements = parsed.announcements || this.announcements;
        this.auditLogs = parsed.auditLogs || this.auditLogs;
        this.saveToStorage();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to parse backup', e);
      return false;
    }
  }

  // Convenience Aliases and Component Helpers
  public get activityLogs(): AuditLog[] {
    return this.auditLogs;
  }

  public exportStateJson(): string {
    return this.exportBackupJson();
  }

  public resetToInitialSeed() {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }

  public addAnnouncement(data: {
    organization_id: string;
    property_id?: string;
    title: string;
    message: string;
    created_by?: string;
    created_by_name?: string;
    priority?: 'General' | 'Important' | 'Emergency';
    target_audience?: 'All Tenants' | 'Specific Property' | 'Specific Floor';
    is_active?: boolean;
  }) {
    return this.createAnnouncement({
      organization_id: data.organization_id,
      property_id: data.property_id || this.properties[0]?.id || 'prop_gables_retail',
      title: data.title,
      message: data.message,
      priority: data.priority || 'General',
      target_audience: data.target_audience || 'All Tenants',
      created_by_name: data.created_by_name || data.created_by || 'Management',
    });
  }

  public startTicketWork(ticketId: string, techName: string) {
    const tech = this.users.find((u) => u.name === techName) || this.users.find((u) => u.role === 'maintenance');
    return this.acceptJob(ticketId, tech?.id || 'usr_maintenance_bheki', techName);
  }

  public resolveTicket(
    ticketId: string,
    data: {
      repair_notes: string;
      materials_used?: string;
      time_spent_hours?: number;
      cost?: number;
      after_images?: string[];
      technician_name?: string;
    }
  ) {
    const tech = this.users.find((u) => u.name === data.technician_name) || this.users.find((u) => u.role === 'maintenance');
    return this.markTicketResolved(ticketId, tech?.id || 'usr_maintenance_bheki', data.technician_name || 'Bheki Maseko', {
      repair_notes: data.repair_notes,
      materials_used: data.materials_used,
      time_spent_hours: data.time_spent_hours,
      cost: data.cost,
      after_images: data.after_images,
    });
  }

  public confirmTicketResolved(ticketId: string, rating?: number, feedback?: string) {
    const ticket = this.tickets.find((t) => t.id === ticketId);
    const tenant = this.tenants.find((t) => t.id === ticket?.tenant_id) || this.tenants[0];
    return this.confirmTenantResolution(ticketId, tenant.id, tenant.contact_person, true, rating, feedback);
  }

  public reopenTicket(ticketId: string, reason: string, tenantName?: string) {
    const ticket = this.tickets.find((t) => t.id === ticketId);
    const tenant = this.tenants.find((t) => t.id === ticket?.tenant_id) || this.tenants[0];
    return this.confirmTenantResolution(ticketId, tenant.id, tenantName || tenant.contact_person, false, undefined, reason);
  }

  public updateShop(shopId: string, updates: Partial<Shop>) {
    const shop = this.shops.find((s) => s.id === shopId);
    if (!shop) return;
    Object.assign(shop, updates);
    this.saveToStorage();
  }

  public addTicketComment(ticketId: string, userId: string, userName: string, comment: string, userRole?: UserRole) {
    const user = this.users.find((u) => u.id === userId);
    const newComment: TicketComment = {
      id: 'tc_' + Date.now(),
      ticket_id: ticketId,
      user_id: userId,
      user_name: userName,
      user_role: userRole || user?.role || 'tenant',
      comment,
      created_at: new Date().toISOString(),
    };
    this.ticketComments.push(newComment);
    this.saveToStorage();
    return newComment;
  }

  // Active module helper methods
  public addTenant(data: Omit<Tenant, 'id'>): Tenant {
    const newTenant: Tenant = {
      id: `ten_${Date.now()}`,
      ...data,
    };
    this.tenants.unshift(newTenant);
    // If assigned to a shop, update that shop's status to Occupied
    if (data.shop_id) {
      const shop = this.shops.find((s) => s.id === data.shop_id);
      if (shop) {
        shop.status = 'Occupied';
      }
    }
    this.saveToStorage();
    return newTenant;
  }

  public updateTenant(tenantId: string, updates: Partial<Tenant>): Tenant | undefined {
    const tenant = this.tenants.find((t) => t.id === tenantId);
    if (!tenant) return undefined;
    Object.assign(tenant, updates);
    this.saveToStorage();
    return tenant;
  }

  public deleteTenant(tenantId: string): boolean {
    const idx = this.tenants.findIndex((t) => t.id === tenantId);
    if (idx === -1) return false;
    const [removed] = this.tenants.splice(idx, 1);
    // Free up the shop
    if (removed.shop_id) {
      const shop = this.shops.find((s) => s.id === removed.shop_id);
      if (shop) {
        shop.status = 'Available';
      }
    }
    this.saveToStorage();
    return true;
  }

  public addShop(data: Omit<Shop, 'id'>): Shop {
    const newShop: Shop = {
      id: `shop_${Date.now()}`,
      ...data,
    };
    this.shops.unshift(newShop);
    this.saveToStorage();
    return newShop;
  }

  public deleteShop(shopId: string): boolean {
    const idx = this.shops.findIndex((s) => s.id === shopId);
    if (idx === -1) return false;
    this.shops.splice(idx, 1);
    this.saveToStorage();
    return true;
  }

  public addLease(data: Omit<Lease, 'id'>): Lease {
    const newLease: Lease = {
      id: `lease_${Date.now()}`,
      ...data,
    };
    this.leases.unshift(newLease);
    this.saveToStorage();
    return newLease;
  }

  public updateLease(leaseId: string, updates: Partial<Lease>): Lease | undefined {
    const lease = this.leases.find((l) => l.id === leaseId);
    if (!lease) return undefined;
    Object.assign(lease, updates);
    this.saveToStorage();
    return lease;
  }

  public deleteLease(leaseId: string): boolean {
    const idx = this.leases.findIndex((l) => l.id === leaseId);
    if (idx === -1) return false;
    this.leases.splice(idx, 1);
    this.saveToStorage();
    return true;
  }

  public addVendor(data: Omit<Vendor, 'id'>): Vendor {
    const newVendor: Vendor = {
      id: `ven_${Date.now()}`,
      ...data,
    };
    this.vendors.unshift(newVendor);
    this.saveToStorage();
    return newVendor;
  }

  public updateVendor(vendorId: string, updates: Partial<Vendor>): Vendor | undefined {
    const vendor = this.vendors.find((v) => v.id === vendorId);
    if (!vendor) return undefined;
    Object.assign(vendor, updates);
    this.saveToStorage();
    return vendor;
  }

  public deleteVendor(vendorId: string): boolean {
    const idx = this.vendors.findIndex((v) => v.id === vendorId);
    if (idx === -1) return false;
    this.vendors.splice(idx, 1);
    this.saveToStorage();
    return true;
  }

  public addFinanceTransaction(data: Omit<FinanceTransaction, 'id'>): FinanceTransaction {
    const newTx: FinanceTransaction = {
      id: `tx_${Date.now()}`,
      ...data,
    };
    this.financeTransactions.unshift(newTx);
    this.saveToStorage();
    return newTx;
  }

  public updateFinanceTransaction(txId: string, updates: Partial<FinanceTransaction>): FinanceTransaction | undefined {
    const tx = this.financeTransactions.find((t) => t.id === txId);
    if (!tx) return undefined;
    Object.assign(tx, updates);
    this.saveToStorage();
    return tx;
  }
}

export const db = new DatabaseService();
