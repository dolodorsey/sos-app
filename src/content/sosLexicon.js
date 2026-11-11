// S.O.S. SUPERHEROS lexicon and Knowledge Hub content.
//
// Single source of truth for /superheros, /wiki and /wiki/[slug]. The same
// records are mirrored into Supabase (public.sos_brand_content) by
// scripts/build-brand-content-seed.mjs so Muse and other operators read the
// exact text that is published.
//
// Content rules (enforced by tests/brand-spelling.test.mjs and
// tests/knowledge-hub-contract.test.mjs):
// - Plural brand term is always SUPERHEROS. Never add an E.
// - No prices, guaranteed response times, coverage promises, provider counts,
//   insurance agreements or partnership claims.
// - Pages are S.O.S.-published brand material, never presented as Wikipedia,
//   Wikimedia, Wiktionary or an independent dictionary.

export const SITE = 'https://thesuperherosonstandby.com';
export const PUBLISHED = '2026-11-11';
export const UPDATED = '2026-11-11';
export const PUBLISHER = 'S.O.S. — Superheros On Standby';

export const CUSTOMER_CTA = { href: '/app/', label: 'Request roadside help' };
export const PROVIDER_CTA = { href: '/hero/apply/', label: 'Join the SUPERHEROS network' };

export const OFFICIAL_DEFINITION =
  'SUPERHEROS are S.O.S. roadside assistance providers who help motorists with vehicle-related difficulties, including towing, jump-starts, tire changes, fuel delivery, and vehicle lockout services.';

export const DISCLOSURE =
  'This page is brand material published by S.O.S. — Superheros On Standby. It is not Wikipedia, is not affiliated with the Wikimedia Foundation, and is not an entry in an independent dictionary.';

export const CORE_SERVICES = [
  { slug: 'towing', name: 'Towing', short: 'Moving a vehicle that cannot be driven safely to a chosen destination.' },
  { slug: 'jump-start', name: 'Jump-starts', short: 'Restarting a vehicle with a weak or discharged battery.' },
  { slug: 'tire-change', name: 'Tire changes', short: 'Replacing a flat tire with the vehicle’s usable spare.' },
  { slug: 'fuel-delivery', name: 'Fuel delivery', short: 'Bringing enough fuel to get an empty vehicle moving again.' },
  { slug: 'lockout-service', name: 'Vehicle lockouts', short: 'Helping a driver regain access when keys are locked inside.' },
];

export const TERM = {
  name: 'SUPERHEROS',
  singular: 'SUPERHERO',
  plural: 'SUPERHEROS',
  partOfSpeech: 'noun (plural); S.O.S. brand term',
  pronunciation: 'SOO-per-heer-ohz',
  ipa: '/ˈsuːpərˌhɪəroʊz/',
  origin:
    'Coined by S.O.S. — Superheros On Standby as the name for its roadside assistance providers. The word builds on “superhero” and forms its plural with a plain S. The spelling is deliberate: it marks the word as an S.O.S. term for real people who help stranded drivers, separate from the general word for fictional characters.',
  usage: [
    'My battery died outside the stadium, so I requested a SUPERHERO through S.O.S.',
    'SUPERHEROS on the S.O.S. platform handle towing, jump-starts, tire changes, fuel delivery and lockouts.',
    'She joined the S.O.S. network and now works as a SUPERHERO in Atlanta.',
  ],
  usageNotes: [
    'Singular: SUPERHERO. Plural: SUPERHEROS — always without an E before the S.',
    'Capitalize the full word when it refers to the S.O.S. network or its providers.',
    'Use it for people and the provider network, not for the company. The company is S.O.S. — Superheros On Standby.',
  ],
};

export const TAGLINES = [
  'THE CITY HAS SUPERHEROS',
  'THEY DON’T FLY. THEY PULL UP.',
  'WHAT IS A SUPERHERO?',
  'EVERY CITY NEEDS SUPERHEROS',
  'STRANDED? CALL A SUPERHERO',
];

