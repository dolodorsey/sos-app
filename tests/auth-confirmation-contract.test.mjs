import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('global SOS auth guard is mounted and intercepts only create-account submits',()=>{
 const layout=read('src/app/layout.jsx')
 const guard=read('src/components/SOSAuthConfirmationGuard.jsx')
 assert.match(layout,/SOSAuthConfirmationGuard/)
 assert.match(guard,/document\.addEventListener\('submit',handle,true\)/)
 assert.match(guard,/create account\|create citizen account\|create hero account\|create\.\*account/i)
 assert.match(guard,/if\(!allowed\|\|!createMode\)return/)
})

test('SOS signup returns to the correct customer or Hero-claim route and does not immediately password-sign-in',()=>{
 const guard=read('src/components/SOSAuthConfirmationGuard.jsx')
 assert.match(guard,/\/auth\/v1\/signup\?redirect_to=/)
 assert.match(guard,/path\.startsWith\('\/hero\/claim'\)\?'\/hero\/claim':'\/app'/)
 assert.match(guard,/if\(d\.access_token\)/)
 assert.doesNotMatch(guard,/grant_type=password/)
 assert.match(guard,/live Auth configuration requires email confirmation/i)
})

test('SOS confirmation guard supports resend and same-email sign-in after confirmation',()=>{
 const guard=read('src/components/SOSAuthConfirmationGuard.jsx')
 assert.match(guard,/\/auth\/v1\/resend\?redirect_to=/)
 assert.match(guard,/type:'signup',email/)
 assert.match(guard,/I confirmed — sign in/)
 assert.match(guard,/Do not create a second account/)
})
