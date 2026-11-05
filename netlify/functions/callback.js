// Suno POSTs task updates here. The app polls for status, so we just ack.
export default async () => new Response(JSON.stringify({ code: 200, msg: "received" }), {
  headers: { "Content-Type": "application/json" },
});
