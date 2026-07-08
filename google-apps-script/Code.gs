/**
 * Planner PWA — Google Apps Script Backend (Multi-user)
 *
 * COMO USAR:
 * 1. Abra a planilha → Extensões → Apps Script
 * 2. Cole este código inteiro
 * 3. Execute a função "setupSheets" uma vez (cria as abas + cabeçalhos)
 * 4. Implantar → Novo deploy → Tipo: "Aplicativo da Web"
 *    - Executar como: "Eu"
 *    - Quem pode acessar: "Qualquer pessoa"
 * 5. Copie a URL do Web App e cole nas configurações do Planner
 */

var SHEET_NAMES = {
  users: 'Usuarios',
  resetCodes: 'CodigosReset',
  tasks: 'Tarefas',
  events: 'Eventos',
  habits: 'Habitos',
  habitLogs: 'HabitLogs',
  notes: 'Notas',
  settings: 'Configuracoes',
  pushSubscriptions: 'PushSubscriptions',
};

var SHEET_HEADERS = {
  users: ['id', 'email', 'passwordHash', 'name', 'createdAt'],
  resetCodes: ['email', 'code', 'createdAt'],
  tasks: ['id', 'userId', 'title', 'description', 'priority', 'dueDate', 'dueTime', 'completed', 'createdAt', 'alarmEnabled', 'alarmMinutesBefore', 'alarmSound'],
  events: ['id', 'userId', 'title', 'description', 'date', 'endDate', 'startTime', 'endTime', 'color', 'recurrence', 'alarmEnabled', 'alarmMinutesBefore', 'alarmSound'],
  habits: ['id', 'userId', 'name', 'icon', 'daysOfWeek', 'createdAt'],
  habitLogs: ['id', 'userId', 'habitId', 'date'],
  notes: ['id', 'userId', 'title', 'content', 'color', 'pinned', 'createdAt', 'updatedAt'],
  settings: ['id', 'userId', 'theme', 'dark', 'bgType', 'bgColor', 'bgSvgPreset', 'bgImageDataUrl', 'bgOverlayOpacity', 'bgOverlayBlur', 'notificationSound', 'taskSound', 'eventSound', 'habitSound', 'notificationVibrate', 'notificationPush', 'alarmMinutesBefore'],
  pushSubscriptions: ['id', 'userId', 'endpoint', 'p256dh', 'auth', 'createdAt'],
};

/** Cria todas as abas com cabeçalhos — executar uma vez */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEET_NAMES).forEach(function (key) {
    var sheetName = SHEET_NAMES[key];
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    sheet.clear();
    var headers = SHEET_HEADERS[key];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  });
  var defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Página1');
  if (defaultSheet && defaultSheet.getLastRow() <= 0) {
    ss.deleteSheet(defaultSheet);
  }
  SpreadsheetApp.getActiveSpreadsheet().toast('Abas criadas com sucesso!', 'Setup');
}

/** GET handler */
function doGet(e) {
  var action = (e.parameter.action || 'list');
  var entity = e.parameter.entity;
  var userId = e.parameter.userId || '';

  try {
    // Auth actions
    if (action === 'login') {
      var loginField = e.parameter.login || '';
      var passwordHash = e.parameter.passwordHash || '';
      var user = findUserByEmail(loginField) || findUserByName(loginField);
      if (!user) {
        return jsonOut({ success: false, error: 'Usuário não encontrado. Verifique seu email ou nome de usuário.' });
      }
      if (user.passwordHash !== passwordHash) {
        return jsonOut({ success: false, error: 'Senha incorreta. Tente novamente.' });
      }
      return jsonOut({ success: true, user: { id: user.id, email: user.email, name: user.name } });
    }

    if (action === 'checkLogin') {
      var loginField = e.parameter.login || '';
      var exists = !!(findUserByEmail(loginField) || findUserByName(loginField));
      return jsonOut({ success: true, exists: exists });
    }

    // Claim legacy data — fetch ALL rows without userId filter
    if (action === 'list' && e.parameter.claim === '1') {
      var result = {};
      Object.keys(SHEET_NAMES).forEach(function (key) {
        if (key === 'users') return;
        result[key] = getSheetDataNoFilter(key);
      });
      return jsonOut({ success: true, data: result });
    }

    // Data actions — require userId
    if (action === 'list') {
      var result = {};
      if (entity) {
        result[entity] = getSheetData(entity, userId);
      } else {
        Object.keys(SHEET_NAMES).forEach(function (key) {
          if (key === 'users') return; // don't expose users list
          result[key] = getSheetData(key, userId);
        });
      }
      return jsonOut({ success: true, data: result });
    }

    if (action === 'get' && entity && e.parameter.id) {
      var row = findRowById(entity, Number(e.parameter.id), userId);
      if (row === -1) {
        return jsonOut({ success: false, error: 'Not found' });
      }
      return jsonOut({ success: true, data: getRowAsObject(entity, row) });
    }

    return jsonOut({ success: false, error: 'Invalid action: ' + action });
  } catch (err) {
    return jsonOut({ success: false, error: String(err) });
  }
}

