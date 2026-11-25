// Line icons for the five launch services. 24x24, stroke = currentColor.
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };
const ICONS = {
  tow: <><path d="M2 16V9h8l3 4h4" {...P}/><path d="M13 13h7v3" {...P}/><path d="M2 16h20" {...P}/><circle cx="6.5" cy="17.5" r="1.8" {...P}/><circle cx="17.5" cy="17.5" r="1.8" {...P}/><path d="M17 13 21 5l1 2" {...P}/></>,
  fuel: <><path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" {...P}/><path d="M3 21h12" {...P}/><path d="M7 7h4v4H7z" {...P}/><path d="M14 9h2.5a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 0 3 0V8l-3-3" {...P}/></>,
  jump: <><rect x="3" y="7" width="18" height="12" rx="2" {...P}/><path d="M7 7V5M17 7V5" {...P}/><path d="M12.5 9.5 10 13.5h4L11.5 17" {...P}/></>,
  flat: <><circle cx="12" cy="12" r="8.5" {...P}/><circle cx="12" cy="12" r="3" {...P}/><path d="M12 3.5V9M12 15v5.5M3.5 12H9M15 12h5.5" {...P}/></>,
  lockout: <><rect x="5" y="10.5" width="14" height="10" rx="2" {...P}/><path d="M8 10.5V7.5a4 4 0 0 1 8 0" {...P}/><path d="M12 14.5v2.5" {...P}/></>,
};
export default function LaunchIcon({ id, size = 24 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">{ICONS[id] || ICONS.tow}</svg>;
}