// Terms in the S.O.S. lexicon (Schema.org DefinedTermSet on /wiki).
export const LEXICON = [
  { id: 'superheros', name: 'SUPERHEROS', url: '/superheros/', description: OFFICIAL_DEFINITION },
  { id: 'superhero', name: 'SUPERHERO', url: '/wiki/roadside-terminology/#superhero', description: 'One S.O.S. roadside assistance provider. Singular of SUPERHEROS.' },
  { id: 'sos', name: 'S.O.S.', url: '/wiki/roadside-terminology/#sos', description: 'Short name for Superheros On Standby, the roadside assistance platform that connects drivers with SUPERHEROS.' },
  { id: 'mission', name: 'Mission', url: '/wiki/roadside-terminology/#mission', description: 'A single customer request for roadside help, tracked from request to completion in the S.O.S. app.' },
  { id: 'standby', name: 'Standby', url: '/wiki/roadside-terminology/#standby', description: 'The status of a provider who has joined the S.O.S. network but is not yet cleared to accept customer missions.' },
  { id: 'dispatch-ready', name: 'Dispatch-ready', url: '/wiki/roadside-terminology/#dispatch-ready', description: 'The status of a SUPERHERO who has completed required verification and can receive mission offers.' },
  { id: 'acceptance', name: 'Acceptance', url: '/wiki/roadside-terminology/#acceptance', description: 'The moment a qualified SUPERHERO agrees to take a mission. A request is not assigned before acceptance.' },
];

const S = {
  mw: { label: '“superhero” — Merriam-Webster Dictionary (general English word)', url: 'https://www.merriam-webster.com/dictionary/superhero', publisher: 'Merriam-Webster' },
  gdot: { label: 'Highway Emergency Response Operators (HERO) — Georgia Department of Transportation', url: 'https://www.dot.ga.gov/GDOT/Pages/HERO.aspx', publisher: 'Georgia DOT' },
  moveOver: { label: 'O.C.G.A. § 40-6-16 — Georgia “move over” law (Justia)', url: 'https://law.justia.com/codes/georgia/2020/title-40/chapter-6/article-1/section-40-6-16', publisher: 'Justia' },
  fhwa: { label: 'Traffic Incident Management: Move Over and Quick Clearance Laws — FHWA', url: 'https://ops.fhwa.dot.gov/publications/fhwahop09005/move_over.htm', publisher: 'U.S. Federal Highway Administration' },
  nhtsaTires: { label: 'Tires — National Highway Traffic Safety Administration', url: 'https://www.nhtsa.gov/vehicle-safety/tires', publisher: 'NHTSA' },
  brand: { label: 'S.O.S. Brand & Naming Guide', url: `${SITE}/brand/`, publisher: PUBLISHER, owned: true },
  why: { label: 'Why SUPERHEROS Is Spelled This Way', url: `${SITE}/why-superheros/`, publisher: PUBLISHER, owned: true },
  notNine: { label: 'S.O.S. is not a 911 service', url: `${SITE}/legal/`, publisher: PUBLISHER, owned: true },
};