/** POST handler */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var entity = body.entity;
    var userId = body.userId || '';

    // Auth actions
    if (action === 'register' && body.data) {
      var userData = body.data;
      var existing = findUserByEmail(userData.email);
      if (existing) {
        return jsonOut({ success: false, error: 'Este email já está cadastrado' });
      }
      var newId = insertUser(userData);
      return jsonOut({ success: true, userId: newId });
    }

    if (action === 'forgotPassword' && body.email) {
      var user = findUserByEmail(body.email);
      if (!user) {
        return jsonOut({ success: false, error: 'Email não encontrado' });
      }
      var code = generateResetCode();
      saveResetCode(body.email, code);
      sendResetEmail(body.email, user.name, code);
      return jsonOut({ success: true });
    }

    if (action === 'resetPassword' && body.email && body.code && body.newPassword) {
      var valid = verifyResetCode(body.email, body.code);
      if (!valid) {
        return jsonOut({ success: false, error: 'Código inválido ou expirado' });
      }
      updateUserPassword(body.email, body.newPassword);
      deleteResetCode(body.email);
      return jsonOut({ success: true });
    }

    if (action === 'deleteAccount' && body.userId) {
      deleteUserData(body.userId);
      deleteUser(body.userId);
      return jsonOut({ success: true });
    }

    // Data actions — require userId
    if (action === 'upsert' && entity && body.data) {
      upsertRow(entity, body.data, userId);
      return jsonOut({ success: true });
    }

    if (action === 'delete' && entity && body.id != null) {
      deleteRow(entity, Number(body.id), userId);
      return jsonOut({ success: true });
    }

    if (action === 'sync' && body.data) {
      Object.keys(body.data).forEach(function (key) {
        if (SHEET_NAMES[key] && key !== 'users') {
          clearSheetData(key, userId);
          var rows = body.data[key];
          if (rows && rows.length > 0) {
            bulkInsert(key, rows, userId);
          }
        }
      });
      return jsonOut({ success: true, synced: Object.keys(body.data).length });
    }

    if (action === 'clear' && entity) {
      clearSheetData(entity, userId);
      return jsonOut({ success: true });
    }

    // Push subscription actions
    if (action === 'subscribe' && body.subscription) {
      savePushSubscription(userId, body.subscription);
      return jsonOut({ success: true });
    }

    if (action === 'unsubscribe' && body.endpoint) {
      removePushSubscription(userId, body.endpoint);
      return jsonOut({ success: true });
    }

    // Check and return due alarms (called by Netlify cron)
    if (action === 'checkAlarms') {
      var alarms = getDueAlarms();
      return jsonOut({ success: true, alarms: alarms });
    }

    return jsonOut({ success: false, error: 'Invalid action: ' + action });
  } catch (err) {
    return jsonOut({ success: false, error: String(err) });
  }
}

// ====== User functions ======

function findUserByEmail(email) {
  var sheet = getSheet('users');
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;
  var data = sheet.getRange(2, 1, lastRow - 1, SHEET_HEADERS.users.length).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][1]).toLowerCase() === String(email).toLowerCase()) {
      return {
        id: data[i][0],
        email: data[i][1],
        passwordHash: data[i][2],
        name: data[i][3],
        createdAt: data[i][4],
      };
    }
  }
  return null;
}

