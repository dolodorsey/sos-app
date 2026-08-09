import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('SOS recovery host is mounted globally but only shows on account login surfaces',()=>{
 const layout=read('src/app/layout.jsx')
 const host=read('src/components/SOSPasswordRecoveryHost.jsx')
 assert.match(layout,/SOSPasswordRecoveryHost/)
 assert.match(host,/\.sos2-auth-panel,\.shc-auth-card/)
 assert.match(host,/\/hero\/claim/)
 assert.match(host,/Forgot password\?/)
})

test('SOS reset email returns to customer or Hero route and uses the recovery endpoint',()=>{
 const host=read('src/components/SOSPasswordRecoveryHost.jsx')
 assert.match(host,/\/auth\/v1\/recover\?redirect_to=/)
 assert.match(host,/window\.location\.pathname\.startsWith\('\/hero'\)\?'\/hero':'\/app'/)
})

test('recovery token is separated from normal confirmation session restoration',()=>{
 const bridge=read('src/components/SOSAuthRedirectSessionHost.jsx')
 assert.match(bridge,/type==='recovery'/)
 assert.match(bridge,/sos_password_recovery/)
 assert.match(bridge,/sos-password-recovery/)
 const recoveryBranch=bridge.slice(bridge.indexOf("if(type==='recovery')"),bridge.indexOf('const userResponse='))
 assert.doesNotMatch(recoveryBranch,/sos_session/)
})

test('new password update uses only the recovery bearer token and clears it afterward',()=>{
 const host=read('src/components/SOSPasswordRecoveryHost.jsx')
 assert.match(host,/\/auth\/v1\/user/)
 assert.match(host,/method:'PUT'/)
 assert.match(host,/Authorization:`Bearer \$\{token\.access_token\}`/)
 assert.match(host,/JSON\.stringify\(\{password\}\)/)
 assert.match(host,/localStorage\.removeItem\('sos_password_recovery'\)/)
 assert.match(host,/Recovery changes only your login password/)
})
