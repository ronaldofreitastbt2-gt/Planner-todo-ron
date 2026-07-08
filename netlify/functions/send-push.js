const webPush = require('web-push');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:planner@example.com';
const SHEETS_URL = process.env.SHEETS_URL;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (!SHEETS_URL) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'SHEETS_URL não configurada' }) };
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'VAPID keys não configuradas' }) };
    }

    // 1. Buscar alarmes pendentes do Apps Script
    const alarmsRes = await fetch(SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'checkAlarms' }),
    });
    const alarmsData = await alarmsRes.json();

    if (!alarmsData.success || !alarmsData.alarms || alarmsData.alarms.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, sent: 0, message: 'Nenhum alarme pendente' }) };
    }

    // 2. Buscar inscrições push
    const subsRes = await fetch(SHEETS_URL + '?action=list&entity=pushSubscriptions');
    const subsData = await subsRes.json();

    if (!subsData.success || !subsData.data || !subsData.data.pushSubscriptions) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, sent: 0, message: 'Nenhuma inscrição push' }) };
    }

    const subscriptions = subsData.data.pushSubscriptions;

    // 3. Enviar push
    let sent = 0;
    let failed = 0;

    for (const alarm of alarmsData.alarms) {
      const userSubs = subscriptions.filter(s => String(s.userId) === String(alarm.userId));

      for (const sub of userSubs) {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };

        const payload = JSON.stringify({
          title: alarm.type === 'task' ? '📋 ' + alarm.title : '📅 ' + alarm.title,
          body: alarm.body,
          tag: alarm.tag,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-192x192.png',
          vibrate: [300, 200, 300],
        });

        try {
          await webPush.sendNotification(pushSubscription, payload, { TTL: 60, urgency: 'high' });
          sent++;
        } catch (err) {
          console.error('Push failed:', err.message);
          failed++;

          if (err.statusCode === 404 || err.statusCode === 410) {
            try {
              await fetch(SHEETS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'unsubscribe', endpoint: sub.endpoint, userId: sub.userId }),
              });
            } catch {}
          }
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, alarms: alarmsData.alarms.length, sent, failed }),
    };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(err) }) };
  }
};