function findUserByName(name) {
  var sheet = getSheet('users');
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;
  var data = sheet.getRange(2, 1, lastRow - 1, SHEET_HEADERS.users.length).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][3]).toLowerCase() === String(name).toLowerCase()) {
      return {
        id: data[i][0],
        email: data[i][1],
        passwordHash: data[i][2],
        name: data[i][3],
        createdAt: data[i][4],
      };
    }
  }
  return null;
}

function insertUser(userData) {
  var sheet = getSheet('users');
  var lastRow = sheet.getLastRow();
  var maxId = 0;
  if (lastRow > 1) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (Number(ids[i][0]) > maxId) maxId = Number(ids[i][0]);
    }
  }
  var newId = maxId + 1;
  var headers = SHEET_HEADERS.users;
  var rowData = headers.map(function (h) {
    if (h === 'id') return newId;
    return userData[h] || '';
  });
  sheet.appendRow(rowData);
  return newId;
}

function deleteUserData(userId) {
  var dataEntities = ['tasks', 'events', 'habits', 'habitLogs', 'notes', 'settings'];
  dataEntities.forEach(function (entity) {
    clearSheetData(entity, userId);
  });
}

function deleteUser(userId) {
  var sheet = getSheet('users');
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(userId)) {
      sheet.deleteRow(i + 2);
      return;
    }
  }
}

function generateResetCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function saveResetCode(email, code) {
  var sheet = getSheet('resetCodes');
  // Remove old codes for this email
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = data.length - 1; i >= 0; i--) {
      if (String(data[i][0]) === email) {
        sheet.deleteRow(i + 2);
      }
    }
  }
  sheet.appendRow([email, code, new Date().toISOString()]);
}

function verifyResetCode(email, code) {
  var sheet = getSheet('resetCodes');
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;
  var data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === email && String(data[i][1]) === code) {
      var createdAt = new Date(data[i][2]);
      var now = new Date();
      var diffMin = (now - createdAt) / (1000 * 60);
      if (diffMin < 15) {
        return true;
      }
    }
  }
  return false;
}

function deleteResetCode(email) {
  var sheet = getSheet('resetCodes');
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = data.length - 1; i >= 0; i--) {
    if (String(data[i][0]) === email) {
      sheet.deleteRow(i + 2);
    }
  }
}

function updateUserPassword(email, newPasswordHash) {
  var sheet = getSheet('users');
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  var headers = SHEET_HEADERS.users;
  var passIdx = headers.indexOf('passwordHash');
  var emailIdx = headers.indexOf('email');
  var data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][emailIdx]) === email) {
      sheet.getRange(i + 2, passIdx + 1).setValue(newPasswordHash);
      return;
    }
  }
}

function sendResetEmail(email, name, code) {
  var subject = 'Meu Planner — Redefinir senha';
  var body = 'Olá ' + name + ',\n\n' +
    'Você solicitou a redefinição da sua senha.\n\n' +
    'Seu código de verificação é: ' + code + '\n\n' +
    'Este código expira em 15 minutos.\n\n' +
    'Se você não solicitou esta alteração, ignore este email.\n\n' +
    'Equipe Meu Planner';

  MailApp.sendEmail({
    to: email,
    subject: subject,
    body: body,
  });
}

// ====== Helper functions ======

function getSheet(entity) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES[entity]);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES[entity]);
    var headers = SHEET_HEADERS[entity];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSheetData(entity, userId) {
  var sheet = getSheet(entity);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  var rows = data.map(function (row) {
    var obj = {};
    headers.forEach(function (header, i) {
      var val = row[i];
      if (header === 'daysOfWeek' && typeof val === 'string') {
        val = val.split(',').map(Number).filter(function (n) { return !isNaN(n); });
      } else if (header === 'completed' || header === 'pinned' || header === 'alarmEnabled' || header === 'alarmMinutesBefore' || header === 'bgOverlayOpacity' || header === 'bgOverlayBlur' || header === 'id' || header === 'habitId') {
        val = Number(val) || 0;
      } else if (header === 'dark' || header === 'notificationVibrate' || header === 'notificationPush') {
        val = val === true || val === 'true' || val === 1 || val === '1';
      }
      obj[header] = val;
    });
    return obj;
  });

  // Filter by userId if provided and entity has userId column
  if (userId && SHEET_HEADERS[entity] && SHEET_HEADERS[entity].indexOf('userId') !== -1) {
    rows = rows.filter(function (row) {
      return String(row.userId) === String(userId);
    });
  }

  return rows;
}

