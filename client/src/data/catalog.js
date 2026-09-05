import { LifeBuoy, ScanFace, Video, Wrench } from 'lucide-react';

/*
 * Static for now — this is the shape a future GET /api/public/products would
 * return. imageUrl is null until the backend's Product/category image
 * columns land (see docs/SOURCE_OF_TRUTH.md catalog note); every card falls
 * back to CATEGORY_ICONS until then, so wiring real URLs later is a data
 * change, not a component rewrite.
 */

export const CATEGORIES = [
  {
    key: 'surveillance',
    label: 'Video Surveillance',
    blurb: 'IP cameras and NVRs sized to your site, with cloud storage and analytics for the locations that need it.',
  },
  {
    key: 'access',
    label: 'Access Control & Attendance',
    blurb: 'ZKTeco biometric terminals and controllers, wired into cloud attendance and your payroll.',
  },
  {
    key: 'install',
    label: 'Installation & Cabling',
    blurb: 'Site survey, structured cabling and commissioning from certified technicians.',
  },
  {
    key: 'amc',
    label: 'AMC & Support',
    blurb: 'Comprehensive annual maintenance so systems keep running long after go-live.',
  },
];

// Presentation-only fallback — not part of the eventual API response shape.
export const CATEGORY_ICONS = {
  surveillance: Video,
  access: ScanFace,
  install: Wrench,
  amc: LifeBuoy,
};

export const CATEGORY_LABELS = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.label])
);

export const CATALOG = [
  {
    id: 'cam-dome-4mp',
    category: 'surveillance',
    name: 'IP Dome Camera, 4MP',
    description: 'Indoor/outdoor dome camera with night vision — the standard fit for offices and factory floors.',
    price: 6800,
    cycle: null,
    imageUrl: null,
  },
  {
    id: 'cam-bullet-4mp',
    category: 'surveillance',
    name: 'IP Bullet Camera, 4MP, Outdoor',
    description: 'Weatherproof long-range camera for perimeters, gates and yards.',
    price: 7400,
    cycle: null,
    imageUrl: null,
  },
  {
    id: 'nvr-16ch',
    category: 'surveillance',
    name: 'NVR, 16-Channel',
    description: 'Records and manages up to 16 cameras from a single unit.',
    price: 38000,
    cycle: null,
    imageUrl: null,
  },
  {
    id: 'hdd-4tb',
    category: 'surveillance',
    name: 'Surveillance-Grade HDD, 4TB',
    description: 'Built for 24/7 write cycles — standard drives fail early under continuous recording.',
    price: 9500,
    cycle: null,
    imageUrl: null,
  },
  {
    id: 'poe-switch-16',
    category: 'surveillance',
    name: 'PoE Network Switch, 16-Port',
    description: 'Powers and networks up to 16 cameras or access terminals over a single cable run.',
    price: 14500,
    cycle: null,
    imageUrl: null,
  },
  {
    id: 'camera-mount-kit',
    category: 'surveillance',
    name: 'Camera Mount / Housing Kit',
    description: 'Weatherproof mounting hardware for outdoor camera installs.',
    price: 1100,
    cycle: null,
    imageUrl: null,
  },
  {
    id: 'cloud-storage',
    category: 'surveillance',
    name: 'Cloud Video Storage',
    description: 'Off-site backup per camera, so footage survives a damaged or stolen NVR.',
    price: 450,
    cycle: 'month',
    imageUrl: null,
  },
  {
    id: 'ai-analytics',
    category: 'surveillance',
    name: 'AI Analytics — People Counting / ANPR',
    description: 'Turns existing camera feeds into footfall counts or number-plate reads, per camera.',
    price: 600,
    cycle: 'month',
    imageUrl: null,
  },
  {
    id: 'zkteco-speedface-v5l',
    category: 'access',
    name: 'ZKTeco SpeedFace V5L',
    description: 'Face + fingerprint terminal for entry doors and attendance in one device.',
    price: 18500,
    cycle: null,
    imageUrl: null,
  },
  {
    id: 'zkteco-inbio260',
    category: 'access',
    name: 'ZKTeco inBio260',
    description: 'Two-door access controller — the backbone of a multi-door access system.',
    price: 22000,
    cycle: null,
    imageUrl: null,
  },
  {
    id: 'zkteco-k40',
    category: 'access',
    name: 'ZKTeco K40',
    description: 'Compact fingerprint terminal for smaller sites and single-door attendance.',
    price: 8200,
    cycle: null,
    imageUrl: null,
  },
  {
    id: 'em-lock-600',
    category: 'access',
    name: 'Electromagnetic Lock, 600 lbs',
    description: 'Fail-safe door lock rated for standard commercial entry doors.',
    price: 3200,
    cycle: null,
    imageUrl: null,
  },
  {
    id: 'zkbiotime-cloud',
    category: 'access',
    name: 'ZKBioTime Cloud Attendance',
    description: 'Cloud attendance software, priced per 100 employees, integrates with your payroll.',
    price: 2400,
    cycle: 'month',
    imageUrl: null,
  },
  {
    id: 'site-survey',
    category: 'install',
    name: 'Site Survey & Design',
    description: 'An engineer visits your site and plans exact camera/terminal placement before anything is quoted.',
    price: 10000,
    cycle: null,
    imageUrl: null,
  },
  {
    id: 'structured-cabling',
    category: 'install',
    name: 'Structured Cabling (per point)',
    description: 'Cable runs for a single camera or terminal point, priced per point.',
    price: 850,
    cycle: null,
    imageUrl: null,
  },
  {
    id: 'onsite-install',
    category: 'install',
    name: 'Onsite Installation & Commissioning',
    description: 'Mounting, wiring and configuration by certified technicians.',
    price: 15000,
    cycle: null,
    imageUrl: null,
  },
  {
    id: 'hrms-integration',
    category: 'install',
    name: 'HRMS / Payroll Integration',
    description: 'Connects attendance data directly into your existing payroll system.',
    price: 35000,
    cycle: null,
    imageUrl: null,
  },
  {
    id: 'user-training',
    category: 'install',
    name: 'User Training (per batch)',
    description: 'A hands-on session for your staff on day-to-day system use.',
    price: 8000,
    cycle: null,
    imageUrl: null,
  },
  {
    id: 'amc-comprehensive',
    category: 'amc',
    name: 'AMC Comprehensive (per device)',
    description: 'Annual maintenance covering servicing, repairs and priority callouts.',
    price: 2800,
    cycle: 'year',
    imageUrl: null,
  },
];
