/**
 * «Город 1683» — приём заявок на бронь с сайта и пересылка в рабочий чат Telegram.
 *
 * Токен бота и ID чата НЕ хранятся в коде: они лежат в
 * «Настройки проекта → Свойства скрипта»:
 *   TELEGRAM_BOT_TOKEN — токен от @BotFather
 *   TELEGRAM_CHAT_ID   — ID рабочего чата (для групп начинается с минуса)
 *
 * Как развернуть — см. backend/README.md.
 */

var MAX_GUESTS = 50;
var MAX_DAYS_AHEAD = 90;
var MIN_FILL_MS = 3000; // быстрее человек форму не заполнит
var PHONE_COOLDOWN_SEC = 120; // одна заявка с номера раз в 2 минуты
var GLOBAL_LIMIT = 30; // не больше 30 заявок за 10 минут со всего сайта
var GLOBAL_WINDOW_SEC = 600;
var OCCASIONS = ["День рождения", "Свидание", "Деловая встреча", "Банкет", "Другое"];

function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    // Honeypot и слишком быстрая отправка — бот. Отвечаем «ок», чтобы не подсказывать.
    if (data.website || Number(data.elapsedMs) < MIN_FILL_MS) return json_({ ok: true });

    var b = validate_(data);
    if (b.error) return json_({ ok: false, error: b.error });

    var cache = CacheService.getScriptCache();
    var phoneKey = "phone:" + b.phoneDigits;
    if (cache.get(phoneKey)) {
      return json_({ ok: false, error: "Заявка с этого номера уже отправлена. Мы скоро перезвоним!" });
    }
    var count = Number(cache.get("global") || 0);
    if (count >= GLOBAL_LIMIT) {
      return json_({ ok: false, error: "Слишком много заявок, попробуйте через несколько минут." });
    }

    sendTelegram_(formatMessage_(b));

    cache.put(phoneKey, "1", PHONE_COOLDOWN_SEC);
    cache.put("global", String(count + 1), GLOBAL_WINDOW_SEC);
    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false });
  }
}

/** Открытие URL в браузере — просто проверка, что скрипт развёрнут. */
function doGet() {
  return json_({ ok: true, service: "gorod1683-booking" });
}

function validate_(d) {
  var name = String(d.name || "").trim().slice(0, 60);
  var phoneDigits = String(d.phone || "").replace(/\D/g, "");
  var date = String(d.date || "");
  var time = String(d.time || "");
  var guests = Math.floor(Number(d.guests));
  var occasion = String(d.occasion || "");
  var comment = String(d.comment || "").trim().slice(0, 500);

  if (name.length < 2) return { error: "Укажите имя." };
  if (!/^7\d{10}$/.test(phoneDigits)) return { error: "Проверьте номер телефона." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Выберите дату." };
  if (!/^\d{2}:\d{2}$/.test(time)) return { error: "Выберите время." };
  if (!(guests >= 1 && guests <= MAX_GUESTS)) return { error: "Проверьте количество гостей." };
  if (OCCASIONS.indexOf(occasion) === -1) occasion = "";

  // Дата не в прошлом и не дальше чем на 90 дней (по времени Сызрани)
  var today = Utilities.formatDate(new Date(), "Europe/Samara", "yyyy-MM-dd");
  var limit = Utilities.formatDate(new Date(Date.now() + (MAX_DAYS_AHEAD + 1) * 864e5), "Europe/Samara", "yyyy-MM-dd");
  if (date < today || date > limit) return { error: "Выберите другую дату." };

  return { name: name, phoneDigits: phoneDigits, date: date, time: time, guests: guests, occasion: occasion, comment: comment };
}

function formatMessage_(b) {
  var p = b.phoneDigits;
  var phone = "+7 (" + p.substr(1, 3) + ") " + p.substr(4, 3) + "-" + p.substr(7, 2) + "-" + p.substr(9, 2);
  var lines = [
    "🍽 <b>Новая бронь с сайта</b>",
    "",
    "👤 <b>" + esc_(b.name) + "</b>",
    "📞 " + phone,
    "📅 " + humanDate_(b.date) + ", <b>" + b.time + "</b>",
    "👥 Гостей: <b>" + b.guests + "</b>",
  ];
  if (b.occasion) lines.push("🎉 Повод: " + esc_(b.occasion));
  if (b.comment) lines.push("💬 " + esc_(b.comment));
  lines.push("", "<i>Перезвоните гостю для подтверждения</i>");
  return lines.join("\n");
}

function humanDate_(iso) {
  var months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  var days = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  var parts = iso.split("-").map(Number);
  var d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return days[d.getUTCDay()] + ", " + parts[2] + " " + months[parts[1] - 1];
}

function esc_(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sendTelegram_(text) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty("TELEGRAM_BOT_TOKEN");
  var chatId = props.getProperty("TELEGRAM_CHAT_ID");
  if (!token || !chatId) throw new Error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID не заданы в свойствах скрипта");

  var res = UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ chat_id: chatId, text: text, parse_mode: "HTML", disable_web_page_preview: true }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error("Telegram " + res.getResponseCode() + ": " + res.getContentText());
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ───────── Служебные функции: запускаются вручную из редактора ───────── */

/**
 * Шаг настройки: добавьте бота в рабочий чат, напишите в чат любую команду,
 * например /start, затем запустите эту функцию — в «Журнале выполнения»
 * появятся ID чатов, где бот видел сообщения.
 */
function findChatId() {
  var token = PropertiesService.getScriptProperties().getProperty("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("Сначала добавьте TELEGRAM_BOT_TOKEN в свойства скрипта");
  var res = JSON.parse(UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/getUpdates").getContentText());
  var seen = {};
  (res.result || []).forEach(function (u) {
    var m = u.message || u.my_chat_member || u.channel_post;
    if (m && m.chat && !seen[m.chat.id]) {
      seen[m.chat.id] = true;
      console.log("Чат: «" + (m.chat.title || m.chat.first_name) + "» → TELEGRAM_CHAT_ID = " + m.chat.id);
    }
  });
  if (!Object.keys(seen).length) console.log("Сообщений не найдено. Напишите в чат /start и запустите ещё раз.");
}

/** Отправляет тестовую заявку в чат — проверка, что токен и ID верные. */
function sendTestBooking() {
  var tomorrow = Utilities.formatDate(new Date(Date.now() + 864e5), "Europe/Samara", "yyyy-MM-dd");
  sendTelegram_(
    formatMessage_({ name: "Тест", phoneDigits: "79171011683", date: tomorrow, time: "19:00", guests: 2, occasion: "", comment: "Проверка связи — эту заявку можно игнорировать" })
  );
  console.log("Тестовое сообщение отправлено");
}