function getSheetDataNoFilter(entity) {
  var sheet = getSheet(entity);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var actualHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var data = sheet.getRange(2, 1, lastRow - 1, actualHeaders.length).getValues();

  return data.map(function (row) {
    var obj = {};
    actualHeaders.forEach(function (header, i) {
      if (header === 'userId') {
        obj[header] = '';
        return;
      }
      var val = row[i];
      if (header === 'daysOfWeek' && typeof val === 'string') {
        val = val.split(',').map(Number).filter(function (n) { return !isNaN(n); });
      } else if (header === 'completed' || header === 'pinned' || header === 'alarmEnabled' || header === 'alarmMinutesBefore' || header === 'bgOverlayOpacity' || header === 'bgOverlayBlur' || header === 'id' || header === 'habitId') {
        val = Number(val) || 0;
      } else if (header === 'dark' || header === 'notificationVibrate' || header === 'notificationPush') {
        val = val === true || val === 'true' || val === 1 || val === '1';
      }
      obj[header] = val;
    });
    return obj;
  }).filter(function (row) {
    return row.id > 0;
  });
}

function findRowById(entity, id, userId) {
  var sheet = getSheet(entity);
  if (!sheet) return -1;
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  var headers = SHEET_HEADERS[entity];
  var userIdx = headers.indexOf('userId');
  var idIdx = 0; // id is always first column
  var totalCols = headers.length;
  var data = sheet.getRange(2, 1, lastRow - 1, totalCols).getValues();
  for (var i = 0; i < data.length; i++) {
    if (Number(data[i][idIdx]) === Number(id)) {
      // Verify ownership if userId is provided
      if (userId && userIdx !== -1) {
        if (String(data[i][userIdx]) !== String(userId)) return -1;
      }
      return i + 2; // +2: 0-indexed + header row
    }
  }
  return -1;
}

function getRowAsObject(entity, row) {
  var sheet = getSheet(entity);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var data = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
  var obj = {};
  headers.forEach(function (header, i) {
    obj[header] = data[i];
  });
  return obj;
}

function upsertRow(entity, data, userId) {
  var sheet = getSheet(entity);
  var headers = SHEET_HEADERS[entity];
  var row = findRowById(entity, data.id, userId);

  // Ensure userId is set
  if (userId && headers.indexOf('userId') !== -1) {
    data.userId = userId;
  }

  var rowData = headers.map(function (h) {
    var val = data[h];
    if (val === undefined || val === null) val = '';
    if (h === 'daysOfWeek' && Array.isArray(val)) {
      val = val.join(',');
    }
    return val;
  });

  if (row === -1) {
    if (!data.id) {
      var lastRow = sheet.getLastRow();
      var maxId = 0;
      if (lastRow > 1) {
        var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < ids.length; i++) {
          if (Number(ids[i][0]) > maxId) maxId = Number(ids[i][0]);
        }
      }
      data.id = maxId + 1;
      rowData[0] = maxId + 1;
    }
    sheet.appendRow(rowData);
  } else {
    sheet.getRange(row, 1, 1, headers.length).setValues([rowData]);
  }

  // Sincronizar com Google Calendar (alarmes)
  syncCalendarEvent(entity, data);
}

function deleteRow(entity, id, userId) {
  var row = findRowById(entity, id, userId);
  if (row !== -1) {
    var sheet = getSheet(entity);
    sheet.deleteRow(row);
    // Remover evento do Google Calendar
    removeCalendarEvent(entity, id);
  }
}

// ====== Google Calendar Sync ======

/**
 * Sincroniza tarefa/evento com Google Calendar.
 * Cria ou atualiza um evento com lembrete para notificação nativa no celular.
 */
