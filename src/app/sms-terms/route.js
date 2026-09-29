import { renderPage, htmlResponse } from '../_a2p/a2p-pages.mjs';
const BRAND = {"key": "sos", "name": "S.O.S.", "domain": "thesuperherosonstandby.com", "home": "/", "privacyPath": "/privacy", "termsPath": "/terms", "programDescription": "Sign up for S.O.S. texts for roadside-service updates, launch news, and offers.", "messageTypes": "S.O.S. roadside-service request updates, launch and coverage-area announcements, promotions, and customer-service follow-up."};
export const dynamic = 'force-static';
export function GET() { return htmlResponse(renderPage('sms-terms', BRAND)); }
