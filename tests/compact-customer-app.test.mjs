import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('customer app stays compact: small service tiles, 4-across categories, short hero, compact profile', () => {
  const css = read('src/components/sos-launch.css')
  const app = read('src/components/SOSCustomerMobilityApp.jsx')
  assert.match(css, /\.sos2-quick-grid \{ display: grid !important; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\) !important/)
  assert.match(css, /\.sos2-category-grid \{ display: grid !important; grid-template-columns: repeat\(4, minmax\(0, 1fr\)\) !important/)
  assert.match(css, /\.sos3-home-motion \{ height: 118px !important/)
  assert.match(css, /\.sos2-quick-grid > button small \{ display: none !important/)
  assert.doesNotMatch(css, /grid-column: span 3 !important/)
  assert.match(app, /Heroes typically arrive in 15–30 min/)
  assert.doesNotMatch(app, /coming soon`:NOT_AVAILABLE_LABEL/)
})

test('customer status area never shows internal Hero network counts', () => {
  const membership = read('src/components/SOSMembershipHost.jsx')
  assert.doesNotMatch(membership, /Network activation in progress/)
  assert.doesNotMatch(membership, /checks passed/)
})
