/**
 * Bab AlYemen Restaurant — Cloudflare Worker
 * Add BOT_TOKEN and CHAT_ID as Environment Variables in the Worker settings.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  /* CORS preflight */
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  /* Only POST allowed */
  if (request.method !== 'POST') {
    return jsonRes({ ok: false, error: 'Method not allowed' }, 405);
  }

  /* Parse body */
  let order;
  try {
    order = await request.json();
  } catch {
    return jsonRes({ ok: false, error: 'Invalid JSON' }, 400);
  }

  /* Validate */
  if (!order.phone) {
    return jsonRes({ ok: false, error: 'phone is required' }, 422);
  }

  /* BOT_TOKEN and CHAT_ID come from Worker environment variables */
  if (typeof BOT_TOKEN === 'undefined' || typeof CHAT_ID === 'undefined') {
    return jsonRes({ ok: false, error: 'BOT_TOKEN or CHAT_ID not configured' }, 500);
  }

  /* Build Telegram message */
  const text = buildMessage(order);

  /* Send to Telegram */
  let tgRes;
  try {
    tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' }),
    });
  } catch (err) {
    return jsonRes({ ok: false, error: 'Failed to reach Telegram', detail: err.message }, 502);
  }

  const tgData = await tgRes.json().catch(() => ({}));
  if (!tgData.ok) {
    return jsonRes({ ok: false, error: 'Telegram error', detail: tgData.description }, 502);
  }

  return jsonRes({ ok: true });
}

function jsonRes(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildMessage(order) {
  const { name, phone, address, notes, items, total, orderNum, orderType, branchName } = order;
  const isPickup = orderType === 'pickup';
  const lines = [
    '🍽️ <b>طلب جديد — مطعم باب اليمن</b>',
    '━━━━━━━━━━━━━━━━━━━',
    `📋 <b>رقم الطلب:</b> #${esc(orderNum)}`,
    '',
  ];
  if (name) lines.push(`👤 <b>الاسم:</b> ${esc(name)}`);
  lines.push(`📞 <b>الهاتف:</b> <code>${esc(phone)}</code>`);
  if (isPickup) {
    lines.push(`🏪 <b>نوع الطلب:</b> استلام من الفرع`);
    if (branchName) lines.push(`📍 <b>الفرع:</b> ${esc(branchName)}`);
  } else {
    lines.push(`🚗 <b>نوع الطلب:</b> توصيل`);
    if (address) lines.push(`📍 <b>العنوان:</b> ${esc(address)}`);
  }
  if (notes) lines.push(`📝 <b>ملاحظات:</b> ${esc(notes)}`);
  lines.push('', '🛒 <b>الطلبات:</b>');
  if (Array.isArray(items) && items.length) {
    items.forEach(item => {
      const arName  = esc(item.nameAr || item.name || '—');
      const enPart  = (item.nameAr && item.name && item.nameAr !== item.name)
        ? ` (${esc(item.name)})` : '';
      const subtotal = ((parseFloat(item.price) || 0) * (parseInt(item.qty, 10) || 1)).toFixed(2);
      lines.push(`  • ${arName}${enPart} × ${item.qty}  —  ${subtotal} جنيه`);
    });
  }
  lines.push('━━━━━━━━━━━━━━━━━━━');
  lines.push(`💰 <b>الإجمالي: ${esc(total)} جنيه</b>`);
  return lines.join('\n');
}
