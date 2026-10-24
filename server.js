const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
const PORT = process.env.PORT || 3000;

// отдаём статику из корня проекта (index.html, script.js, style.css)
app.use(express.static(__dirname));

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) throw new Error("Не задан BOT_TOKEN в Render");

const bot = new TelegramBot(TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "🧮 Добро пожаловать в калькулятор!",
    {
      reply_markup: {
        keyboard: [[
          {
            text: "Открыть калькулятор",
            web_app: { url: process.env.APP_URL }
          }
        ]],
        resize_keyboard: true
      }
    }
  );
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Сервер запущен на порту " + PORT);
});