function syncCalendarEvent(entity, data) {
  // Só sincroniza tarefas e eventos com alarme ativado
  if (entity !== 'tasks' && entity !== 'events') return;
  if (!data.alarmEnabled) {
    removeCalendarEvent(entity, data.id);
    return;
  }

  try {
    var calendar = CalendarApp.getDefaultCalendar();
    var tag = 'planner_' + entity + '_' + data.id;

    // Buscar evento existente pelo tag
    var existing = calendar.getEvents(
      new Date('2020-01-01'),
      new Date('2030-12-31'),
      { search: tag }
    );

    // Determinar título e horário
    var title, startTime, endTime, description;

    if (entity === 'tasks') {
      if (!data.dueDate || !data.dueTime) return;
      title = '📋 ' + data.title;
      startTime = new Date(data.dueDate + 'T' + data.dueTime);
      endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30min de duração
      description = data.description || '';
    } else {
      if (!data.date || !data.startTime) return;
      title = '📅 ' + data.title;
      startTime = new Date(data.date + 'T' + data.startTime);
      if (data.endTime) {
        endTime = new Date(data.date + 'T' + data.endTime);
      } else {
        endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      }
      description = data.description || '';
    }

    // Adicionar tag identificadora na descrição (para encontrar depois)
    description = tag + '\n' + description;

    // Calcular lembrete em minutos
    var reminderMinutes = data.alarmMinutesBefore || 0;

    if (existing.length > 0) {
      // Atualizar evento existente
      var calEvent = existing[0];
      calEvent.setTitle(title);
      calEvent.setTime(startTime, endTime);
      calEvent.setDescription(description);
      // Limpar lembretes antigos e adicionar o novo
      calEvent.removeAllReminders();
      calEvent.addPopupReminder(reminderMinutes);
      Logger.log('[calendar] Evento atualizado: ' + title);
    } else {
      // Criar novo evento com lembrete
      var calEvent = calendar.createEvent(title, startTime, endTime, {
        description: description,
      });
      calEvent.addPopupReminder(reminderMinutes);
      Logger.log('[calendar] Evento criado: ' + title + ' (lembrete: ' + reminderMinutes + ' min)');
    }
  } catch (err) {
    Logger.log('[calendar] Erro ao sincronizar: ' + err);
  }
}

/**
 * Remove evento do Google Calendar quando tarefa/evento é deletado ou alarme desativado.
 */
function removeCalendarEvent(entity, id) {
  try {
    var calendar = CalendarApp.getDefaultCalendar();
    var tag = 'planner_' + entity + '_' + id;

    var events = calendar.getEvents(
      new Date('2020-01-01'),
      new Date('2030-12-31'),
      { search: tag }
    );

    for (var i = 0; i < events.length; i++) {
      events[i].deleteEvent();
      Logger.log('[calendar] Evento removido: ' + tag);
    }
  } catch (err) {
    Logger.log('[calendar] Erro ao remover: ' + err);
  }
}

function clearSheetData(entity, userId) {
  var sheet = getSheet(entity);
  if (sheet.getLastRow() <= 1) return;

  // If userId provided, only delete rows belonging to that user
  if (userId) {
    var headers = SHEET_HEADERS[entity];
    var userIdx = headers.indexOf('userId');
    if (userIdx === -1) {
      // Entity doesn't have userId — clear all
      sheet.deleteRows(2, sheet.getLastRow() - 1);
      return;
    }
    // Collect rows to delete (in reverse order to avoid index shifting)
    var lastRow = sheet.getLastRow();
    var totalCols = headers.length;
    var data = sheet.getRange(2, 1, lastRow - 1, totalCols).getValues();
    var rowsToDelete = [];
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][userIdx]) === String(userId)) {
        rowsToDelete.push(i + 2); // +2 for 1-indexed + header
      }
    }
    // Delete in reverse order
    for (var j = rowsToDelete.length - 1; j >= 0; j--) {
      sheet.deleteRow(rowsToDelete[j]);
    }
  } else {
    sheet.deleteRows(2, sheet.getLastRow() - 1);
  }
}

