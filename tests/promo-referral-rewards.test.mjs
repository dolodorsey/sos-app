import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const mig = read('supabase/migrations/20261125010000_sos_promo_referral_rewards.sql')

test('ATLSUPERHERO: one free service, valid through Dec 31 2026 Atlanta time, once per customer', () => {
  assert.match(mig, /'ATLSUPERHERO', 'free_service', '1 free service'/)
  assert.match(mig, /timestamptz '2026-12-31 23:59:59 America\/New_York'/)
  assert.match(mig, /sos_credit_one_per_promo on public\.sos_customer_credits\(citizen_id, promo_code\)/)
})

test('referrals: 10 link opens -> 50% off once; every 5 sign-ups -> 1 complimentary service', () => {
  assert.match(mig, /if v_count >= 10 then[\s\S]{0,200}'percent_off', 50, 'referral_shares'/)
  assert.match(mig, /m := 5;[\s\S]{0,300}'free_service', 'referral_signups', m/)
  assert.match(mig, /m := m \+ 5;/)
  assert.match(mig, /raw_user_meta_data->>'ref'/, 'sign-up records who referred them')
  assert.match(mig, /cf-connecting-ip/, 'link opens count once per network')
})

test('rewards stay locked down', () => {
  assert.match(mig, /revoke all on public\.sos_promo_codes, public\.sos_customer_credits, public\.sos_referral_link_opens from anon, authenticated/)
  assert.match(mig, /sos_reserve_mission_credit[\s\S]{0,200}service_role/)
  assert.match(mig, /grant execute on function public\.sos_reserve_mission_credit\(uuid\), public\.sos_release_mission_credit\(uuid\) to service_role/)
  assert.match(mig, /sos_credit_one_per_mission/, 'one reward per job')
})

test('checkout applies the reward and the Hero is still paid in full from the S.O.S. balance', () => {
  const checkout = read('supabase/functions/create-mission-checkout/index.ts')
  assert.match(checkout, /sos_reserve_mission_credit/)
  assert.match(checkout, /sos_release_mission_credit/)
  assert.match(checkout, /payment_method:'promo_credit'/)
  for (const p of ['hero-complete-mission', 'manage-mission-payment', 'marketplace-payout-retry']) {
    const src = read(`supabase/functions/${p}/index.ts`)
    assert.match(src, /fromPlatform\?\{\}:\{source_transaction:/, `${p} pays discounted jobs from the platform balance`)
    assert.doesNotMatch(src, /,source_transaction:(chargeId|payment\.stripe_charge_id|p\.stripe_charge_id),/, `${p} has no unconditional source_transaction left`)
  }
})

test('app: rewards screen, ref and promo links, referrer saved at sign-up', () => {
  const host = read('src/components/SOSRewardsHost.jsx')
  assert.match(host, /sos_redeem_promo_code/)
  assert.match(host, /sos_my_rewards/)
  assert.match(host, /sos_referral_link_open/)
  assert.match(host, /q\.get\('promo'\)/)
  assert.match(read('src/app/app/page.jsx'), /<SOSRewardsHost\/>/)
  for (const p of ['src/components/SOSCustomerMobilityApp.jsx', 'src/components/SOSAuthConfirmationGuard.jsx'])
    assert.match(read(p), /ref:pendingReferral\(\)/)
})

test('ATL SUPERHERO works typed with a space, lowercase, or as one word', () => {
  // sos_redeem_promo_code strips everything but letters and digits, then upper-cases.
  assert.match(mig, /upper\(regexp_replace\(coalesce\(p_code,''\), '\[\^A-Za-z0-9\]', '', 'g'\)\)/)
  for (const typed of ['ATL SUPERHERO', 'atl superhero', 'ATLSUPERHERO', 'Atl-Superhero'])
    assert.equal(typed.replace(/[^A-Za-z0-9]/g, '').toUpperCase(), 'ATLSUPERHERO')
})

test('automatic payout retry and refunds respect the reward discount', () => {
  const retry = read('supabase/functions/marketplace-payout-retry/index.ts')
  assert.match(retry, /current==='authorized'&&rewardCovered/, 'covered jobs skip the card capture')
  assert.match(retry, /Number\(p\.amount\|\|0\)-Number\(p\.promo_discount\|\|0\)/, 'captures only what the customer owes')
  assert.match(retry, /\(chargeId\|\|fromPlatform\)/, 'covered jobs still queue the Hero payout')
  assert.match(read('supabase/functions/manage-mission-payment/index.ts'), /totalPaid=Number\(payment\.amount\|\|0\)-Number\(payment\.promo_discount\|\|0\)/, 'refunds never exceed what the customer paid')
})