// Knowledge Hub articles. Paragraph strings support [label](/internal/path/) links.
export const ARTICLES = [
  {
    slug: 'superheros',
    title: 'SUPERHEROS',
    category: 'Brand terms',
    metaTitle: 'SUPERHEROS — S.O.S. Knowledge Hub Entry',
    description: 'The S.O.S. Knowledge Hub entry for SUPERHEROS: meaning, brand origin, how the service model works, provider participation and frequently asked questions.',
    summary: 'The S.O.S. brand term for its roadside assistance providers, and the spelling behind it.',
    lead: OFFICIAL_DEFINITION,
    sections: [
      { id: 'definition', heading: 'Definition', body: [
        OFFICIAL_DEFINITION,
        'The singular is SUPERHERO. The plural is SUPERHEROS, written without an E before the final S. The short dictionary-style definition lives at [/superheros](/superheros/).',
      ]},
      { id: 'origin', heading: 'History and brand origin', body: [
        'S.O.S. stands for Superheros On Standby, a roadside assistance brand of The Kollective Hospitality Group based in Atlanta. The company chose SUPERHEROS as the name for the people who help drivers through its platform and built the company name around it.',
        'The spelling is intentional. The general English word for fictional characters with special powers forms its plural differently. S.O.S. uses its own spelling to mark the word as a brand term for real roadside providers, not comic-book characters. The naming story is told in [Why SUPERHEROS](/why-superheros/).',
        'S.O.S. opened to the public in metro Atlanta on November 11, 2026.',
      ]},
      { id: 'meaning', heading: 'Meaning within the S.O.S. network', body: [
        'Inside S.O.S., SUPERHEROS refers to the provider side of the platform: the people who receive mission offers, travel to the driver, and complete the service. Customers are the drivers who request help.',
        'The term describes a role on the platform. It does not by itself mean a provider is cleared to work; joining the network, being verified and being dispatch-ready are separate stages described in [Provider network](/wiki/provider-network/).',
      ]},
      { id: 'service-model', heading: 'How the service model works', body: [
        'A driver opens the S.O.S. app, chooses a service and shares a precise location. The request is offered to qualified SUPERHEROS nearby. The request is not assigned until one SUPERHERO accepts it, and the app shows status from live mission data rather than estimates.',
        'At launch S.O.S. offers five core services in metro Atlanta: [towing](/wiki/towing/), [jump-starts](/wiki/jump-start/), [tire changes](/wiki/tire-change/), [fuel delivery](/wiki/fuel-delivery/) and [vehicle lockouts](/wiki/lockout-service/). Other services shown in the app are marked as not available yet. The full flow is described in [How S.O.S. works](/wiki/how-sos-works/).',
      ]},
      { id: 'providers', heading: 'Provider participation', body: [
        'Tow operators, mobile roadside technicians and lockout specialists can apply to become SUPERHEROS at [the provider application](/hero/apply/). An application is not approval, and approval is not the same as being ready for dispatch.',
        'Before a SUPERHERO can accept customer missions, S.O.S. requires license, insurance and background verification steps to be completed and reviewed. See [Safety standards](/wiki/safety-standards/).',
      ]},
      { id: 'disambiguation', heading: 'Not to be confused with', body: [
        'Georgia’s Department of Transportation runs a separate public program called HERO (Highway Emergency Response Operators) that patrols metro Atlanta freeways. S.O.S. and its SUPERHEROS are not affiliated with GDOT or the HERO program.',
        'SUPERHEROS are also unrelated to fictional superhero characters, publishers or franchises.',
      ]},
    ],
    faq: [
      { q: 'Is SUPERHEROS a misspelling?', a: 'No. SUPERHEROS is the deliberate S.O.S. spelling for its roadside assistance providers. It is always written without an E before the final S.' },
      { q: 'What is the singular of SUPERHEROS?', a: 'SUPERHERO. One provider is a SUPERHERO; two or more are SUPERHEROS.' },
      { q: 'What services do SUPERHEROS provide?', a: 'Towing, jump-starts, tire changes, fuel delivery and vehicle lockout help. These are the five core services S.O.S. offers at launch in metro Atlanta.' },
      { q: 'Is S.O.S. an emergency service?', a: 'No. S.O.S. is roadside assistance, not 911. If anyone is hurt or in danger, call 911 first.' },
      { q: 'Are SUPERHEROS part of the GDOT HERO program?', a: 'No. GDOT HERO is a separate state program. S.O.S. is not affiliated with it.' },
      { q: 'How do I become a SUPERHERO?', a: 'Apply through the S.O.S. provider application. Verification must be completed before you can accept customer missions.' },
      { q: 'Is SUPERHEROS a registered trademark?', a: 'S.O.S. uses SUPERHEROS as a brand term. This page is not a statement of registered trademark rights.' },
    ],
    related: ['how-sos-works', 'provider-network', 'roadside-terminology', 'safety-standards'],
    sources: [S.mw, S.gdot, S.brand, S.why],
  },
  {
    slug: 'roadside-assistance',
    title: 'Roadside assistance',
    category: 'Services',
    metaTitle: 'Roadside Assistance — S.O.S. Knowledge Hub',
    description: 'What roadside assistance covers, the five core services S.O.S. offers in metro Atlanta, and how it differs from emergency response.',
    summary: 'On-the-spot help for drivers whose vehicles cannot continue safely.',
    lead: 'Roadside assistance is help delivered to a driver whose vehicle has stopped working or cannot be driven safely, usually where the vehicle is stranded.',
    sections: [
      { id: 'scope', heading: 'What it covers', body: [
        'Most roadside problems fall into a few groups: the vehicle will not start, a tire has failed, the tank is empty, the keys are locked inside, or the vehicle needs to be moved. S.O.S. organizes its launch services around those groups.',
        'S.O.S. offers [towing](/wiki/towing/), [jump-starts](/wiki/jump-start/), [tire changes](/wiki/tire-change/), [fuel delivery](/wiki/fuel-delivery/) and [lockout service](/wiki/lockout-service/) in metro Atlanta. The providers who perform these services are called [SUPERHEROS](/superheros/).',
      ]},
      { id: 'not-emergency', heading: 'Roadside assistance is not emergency response', body: [
        'Roadside assistance handles vehicle problems. It does not replace police, fire or medical response. If anyone is injured, the vehicle is in a dangerous position in traffic, or there is fire or smoke, call 911 first. See [S.O.S. is not 911](/legal/).',
      ]},
      { id: 'sos', heading: 'How S.O.S. provides it', body: [
        'Drivers request help in the S.O.S. app. Requests go to nearby qualified SUPERHEROS, and a request is assigned only after one of them accepts. Details are in [How S.O.S. works](/wiki/how-sos-works/).',
      ]},
    ],
    related: ['how-sos-works', 'safety-standards', 'roadside-terminology'],
    sources: [S.notNine, S.gdot],
  },
  {
    slug: 'towing',
    title: 'Towing',
    category: 'Services',
    metaTitle: 'Towing — S.O.S. Knowledge Hub',
    description: 'What a roadside tow involves, when a vehicle needs one, and how S.O.S. SUPERHEROS handle towing requests in metro Atlanta.',
    summary: 'Moving a vehicle that cannot be driven safely.',
    lead: 'Towing moves a vehicle that cannot or should not be driven to another location, such as a repair shop or the owner’s home.',
    sections: [
      { id: 'when', heading: 'When a tow is the right call', body: [
        'A tow is usually needed when a problem cannot be fixed where the vehicle sits: a mechanical failure, damage after a collision, a flat with no usable spare, or a vehicle that will not start after a jump.',
      ]},
      { id: 'how', heading: 'How a tow request works on S.O.S.', body: [
        'The driver selects Towing in the S.O.S. app, shares the vehicle’s location and adds details about the vehicle and where it is parked. Those details help the SUPERHERO arrive with the right equipment. The final price is confirmed before the job is charged.',
        'Tow operators who want to take S.O.S. towing missions can apply through [the provider application](/hero/apply/).',
      ]},
      { id: 'safety', heading: 'Safety on the shoulder', body: [
        'Georgia law requires drivers approaching a stopped towing or recovery vehicle showing flashing lights to move over a lane when it is safe, or slow down and be prepared to stop. See [Safety standards](/wiki/safety-standards/).',
      ]},
    ],
    related: ['roadside-assistance', 'provider-categories', 'safety-standards'],
    sources: [S.moveOver, S.fhwa],
  },
  {
    slug: 'jump-start',
    title: 'Jump-start',
    category: 'Services',
    metaTitle: 'Jump-Start Service — S.O.S. Knowledge Hub',
    description: 'What a jump-start is, common signs of a dead battery, and how S.O.S. SUPERHEROS provide jump-start help.',
    summary: 'Restarting a vehicle with a weak or discharged battery.',
    lead: 'A jump-start uses an outside power source, such as a portable jump pack or another vehicle, to start an engine whose battery is too weak to turn it over.',
    sections: [
      { id: 'signs', heading: 'Common signs', body: [
        'Clicking when the key is turned, dim dashboard lights, or no response at all often point to a discharged battery. Lights left on, cold weather and an aging battery are frequent causes.',
      ]},
      { id: 'how', heading: 'How S.O.S. handles it', body: [
        'The driver selects Jump Start in the app and shares a precise location. A SUPERHERO who accepts brings a jump pack or cables and starts the vehicle. If the vehicle still will not start, the driver may need a [tow](/wiki/towing/).',
        'Electric vehicles and some hybrids have specific requirements. Drivers should note an EV in the request details so the SUPERHERO can prepare.',
      ]},
    ],
    related: ['roadside-assistance', 'towing', 'roadside-terminology'],
    sources: [],
  },
  {
    slug: 'tire-change',
    title: 'Tire change',
    category: 'Services',
    metaTitle: 'Flat Tire Change — S.O.S. Knowledge Hub',
    description: 'How roadside tire changes work, what a driver needs, and how S.O.S. SUPERHEROS handle flat tire requests.',
    summary: 'Replacing a flat with the vehicle’s usable spare.',
    lead: 'A roadside tire change removes a flat or damaged tire and installs the vehicle’s spare so the driver can reach a tire shop.',
    sections: [
      { id: 'needs', heading: 'What a tire change needs', body: [
        'A usable spare tire and a safe place to work. Many newer vehicles carry an inflator kit instead of a spare; if there is no usable spare, a [tow](/wiki/towing/) may be needed instead.',
        'Temporary spares are built for short distances at reduced speeds. Follow the limits printed on the spare and have the original tire repaired or replaced.',
      ]},
      { id: 'how', heading: 'How S.O.S. handles it', body: [
        'The driver selects Flat Tire Help, shares a location and notes the vehicle. A SUPERHERO who accepts arrives with tools to remove the wheel and mount the spare.',
      ]},
      { id: 'safety', heading: 'Safety', body: [
        'Changing a tire next to moving traffic is dangerous. If the vehicle is on a narrow shoulder or a highway, move away from the travel lanes when possible and wait in a safe place. NHTSA publishes guidance on tire safety and maintenance.',
      ]},
    ],
    related: ['roadside-assistance', 'safety-standards', 'towing'],
    sources: [S.nhtsaTires],
  },
  {
    slug: 'fuel-delivery',
    title: 'Fuel delivery',
    category: 'Services',
    metaTitle: 'Fuel Delivery — S.O.S. Knowledge Hub',
    description: 'What roadside fuel delivery is and how S.O.S. SUPERHEROS bring fuel to drivers who have run out.',
    summary: 'Bringing enough fuel to get an empty vehicle moving.',
    lead: 'Fuel delivery brings a small amount of fuel to a vehicle that has run out, so the driver can reach a station.',
    sections: [
      { id: 'how', heading: 'How S.O.S. handles it', body: [
        'The driver selects Fuel Delivery, shares a location and notes the vehicle. A SUPERHERO who accepts brings fuel in an approved container. Drivers should confirm the correct fuel type for the vehicle in the request details.',
      ]},
      { id: 'ev', heading: 'Electric vehicles', body: [
        'Fuel delivery applies to gasoline and diesel vehicles. An electric vehicle that has run out of charge generally needs a [tow](/wiki/towing/) to a charger.',
      ]},
    ],
    related: ['roadside-assistance', 'towing'],
    sources: [],
  },
  {
    slug: 'lockout-service',
    title: 'Lockout service',
    category: 'Services',
    metaTitle: 'Vehicle Lockout Service — S.O.S. Knowledge Hub',
    description: 'What vehicle lockout service is and how S.O.S. SUPERHEROS help drivers who are locked out of their vehicles.',
    summary: 'Regaining access when keys are locked inside.',
    lead: 'Lockout service helps a driver get back into a vehicle when the keys are locked inside or the door will not open with the key or fob.',
    sections: [
      { id: 'how', heading: 'How S.O.S. handles it', body: [
        'The driver selects Lockout, shares a location and adds details about the vehicle. A SUPERHERO who accepts uses entry tools designed to open the door without damaging it.',
        'A lockout provider may ask for proof that the driver is entitled to the vehicle before opening it.',
      ]},
      { id: 'urgent', heading: 'When it is an emergency', body: [
        'If a child, a vulnerable adult or a pet is locked inside a vehicle, call 911 immediately. Do not wait for roadside assistance.',
      ]},
    ],
    related: ['roadside-assistance', 'provider-categories', 'safety-standards'],
    sources: [S.notNine],
  },
  {
    slug: 'how-sos-works',
    title: 'How S.O.S. works',
    category: 'Platform',
    metaTitle: 'How S.O.S. Works — S.O.S. Knowledge Hub',
    description: 'How a roadside request moves through S.O.S., from choosing a service to a SUPERHERO accepting the mission and completing the job.',
    summary: 'From request to acceptance to completion.',
    lead: 'S.O.S. connects drivers who need roadside help with nearby SUPERHEROS through a mobile app. Each request is tracked as a mission.',
    sections: [
      { id: 'request', heading: '1. The driver sends a request', body: [
        'The driver signs in, chooses one of the available services and shares a precise location. Optional details about the vehicle and its position help the SUPERHERO prepare.',
      ]},
      { id: 'offer', heading: '2. Nearby SUPERHEROS receive the offer', body: [
        'The request is offered to qualified SUPERHEROS near the driver. Only providers who have completed verification can receive offers.',
      ]},
      { id: 'accept', heading: '3. One SUPERHERO accepts', body: [
        'The mission is assigned when one SUPERHERO accepts it. Until then, the app shows that the request is still being matched. S.O.S. does not show a provider as assigned before acceptance.',
      ]},
      { id: 'complete', heading: '4. Service, price confirmation and payment', body: [
        'The SUPERHERO arrives, assesses the situation and performs the service. The final price is confirmed before the payment is completed in the app.',
      ]},
      { id: 'market', heading: 'Where S.O.S. operates', body: [
        'S.O.S. operates in metro Atlanta at launch. Requests from outside the launch market are not dispatched.',
      ]},
    ],
    related: ['superheros', 'provider-network', 'roadside-terminology'],
    sources: [S.notNine],
  },
  {
    slug: 'provider-network',
    title: 'Provider network',
    category: 'Providers',
    metaTitle: 'The SUPERHEROS Provider Network — S.O.S. Knowledge Hub',
    description: 'How providers join the S.O.S. SUPERHEROS network, and why applying, approval and dispatch readiness are separate stages.',
    summary: 'How providers join, and the stages before dispatch.',
    lead: 'The SUPERHEROS network is the group of roadside providers who work through the S.O.S. platform.',
    sections: [
      { id: 'stages', heading: 'Stages', body: [
        'Applying is the first step. An application is not approval, and approval is not the same as being dispatch-ready. A provider can receive customer mission offers only after required verification is complete.',
      ]},
      { id: 'who', heading: 'Who can join', body: [
        'S.O.S. recruits providers for its five launch services in metro Atlanta. Categories are described in [Provider categories](/wiki/provider-categories/).',
      ]},
      { id: 'apply', heading: 'How to apply', body: [
        'Providers apply through [the S.O.S. provider application](/hero/apply/). The application asks for contact details, the area and services the provider can cover, and availability.',
      ]},
    ],
    related: ['provider-categories', 'safety-standards', 'superheros'],
    sources: [],
  },
  {
    slug: 'provider-categories',
    title: 'Provider categories',
    category: 'Providers',
    metaTitle: 'SUPERHEROS Provider Categories — S.O.S. Knowledge Hub',
    description: 'The kinds of roadside providers who can become S.O.S. SUPERHEROS: tow operators, mobile roadside technicians and lockout specialists.',
    summary: 'Tow operators, mobile technicians and lockout specialists.',
    lead: 'SUPERHEROS are grouped by the services they are equipped and approved to perform.',
    sections: [
      { id: 'tow', heading: 'Tow operators', body: [
        'Operators with a wrecker or flatbed who can move vehicles that cannot be driven. They handle [towing](/wiki/towing/) missions.',
      ]},
      { id: 'mobile', heading: 'Mobile roadside technicians', body: [
        'Providers who travel with equipment such as jump packs, tire tools and approved fuel containers. They handle [jump-starts](/wiki/jump-start/), [tire changes](/wiki/tire-change/) and [fuel delivery](/wiki/fuel-delivery/).',
      ]},
      { id: 'lockout', heading: 'Lockout specialists', body: [
        'Providers trained and equipped to open vehicles without damage. They handle [lockout service](/wiki/lockout-service/).',
      ]},
      { id: 'scope', heading: 'Scope', body: [
        'A provider receives offers only for the services they are approved to perform. Many providers cover more than one category.',
      ]},
    ],
    related: ['provider-network', 'safety-standards'],
    sources: [],
  },
  {
    slug: 'safety-standards',
    title: 'Safety standards',
    category: 'Providers',
    metaTitle: 'Safety Standards — S.O.S. Knowledge Hub',
    description: 'The safety principles behind S.O.S.: verification before dispatch, acceptance before assignment, roadside safety and the 911 boundary.',
    summary: 'Verification, acceptance, roadside safety and the 911 boundary.',
    lead: 'S.O.S. builds its platform around a few safety principles for customers and SUPERHEROS.',
    sections: [
      { id: 'verify', heading: 'Verification before dispatch', body: [
        'Before a SUPERHERO can accept customer missions, S.O.S. requires license, insurance and background verification steps to be completed and reviewed. Providers who have only applied, or who are on standby, do not receive customer offers.',
      ]},
      { id: 'truth', heading: 'Accurate status', body: [
        'A request is not shown as assigned until a SUPERHERO accepts it. Arrival information comes from live mission data, not estimates presented as fact.',
      ]},
      { id: 'roadside', heading: 'Safety at the roadside', body: [
        'Roadside work happens next to traffic. Georgia’s move-over law requires drivers approaching a stopped towing or recovery vehicle with flashing lights to change lanes when it is safe, or to slow down and be prepared to stop. Drivers waiting for help should stay away from travel lanes when they can.',
      ]},
      { id: 'nine', heading: 'Not a 911 service', body: [
        'S.O.S. is roadside assistance. If anyone is injured, in danger, or trapped, call 911 first. See [S.O.S. is not 911](/legal/).',
      ]},
    ],
    related: ['provider-network', 'roadside-assistance', 'how-sos-works'],
    sources: [S.moveOver, S.fhwa, S.notNine],
  },
  {
    slug: 'roadside-terminology',
    title: 'Roadside terminology',
    category: 'Brand terms',
    metaTitle: 'S.O.S. Roadside Terminology Glossary — S.O.S. Knowledge Hub',
    description: 'Glossary of S.O.S. and roadside assistance terms: SUPERHERO, SUPERHEROS, mission, standby, dispatch-ready, acceptance and more.',
    summary: 'Glossary of S.O.S. and roadside terms.',
    lead: 'Terms used across the S.O.S. app, website and provider network.',
    glossary: true,
    sections: [],
    related: ['superheros', 'how-sos-works', 'provider-network'],
    sources: [S.gdot],
  },
];

export const GLOSSARY = [
  ...LEXICON.filter((t) => t.id !== 'superheros'),
  { id: 'superheros-term', name: 'SUPERHEROS', url: '/superheros/', description: OFFICIAL_DEFINITION },
  { id: 'launch-market', name: 'Launch market', url: '/wiki/roadside-terminology/#launch-market', description: 'The area where S.O.S. dispatches missions. At launch this is metro Atlanta.' },
  { id: 'move-over-law', name: 'Move-over law', url: '/wiki/roadside-terminology/#move-over-law', description: 'Georgia law (O.C.G.A. § 40-6-16) requiring drivers to change lanes or slow down for stopped towing, recovery and service vehicles showing flashing lights.' },
  { id: 'gdot-hero', name: 'GDOT HERO', url: '/wiki/roadside-terminology/#gdot-hero', description: 'Highway Emergency Response Operators, a Georgia Department of Transportation program on metro Atlanta freeways. Not affiliated with S.O.S.' },
].sort((a, b) => a.name.localeCompare(b.name));

export const articleBySlug = (slug) => ARTICLES.find((a) => a.slug === slug);
export const absolute = (path) => `${SITE}${path}`;
