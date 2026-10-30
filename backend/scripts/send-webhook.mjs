// Simula la pasarela: firma el body con HMAC-SHA256 y lo envía al webhook.
// Uso: npm run webhook -w backend -- [event_id] [user_id] [amount] [status]
import { createHmac } from 'node:crypto';

const [eventId = `evt_${Date.now()}`, userId = 'u_123', amount = '200.00', status = 'approved'] =
  process.argv.slice(2);
const url = process.env.WEBHOOK_URL ?? 'http://localhost:3000/webhooks/payment-gateway';
const secret = process.env.WEBHOOK_SECRET ?? 'dev-webhook-secret';

const body = JSON.stringify({ event_id: eventId, user_id: userId, amount, currency: 'USD', status });
const signature = createHmac('sha256', secret).update(body).digest('hex');

const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Signature': signature },
  body,
});
console.log(`POST ${url}\n${body}\nX-Signature: ${signature}\n→ ${res.status}`, await res.json());
