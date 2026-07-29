// Household members are no longer hardcoded — manage them on the Settings
// page (/settings). They're stored via db.js `people` collection (see
// DEFAULT_PEOPLE there for the seed used the very first time the app runs).
//
// This file just holds the few things that stay constant regardless of who
// the family members are: the synthetic "Everyone" pseudo-person used to mark
// shared events/tasks, and the color palette offered when adding a new person.

export const ALL = { id: 'all', name: 'Everyone', color: '#10b981' } // green

export const COLOR_PALETTE = [
  '#3b82f6', // blue
  '#ec4899', // pink
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ef4444', // red
  '#84cc16', // lime
  '#f97316', // orange
]

export const MAINTENANCE_CATEGORIES = [
  'HVAC',
  'Plumbing',
  'Electrical',
  'Appliances',
  'Lawn & Garden',
  'Cleaning',
  'Safety (smoke/CO detectors)',
  'Pest Control',
  'Other',
]
