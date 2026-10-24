const path = require("path");
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
const PORT = process.env.PORT || 3000;

// статика из папки public
app.use(express.static(path.join(__dirname, "public")));

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) throw new Error("Не задан BOT_TOKEN");

const APP_URL = process.env.APP_URL;
if (!APP_URL || !APP_URL.startsWith("https://")) {
  throw new Error("APP_URL должен быть задан и начинаться с https://");
}

const bot = new TelegramBot(TOKEN, { polling: true });

bot.on("polling_error", (err) => console.error("Polling error:", err.message));

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "🧮 Добро пожаловать в калькулятор!",
    {
      reply_markup: {
        keyboard: [[
          { text: "Открыть калькулятор", web_app: { url: APP_URL } }
        ]],
        resize_keyboard: true
      }
    }
  );
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Сервер запущен на порту " + PORT);
});
