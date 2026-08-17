import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const customer = read('../src/components/SOSCustomerMobilityApp.jsx')
const hero = read('../src/components/SOSHeroMobilityApp.jsx')
const appPage = read('../src/app/app/page.jsx')
const realtime = read('../src/lib/sosRealtimeClient.js')
const realtimeConsumers = [
  '../src/components/SOSCustomerRealtimeShell.jsx',
  '../src/components/SOSNotificationInboxHost.jsx',
  '../src/components/SOSMissionChatHost.jsx',
  '../src/components/SOSCustomerOperationsHost.jsx',
  '../src/components/SOSHeroRealtimeShell.jsx',
  '../src/components/SOSHeroAlertsHost.jsx',
  '../src/components/SOSMissionTracker.jsx',
  '../src/components/SOSCustomerLiveHost.jsx',
].map(read)

test('customer and Hero startup requests have an abort deadline', () => {
  for (const source of [customer, hero]) {
    assert.match(source, /REQUEST_TIMEOUT_MS=10000/)
    assert.match(source, /new AbortController\(\)/)
    assert.match(source, /signal:controller\.signal/)
    assert.match(source, /error\?\.name==='AbortError'/)
    assert.match(source, /finally\{clearTimeout\(timer\)\}/)
  }
})

test('customer startup releases the loading screen before secondary data finishes', () => {
  const startup = customer.slice(customer.indexOf('useEffect(()=>{let active=true'), customer.indexOf("window.addEventListener('sos:vehicles-changed'"))
  assert.match(startup, /setSession\(existing\);setBooting\(false\);void Promise\.allSettled/)
  assert.match(startup, /finally\{if\(active\)setBooting\(false\)\}/)
  assert.doesNotMatch(startup, /await Promise\.all\(/)
})

test('the client-only customer shell always has a visible loading fallback', () => {
  assert.match(appPage, /loading:\s*\(\)\s*=>\s*<SOSLoading label="Connecting the response network" \/>/)
})

test('all realtime features share one non-persistent Supabase client', () => {
  assert.match(realtime, /globalThis\[CLIENT_KEY\]/)
  assert.match(realtime, /persistSession:false/)
  assert.match(realtime, /storageKey:'sos-realtime-session'/)
  for (const source of realtimeConsumers) {
    assert.doesNotMatch(source, /createClient/)
    assert.match(source, /SosRealtime/)
  }
})