function bulkInsert(entity, rows, userId) {
  var sheet = getSheet(entity);
  var headers = SHEET_HEADERS[entity];

  // Ensure userId is set on all rows
  if (userId && headers.indexOf('userId') !== -1) {
    rows = rows.map(function (r) {
      r.userId = userId;
      return r;
    });
  }

  var matrix = rows.map(function (data) {
    return headers.map(function (h) {
      var val = data[h];
      if (val === undefined || val === null) val = '';
      if (h === 'daysOfWeek' && Array.isArray(val)) val = val.join(',');
      return val;
    });
  });
  if (matrix.length > 0) {
    sheet.getRange(2, 1, matrix.length, headers.length).setValues(matrix);
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ====== Push Subscription functions ======

function savePushSubscription(userId, subscription) {
  var sheet = getSheet('pushSubscriptions');
  var headers = SHEET_HEADERS.pushSubscriptions;

  // Remove subscription antiga deste endpoint para este usuário
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    for (var i = data.length - 1; i >= 0; i--) {
      if (String(data[i][1]) === String(userId) && String(data[i][2]) === String(subscription.endpoint)) {
        sheet.deleteRow(i + 2);
      }
    }
  }

  // Extrair chaves p256dh e auth do subscription
  var keys = subscription.keys || {};
  var rowData = [
    '', // id (auto)
    userId,
    subscription.endpoint,
    keys.p256dh || '',
    keys.auth || '',
    new Date().toISOString(),
  ];

  // Gerar ID
  var maxId = 0;
  if (lastRow > 1) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (Number(ids[i][0]) > maxId) maxId = Number(ids[i][0]);
    }
  }
  rowData[0] = maxId + 1;
  sheet.appendRow(rowData);
}

function removePushSubscription(userId, endpoint) {
  var sheet = getSheet('pushSubscriptions');
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  var headers = SHEET_HEADERS.pushSubscriptions;
  var data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  for (var i = data.length - 1; i >= 0; i--) {
    if (String(data[i][1]) === String(userId) && String(data[i][2]) === String(endpoint)) {
      sheet.deleteRow(i + 2);
    }
  }
}

function getAllPushSubscriptions() {
  var sheet = getSheet('pushSubscriptions');
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var headers = SHEET_HEADERS.pushSubscriptions;
  var data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return data.map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}

/**
 * Retorna alarmes que deveriam disparar agora (janela de ±2 minutos).
 * Chamado pela Netlify Function via POST { action: 'checkAlarms' }
 */
function getDueAlarms() {
  var now = new Date();
  var alarms = [];

  // Verificar tarefas
  var tasks = getSheetData('tasks', '');
  tasks.forEach(function (task) {
    if (task.completed === 1 || !task.alarmEnabled || !task.dueDate || !task.dueTime) return;

    var taskDateTime = new Date(task.dueDate + 'T' + task.dueTime);
    var alarmMinutes = task.alarmMinutesBefore || 0;
    var alarmTime = new Date(taskDateTime.getTime() - alarmMinutes * 60000);
    var diff = Math.abs(now.getTime() - alarmTime.getTime());

    // Janela de ±2 minutos
    if (diff <= 120000) {
      alarms.push({
        type: 'task',
        userId: task.userId,
        title: task.title,
        body: task.description || 'Prazo: ' + task.dueDate + ' ' + task.dueTime,
        tag: 'planner_task_' + task.id,
      });
    }
  });

  // Verificar eventos
  var events = getSheetData('events', '');
  events.forEach(function (event) {
    if (!event.alarmEnabled || !event.startTime) return;

    var eventDateTime = new Date(event.date + 'T' + event.startTime);
    var alarmMinutes = event.alarmMinutesBefore || 0;
    var alarmTime = new Date(eventDateTime.getTime() - alarmMinutes * 60000);
    var diff = Math.abs(now.getTime() - alarmTime.getTime());

    if (diff <= 120000) {
      alarms.push({
        type: 'event',
        userId: event.userId,
        title: event.title,
        body: event.startTime && event.endTime
          ? event.date + ' ' + event.startTime + ' - ' + event.endTime
          : event.date + ' ' + event.startTime,
        tag: 'planner_event_' + event.id,
      });
    }
  });

  return alarms;
}
