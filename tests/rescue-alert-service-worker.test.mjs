import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8')
const sw=read('public/sw.js')
const legacy=read('public/marketplace-sw.js')
const push=read('src/components/SOSPushRegistrationHost.jsx')
const install=read('src/components/SOSInstallAppPrompt.jsx')

test('S.O.S. has one service worker that carries the rescue alert handlers',()=>{
 assert.match(sw,/addEventListener\('push'/)
 assert.match(sw,/showNotification\(/)
 assert.match(sw,/addEventListener\('notificationclick'/)
 assert.match(sw,/requireInteraction: urgent/)
})

test('every page registers the same worker on the root scope, so alerts are never replaced',()=>{
 assert.match(install,/register\('\/sw\.js', \{ scope:'\/' \}\)/)
 assert.match(push,/register\('\/sw\.js',\{scope:'\/'\}\)/)
 assert.doesNotMatch(push,/register\('\/marketplace-sw\.js'/)
})

test('phones registered on the old worker load the single worker',()=>{
 assert.match(legacy,/importScripts\('\/sw\.js'\)/)
 assert.doesNotMatch(legacy,/addEventListener\('push'/)
})
