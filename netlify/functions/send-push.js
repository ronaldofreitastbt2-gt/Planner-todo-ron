const webPush = require('web-push');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:planner@example.com';
const SHEETS_URL = process.env.SHEETS_URL;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

module.exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
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

    const alarmsRes = await fetch(SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'checkAlarms' }),
    });
    const alarmsData = await alarmsRes.json();

    if (!alarmsData.success || !alarmsData.alarms || alarmsData.alarms.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, sent: 0 }) };
    }

    const subsRes = await fetch(SHEETS_URL + '?action=list&entity=pushSubscriptions');
    const subsData = await subsRes.json();

    if (!subsData.success || !subsData.data || !subsData.data.pushSubscriptions) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, sent: 0 }) };
    }

    const subscriptions = subsData.data.pushSubscriptions;
    let sent = 0;

    for (const alarm of alarmsData.alarms) {
      const userSubs = subscriptions.filter(s => String(s.userId) === String(alarm.userId));

      for (const sub of userSubs) {
        try {
          await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              title: alarm.type === 'task' ? '📋 ' + alarm.title : '📅 ' + alarm.title,
              body: alarm.body,
              tag: alarm.tag,
              icon: '/icons/icon-192x192.png',
              vibrate: [300, 200, 300],
            }),
            { TTL: 60 }
          );
          sent++;
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await fetch(SHEETS_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({ action: 'unsubscribe', endpoint: sub.endpoint, userId: sub.userId }),
            }).catch(() => {});
          }
        }
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, alarms: alarmsData.alarms.length, sent }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(err) }) };
  }
};
