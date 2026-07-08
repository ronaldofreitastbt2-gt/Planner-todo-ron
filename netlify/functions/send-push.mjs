/**
 * Netlify Function: send-push
 *
 * Verifica alarmes pendentes na planilha e envia push notifications.
 * Chamado a cada minuto pelo cron-job.org.
 *
 * Variáveis de ambiente (configurar no Netlify):
 *   VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_EMAIL (mailto:seu@email.com)
 *   SHEETS_URL (URL do Apps Script Web App)
 */

import webPush from 'web-push';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:planner@example.com';
const SHEETS_URL = process.env.SHEETS_URL;

// Configurar VAPID
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    VAPID_EMAIL,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

export default async (request, context) => {
  // Permitir CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    if (!SHEETS_URL) {
      return jsonResponse(500, { error: 'SHEETS_URL não configurada' });
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return jsonResponse(500, { error: 'VAPID keys não configuradas' });
    }

    // 1. Buscar alarmes pendentes do Apps Script
    const alarmsRes = await fetch(SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'checkAlarms' }),
    });
    const alarmsData = await alarmsRes.json();

    if (!alarmsData.success || !alarmsData.alarms || alarmsData.alarms.length === 0) {
      return jsonResponse(200, { success: true, sent: 0, message: 'Nenhum alarme pendente' });
    }

    // 2. Buscar todas as inscrições push
    const subsRes = await fetch(SHEETS_URL + '?action=list&entity=pushSubscriptions');
    const subsData = await subsRes.json();

    if (!subsData.success || !subsData.data?.pushSubscriptions) {
      return jsonResponse(200, { success: true, sent: 0, message: 'Nenhuma inscrição push' });
    }

    const subscriptions = subsData.data.pushSubscriptions;

    // 3. Enviar push para cada alarme
    let sent = 0;
    let failed = 0;

    for (const alarm of alarmsData.alarms) {
      // Filtrar inscrições deste usuário
      const userSubs = subscriptions.filter(s => String(s.userId) === String(alarm.userId));

      for (const sub of userSubs) {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        const payload = JSON.stringify({
          title: alarm.type === 'task' ? `📋 ${alarm.title}` : `📅 ${alarm.title}`,
          body: alarm.body,
          tag: alarm.tag,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-192x192.png',
          vibrate: [300, 200, 300],
        });

        try {
          await webPush.sendNotification(pushSubscription, payload, {
            TTL: 60, // 60 segundos
            urgency: 'high',
          });
          sent++;
        } catch (err) {
          console.error(`[push] Falha para ${sub.endpoint}:`, err.message);
          failed++;

          // Se a inscrição é inválida (404 ou 410), remover do banco
          if (err.statusCode === 404 || err.statusCode === 410) {
            try {
              await fetch(SHEETS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                  action: 'unsubscribe',
                  endpoint: sub.endpoint,
                  userId: sub.userId,
                }),
              });
            } catch {
              // ignore cleanup errors
            }
          }
        }
      }
    }

    return jsonResponse(200, {
      success: true,
      alarms: alarmsData.alarms.length,
      sent,
      failed,
    });

  } catch (err) {
    console.error('[push] Erro geral:', err);
    return jsonResponse(500, { error: String(err) });
  }
};

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export const config = {
  path: '/send-push',
  schedule: '* * * * *', // A cada minuto (Netlify Scheduled Functions)
};
