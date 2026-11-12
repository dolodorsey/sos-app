// Renders content strings with [label](/internal/path/) links. Internal-only:
// anything that is not a site-relative path is rendered as plain text.
const LINK = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;

export default function SOSRichText({ text }) {
  const parts = [];
  let last = 0;
  let match;
  LINK.lastIndex = 0;
  while ((match = LINK.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(<a key={match.index} href={match[2]}>{match[1]}</a>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

export const plainText = (text) => text.replace(LINK, '$1');
