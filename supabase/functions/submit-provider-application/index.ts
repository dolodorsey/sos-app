Deno.serve(() => new Response(
  JSON.stringify({
    error: 'Legacy provider intake is retired. Use /hero/apply.',
  }),
  {
    status:410,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  },
));
