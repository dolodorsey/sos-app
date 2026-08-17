import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const customer = readFileSync(new URL('../src/components/SOSCustomerMobilityApp.jsx', import.meta.url), 'utf8')
const responsive = readFileSync(new URL('../src/components/sos-responsive-contract.css', import.meta.url), 'utf8')

test('S.O.S. Services opens with categories instead of the complete service list', () => {
  assert.match(customer, /const\[category,setCategory\]=useState\(''\)/)
  assert.match(customer, /Choose a category\./)
  assert.match(customer, /sos2-services-categories/)
  assert.match(customer, /category\|\|query\?<.*sos2-service-list/s)
})

test('a selected category shows only its services and can return to category selection', () => {
  assert.match(customer, /!category\|\|category==='all'\|\|service\.category_id===category/)
  assert.match(customer, /Back to categories/)
  assert.match(customer, /setCategory\(''\);setQuery\(''\)/)
  assert.match(customer, /if\(id==='services'\)setCategory\(''\)/)
})

test('category and service selection stays three-across as the customer requested', () => {
  assert.match(responsive, /sos2-services-categories/)
  assert.match(responsive, /@media \(max-width: 520px\)[\s\S]*sos2-services-categories[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(responsive, /sos2-quick-grid,[\s\S]*sos2-service-list[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
})
