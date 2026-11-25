'use client';
import {useState} from 'react';

// Every S.O.S. password box uses this, so people can see what they type
// while creating or entering a password. Drop-in for <input type="password" ...>.
const MARGIN_KEYS = ['margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight'];

export default function PasswordInput({style, className, ...props}) {
  const [show, setShow] = useState(false);
  const own = {...(style || {})};
  const wrap = {position: 'relative', display: 'block', width: '100%'};
  for (const k of MARGIN_KEYS) if (k in own) { wrap[k] = own[k]; delete own[k]; }
  return (
    <span style={wrap} data-password-field>
      <input
        {...props}
        className={className}
        style={{...own, paddingRight: 72, width: own.width || '100%', boxSizing: 'border-box'}}
        type={show ? 'text' : 'password'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="button"
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        onClick={() => setShow(s => !s)}
        onMouseDown={e => e.preventDefault()}
        style={{position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', minWidth: 56, minHeight: 36, padding: '0 10px', border: 0, borderRadius: 9, background: 'rgba(255,255,255,.08)', color: '#fff', fontSize: 12, fontWeight: 800, letterSpacing: '.03em', cursor: 'pointer', lineHeight: 1, fontFamily: 'inherit'}}
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </span>
  );
}
