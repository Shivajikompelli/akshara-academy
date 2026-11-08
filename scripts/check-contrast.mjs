/**
 * WCAG 2.1 Contrast Ratio Verification Script
 * Validates text and background color pairs from akshara-ui-profile.md
 * Thresholds:
 *  - Normal text (< 18px regular): >= 4.5:1
 *  - Large text (>= 18px or >= 14px bold) & UI icons: >= 3.0:1
 */

function hexToRgb(hex) {
  let clean = hex.replace('#', '').trim()
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('')
  }
  const num = parseInt(clean, 16)
  return [num >> 16, (num >> 8) & 255, num & 255]
}

function relativeLuminance([r, g, b]) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function getContrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hexToRgb(hex1))
  const l2 = relativeLuminance(hexToRgb(hex2))
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

const COLOR_PAIRS = [
  // Primary Text & Secondary Text
  { name: 'Primary Text on White', text: '#1F2438', bg: '#FFFFFF', minRatio: 4.5, role: 'Normal Text' },
  { name: 'Primary Text on App Background', text: '#1F2438', bg: '#F8F9FE', minRatio: 4.5, role: 'Normal Text' },
  { name: 'Secondary Text on White', text: '#5A6378', bg: '#FFFFFF', minRatio: 4.5, role: 'Normal Text' },
  { name: 'Secondary Text on App Background', text: '#5A6378', bg: '#F8F9FE', minRatio: 4.5, role: 'Normal Text' },
  
  // Decorative Text & Icons (>= 18px text / icons)
  { name: 'Decorative Text / Icons on White', text: '#7E869B', bg: '#FFFFFF', minRatio: 3.0, role: 'Large Text / Icons' },
  { name: 'Decorative Text / Icons on App Background', text: '#7E869B', bg: '#F8F9FE', minRatio: 3.0, role: 'Large Text / Icons' },

  // Status Colors (Present)
  { name: 'Present Text on Present Background', text: '#047857', bg: '#ECFDF5', minRatio: 4.5, role: 'Normal Text' },
  { name: 'Present Text on White', text: '#047857', bg: '#FFFFFF', minRatio: 4.5, role: 'Normal Text' },

  // Status Colors (Absent)
  { name: 'Absent Text on Absent Background', text: '#B42318', bg: '#FEF2F2', minRatio: 4.5, role: 'Normal Text' },
  { name: 'Absent Text on White', text: '#B42318', bg: '#FFFFFF', minRatio: 4.5, role: 'Normal Text' },

  // Status Colors (Warn / Partial)
  { name: 'Warn Text on Warn Background', text: '#8A5300', bg: '#FFFBEB', minRatio: 4.5, role: 'Normal Text' },
  { name: 'Warn Text on White', text: '#8A5300', bg: '#FFFFFF', minRatio: 4.5, role: 'Normal Text' },

  // Status Colors (WhatsApp)
  { name: 'WhatsApp Text on WhatsApp Background', text: '#146C43', bg: '#E7F8E8', minRatio: 4.5, role: 'Normal Text' },
  { name: 'WhatsApp Text on White', text: '#146C43', bg: '#FFFFFF', minRatio: 4.5, role: 'Normal Text' },

  // Brand Buttons (Purple default)
  { name: 'White Text on Primary Button (#5B45E0)', text: '#FFFFFF', bg: '#5B45E0', minRatio: 4.5, role: 'Button Text' },
  { name: 'White Text on Primary Hover (#4D36D4)', text: '#FFFFFF', bg: '#4D36D4', minRatio: 4.5, role: 'Button Text' },
  { name: 'Primary Text on Primary Soft (#F4F2FD)', text: '#5B45E0', bg: '#F4F2FD', minRatio: 4.5, role: 'Normal Text' },
  { name: 'Primary Text on Primary Light (#EDEAFC)', text: '#5B45E0', bg: '#EDEAFC', minRatio: 4.5, role: 'Normal Text' },
]

console.log('=== Akshara Academy UI Contrast Ratio Test ===\n')
let failed = 0

for (const pair of COLOR_PAIRS) {
  const ratio = getContrastRatio(pair.text, pair.bg)
  const ratioStr = ratio.toFixed(2) + ':1'
  const passed = ratio >= pair.minRatio

  if (passed) {
    console.log(`PASS [${ratioStr} >= ${pair.minRatio}:1] ${pair.name} (${pair.role})`)
  } else {
    console.error(`FAIL [${ratioStr} < ${pair.minRatio}:1] ${pair.name} (${pair.role})`)
    failed++
  }
}

console.log(`\nResults: ${COLOR_PAIRS.length - failed} passed, ${failed} failed.`)

if (failed > 0) {
  process.exit(1)
} else {
  console.log('All profile contrast ratios satisfy WCAG 2.1 AA specifications!')
  process.exit(0)
}

