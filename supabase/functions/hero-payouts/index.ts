import Stripe from 'npm:stripe@18.5.0'
import { createClient } from 'npm:@supabase/supabase-js@2.112.0'

const ALLOWED_ORIGINS = new Set([
  'https://thesuperherosonstandby.com',
  'https://www.thesuperherosonstandby.com',
  'https://superherosonstandby.com',
  'https://www.superherosonstandby.com',
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
])

const cors = (req: Request) => {
  const origin = req.headers.get('Origin') || ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://thesuperherosonstandby.com',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}
const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors(req), 'Content-Type': 'application/json; charset=utf-8' },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405)
  const origin = req.headers.get('Origin') || ''
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(req, { error: 'Origin not allowed' }, 403)

  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!url || !anon || !service || !stripeKey) return json(req, { error: 'Payout setup is temporarily unavailable' }, 503)

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json(req, { error: 'Authentication required' }, 401)
  const scoped = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: authData, error: authError } = await scoped.auth.getUser()
  if (authError || !authData.user) return json(req, { error: 'Invalid or expired session' }, 401)

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: sosUser } = await admin.from('sos_users').select('id,role,email,first_name,last_name,status').eq('auth_id', authData.user.id).single()
  if (!sosUser || sosUser.role !== 'hero' || sosUser.status !== 'active') return json(req, { error: 'Active Hero account required' }, 403)
  const { data: hero } = await admin.from('sos_heroes').select('id,stripe_connect_id,verification_status').eq('user_id', sosUser.id).single()
  if (!hero) return json(req, { error: 'Hero profile not found' }, 404)

  const stripe = new Stripe(stripeKey)
  const input = await req.json().catch(() => ({})) as Record<string, unknown>
  const action = String(input.action || 'status')
  const base = Deno.env.get('SOS_PUBLIC_URL') || 'https://thesuperherosonstandby.com'

  let accountId = hero.stripe_connect_id as string | null
  if (!accountId && action === 'onboard') {
    const account = await stripe.accounts.create({
      country: 'US',
      email: sosUser.email || authData.user.email || undefined,
      controller: {
        fees: { payer: 'application' },
        losses: { payments: 'application' },
        requirement_collection: 'stripe',
        stripe_dashboard: { type: 'express' },
      },
      capabilities: { transfers: { requested: true } },
      business_profile: { product_description: 'S.O.S. roadside assistance Hero services' },
      metadata: { sos_hero_id: hero.id, sos_user_id: sosUser.id },
    })
    accountId = account.id
    await admin.from('sos_heroes').update({ stripe_connect_id: accountId, payout_method: 'stripe_connect', updated_at: new Date().toISOString() }).eq('id', hero.id)
  }

  if (!accountId) return json(req, { connected: false, payout_ready: false, requirements_due: [], message: 'Stripe payout setup is required before going on patrol.' })

  let account: Stripe.Account
  try { account = await stripe.accounts.retrieve(accountId) }
  catch {
    await admin.from('sos_heroes').update({ stripe_connect_id: null, payout_method: null, updated_at: new Date().toISOString() }).eq('id', hero.id)
    return json(req, { connected: false, payout_ready: false, requirements_due: [], error: 'Stored payout account could not be verified. Start payout setup again.' }, 409)
  }

  const transfers = account.capabilities?.transfers
  const payoutReady = transfers === 'active' && account.details_submitted && !account.requirements?.disabled_reason
  const statusPayload = {
    connected: true,
    payout_ready: Boolean(payoutReady),
    account_id: account.id,
    transfers_status: transfers || 'inactive',
    details_submitted: Boolean(account.details_submitted),
    requirements_due: account.requirements?.currently_due || [],
    disabled_reason: account.requirements?.disabled_reason || null,
  }

  if (action === 'status') return json(req, statusPayload)
  if (action !== 'onboard') return json(req, { error: 'Invalid action' }, 400)
  if (payoutReady) return json(req, statusPayload)

  const link = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${base}/hero/?connect=refresh`,
    return_url: `${base}/hero/?connect=return`,
    type: 'account_onboarding',
  })
  return json(req, { ...statusPayload, onboarding_url: link.url })
})
