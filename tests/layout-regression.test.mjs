import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('desktop rescue stylesheet is imported after every earlier SOS stylesheet', () => {
  const layout = read('src/app/layout.jsx')
  const rescueIndex = layout.indexOf("import '../components/sos-root-layout-rescue.css'")
  for (const earlier of [
    "import './globals.css'",
    "import '../components/sos-mobility.css'",
    "import '../components/sos-customer-v2.css'",
    "import '../components/sos-elite.css'",
    "import '../components/sos-desktop-final.css'",
    "import '../components/sos-membership.css'",
    "import '../components/sos-profile-tools.css'",
    "import '../components/sos-operations-command.css'",
  ]) assert.ok(rescueIndex > layout.indexOf(earlier), `${earlier} must load before the desktop rescue stylesheet`)
})

test('desktop customer and Hero products break out of the legacy 450px app shell', () => {
  const rescue = read('src/components/sos-root-layout-rescue.css')
  assert.match(rescue, /@media \(min-width: 900px\)/)
  assert.match(rescue, /\.app-shell\.sos-premium[\s\S]*?max-width:\s*none\s*!important/)
  assert.match(rescue, /\.sos2-app[\s\S]*?max-width:\s*none\s*!important/)
  assert.match(rescue, /\.shc-app,[\s\S]*?max-width:\s*none\s*!important/)
  assert.match(rescue, /\.sos2-auth,[\s\S]*?max-width:\s*480px\s*!important/)
})

test('desktop SOS customer and Hero products cannot regress to micro-sized phone typography', () => {
  const rescue = read('src/components/sos-root-layout-rescue.css')
  assert.match(rescue, /\.sos2-service-list strong,[\s\S]*?font-size:\s*14px\s*!important/)
  assert.match(rescue, /\.sos2-service-list p,[\s\S]*?font-size:\s*12px\s*!important/)
  assert.match(rescue, /\.sos2-nav button small[\s\S]*?font-size:\s*10px\s*!important/)
  assert.match(rescue, /\.shc-mission-list strong,[\s\S]*?font-size:\s*13px\s*!important/)
  assert.match(rescue, /\.shc-metrics small,[\s\S]*?font-size:\s*10px\s*!important/)
})

test('all standalone routes receive history-aware back navigation with logical fallbacks', () => {
  const layout = read('src/app/layout.jsx')
  const shell = read('src/components/SOSRouteShell.jsx')
  assert.match(layout, /SOSRouteShell/)
  assert.match(shell, /window\.history\.length > 1/)
  assert.match(shell, /sameOriginReferrer/)
  assert.match(shell, /router\.back\(\)/)
  assert.match(shell, /router\.replace\(fallback\)/)
  for (const fallback of ["'/hero'", "'/ops'", "'/login'", "'/app'"]) assert.match(shell, new RegExp(fallback))
})

test('final responsive contract loads last and reserves rather than overlays app chrome', () => {
  const layout = read('src/app/layout.jsx')
  const contract = read('src/components/sos-responsive-contract.css')
  assert.ok(layout.indexOf("sos-responsive-contract.css") > layout.indexOf("sos-ui-v3-desktop-fix.css"))
  assert.match(contract, /\.sos-ui-v3 \.sos2-app[\s\S]*?display:\s*flex\s*!important/)
  assert.match(contract, /\.sos-ui-v3 \.sos2-content[\s\S]*?overflow-y:\s*auto\s*!important/)
  assert.match(contract, /\.sos-ui-v3 \.sos2-nav[\s\S]*?position:\s*relative\s*!important/)
  assert.match(contract, /@media \(min-width: 521px\) and \(max-width: 899px\)/)
  assert.match(contract, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/)
})

test('in-app back control is hidden on Home and shown for tabs or overlays', () => {
  const host = read('src/components/SOSShellControlHost.jsx')
  assert.match(host, /setShowBack\(Boolean\(layer\|\|\(active&&home&&active!==home\)\)\)/)
  assert.match(host, /header&&showBack\?createPortal/)
})

test('notification prompts hydrate from a stable server-safe initial state', () => {
  for (const path of [
    'src/components/SOSCustomerLiveHost.jsx',
    'src/components/SOSCustomerOperationsHost.jsx',
    'src/components/SOSHeroAlertsHost.jsx',
  ]) {
    const host = read(path)
    assert.doesNotMatch(host, /useState\(\(\)=>typeof Notification/)
    assert.match(host, /useState\('denied'\)/)
    assert.match(host, /setPermission\(Notification\.permission\)/)
  }
})

test('fee-review component never reads localStorage during state initialization', () => {
  const review = read('src/components/SOSSettlementReviewHost.jsx')
  assert.doesNotMatch(review, /useState\s*\(\s*\(\s*\)\s*=>\s*localStorage/)
  assert.match(review, /useEffect\(\(\)=>\{let disposed=false;try\{setDismissed\(localStorage/)
})

test('customer and Hero portals mount the real operations layers', () => {
  const customer = read('src/app/app/page.jsx')
  const hero = read('src/app/hero/page.jsx')
  for (const host of ['SOSCustomerRealtimeShell','SOSCustomerOperationsHost','SOSCustomerCancellationHost','SOSSettlementReviewHost','SOSMissionChatHost','SOSPaymentReadinessHost','SOSMembershipHost','SOSProfileToolsHost','SOSPushRegistrationHost']) assert.match(customer, new RegExp(host))
  for (const host of ['SOSHeroRealtimeShell','SOSHeroAlertsHost','SOSHeroIssueHost','SOSHeroNoShowHost','SOSHeroReliabilityHost','SOSMissionChatHost','SOSPaymentReadinessHost','SOSPushRegistrationHost']) assert.match(hero, new RegExp(host))
})

test('Hero Command is realtime-first with polling only as fallback', () => {
  const shell = read('src/components/SOSHeroRealtimeShell.jsx')
  assert.match(shell, /realtime\.setAuth\(s\.access_token\)/)
  for (const table of ['sos_mission_offers','sos_missions','sos_payments']) assert.match(shell,new RegExp(`table:'${table}'`))
  assert.match(shell, /LIVE DATA/)
  assert.match(shell, /POLLING FALLBACK/)
})

test('SOS customer mission state is realtime-first with polling only as fallback', () => {
  const shell=read('src/components/SOSCustomerRealtimeShell.jsx')
  assert.match(shell,/realtime\.setAuth\(s\.access_token\)/)
  for(const table of ['sos_missions','sos_payments','sos_mission_offers']) assert.match(shell,new RegExp(`table:'${table}'`))
  assert.match(shell,/LIVE DATA/)
  assert.match(shell,/POLLING FALLBACK/)
})

test('SOS browser push registration is mounted for customer and Hero portals', () => {
  const customer=read('src/app/app/page.jsx'),hero=read('src/app/hero/page.jsx'),host=read('src/components/SOSPushRegistrationHost.jsx'),worker=read('public/marketplace-sw.js')
  assert.match(customer,/SOSPushRegistrationHost/)
  assert.match(hero,/SOSPushRegistrationHost/)
  assert.match(host,/marketplace-push-config/)
  assert.match(host,/marketplace_register_push_subscription/)
  assert.match(host,/p_app:'sos'/)
  assert.match(host,/serviceWorker\.register\('\/marketplace-sw\.js'/)
  assert.match(worker,/addEventListener\('push'/)
  assert.match(worker,/showNotification/)
  assert.match(worker,/notificationclick/)
})

test('visible SOS profile controls are direct and backed by real account operations', () => {
  const customer = read('src/components/SOSCustomerMobilityApp.jsx')
  const tools = read('src/components/SOSProfileToolsHost.jsx')
  const support = read('src/app/support/page.jsx')
  const migration = read('supabase/migrations/20260809033000_finish_sos_profile_tools_and_support.sql')
  for (const label of ['Vehicles','Payment methods','Shield membership','Safety & support']) assert.match(customer,new RegExp(label.replace(/[&]/g,'\\&')))
  assert.match(customer,/sos:open-profile-tool/)
  assert.match(customer,/sos:open-shield/)
  assert.match(customer,/sb_publishable_/)
  assert.doesNotMatch(customer,/coming next/i)
  assert.doesNotMatch(customer,/eyJ[a-zA-Z0-9_-]+\./)
  assert.match(tools,/addEventListener\('sos:open-profile-tool'/)
  assert.doesNotMatch(tools,/document\.addEventListener\('click'/)
  for (const rpc of ['sos_upsert_vehicle','sos_delete_vehicle','sos_set_default_vehicle','sos_open_support_ticket']) assert.match(tools,new RegExp(rpc))
  assert.match(tools,/sos_payments/)
  assert.match(tools,/marketplace-payments-health/)
  assert.match(migration,/enable row level security/)
  assert.match(migration,/user_id=public\.sos_current_user_id\(\)/)
  assert.match(support,/sos_open_support_ticket/)
  assert.doesNotMatch(support,/thedoctordorsey@gmail\.com/i)
  assert.doesNotMatch(support,/Get In Touch/i)
})

test('S.O.S. operations command is operator-only and manages real candidate, verification, and support queues',()=>{
  const page=read('src/app/ops/page.jsx')
  const ops=read('src/components/SOSOperationsCommand.jsx')
  const migration=read('supabase/migrations/20260809044500_add_sos_operations_command.sql')
  assert.match(page,/SOSOperationsCommand/)
  for(const rpc of ['sos_ops_snapshot','sos_ops_update_candidate','sos_ops_review_verification_check','sos_ops_update_support_ticket']) assert.match(ops,new RegExp(rpc))
  assert.match(ops,/CLAIM NEEDED/)
  assert.match(ops,/VERIFICATION CHECKS/)
  assert.match(ops,/Support/)
  assert.match(migration,/private\.marketplace_operators/)
  assert.match(migration,/private\.is_marketplace_operator\(auth\.uid\(\)\)/)
  assert.match(migration,/revoke execute on function public\.sos_ops_snapshot\(\) from public,anon/)
  assert.match(migration,/sos_hero_verification_checks/)
  assert.match(migration,/sos_support_tickets/)
})
