const express = require("express");
require("dotenv").config();
const bodyParser = require("body-parser");
const TelegramApi = require("node-telegram-bot-api");
const {
  startGuessWork,
  checkGameStatus,
  resetGuessGame,
} = require("./games/guessWord");
const {
  checkDevelopmentStatus,
  checkAdminRights,
  get,
} = require("./utils/utils");
const {
  beautyGame,
  checkBeautyGameStatus,
  resetBeautyGame,
} = require("./games/beautyGame");

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramApi(token);
const app = express();

let isWorking = true;
let selected = {}; 
let currentGame = {}; 
app.use(bodyParser.json());

const checkGroup = async (chatId) => {
  try {
    if (chatId < 0) {
      const isAdmin = await checkAdminRights(bot, chatId);
      if (!isAdmin) {
        return {
          message: bot.sendMessage(
            chatId,
            "⚠️ Для начала игры боту нужно быть администратором группы."
          ),
          status: false,
        };
      }
      return { status: true };
    } else if (chatId > 0) {
      return {
        message: bot.sendMessage(
          chatId,
          "⚠️ Команда доступна только в группах."
        ),
        status: false,
      };
    }
  } catch (err) {
    return { status: false };
  }
};

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  if (msg.text === "/start" && !selected[chatId]) {
    return bot.sendMessage(
      chatId,
      `Привет! 👋 Добро пожаловать в *AeroGuess Games*! 🎮  
Здесь тебя ждёт несколько весёлых и умных игр с друзьями в чате! 😄  
Готов начать? Просто добавь бота в групповой чат и выбери игру.  

🔥 Доступные игры:  
• *AeroGuess 🧠* — угадай слово по объяснению  
• *Number Battle 🎲* — угадай число Бота и обыграй других игроков  

✨ *Команды для начала игры*:  
/startgame — Начать игру  
/cancelgame — Закончить игру  
/help — Помощь по играм  

📩 *Если возникнут вопросы* — пиши мне в Telegram! @ApM_To  
👾 *Телеграм-канал*: https://t.me/aeroguessclub
`,
      {parse_mode: "Markdown"}
    );
  }
});

bot.onText(/\/rules/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, "Выберите игру:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Конкурс кроссвордов (игра со словами)", callback_data: "word_game" }],
        [{ text: "Конкурс с цифрами", callback_data: "number_game" }]
      ]
    }
  });
});

bot.on("callback_query", (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const { data } = callbackQuery;

  bot.deleteMessage(chatId, callbackQuery.message.message_id);

  let gameRules;
  if (data === "word_game") {
    gameRules = generateGuessWordText();
  } else if (data === "number_game") {
    gameRules = generateBeautyRuleText();
  }

  bot.sendMessage(chatId, gameRules, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Вернуться в меню", callback_data: "back_to_menu" }]
      ]
    }
  });
});

bot.on("callback_query", (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const { data } = callbackQuery;

  if (data === "back_to_menu") {
    bot.deleteMessage(chatId, callbackQuery.message.message_id);
    bot.sendMessage(chatId, "Выберите игру:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Конкурс кроссвордов (игра со словами)", callback_data: "word_game" }],
          [{ text: "Конкурс с цифрами", callback_data: "number_game" }]
        ]
      }
    });
  }
});


bot.onText(/\/startgame/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (selected[chatId]) {
    return bot.sendMessage(
      chatId,
      "Вы уже выбрали игру! Ждите до окончания текущей игры!"
    );
  }

  let statusDevelopment = checkDevelopmentStatus(isWorking, bot, chatId);
  if (statusDevelopment.status === true && msg.from.username !== "ApM_To") {
    return statusDevelopment.message;
  }

  const checkGroupAndRole = await checkGroup(chatId);
  if (checkGroupAndRole.status === false) {
    return checkGroupAndRole.message;
  }

  bot.sendMessage(
    chatId,
    "Пожалуйста, выберите игру, которую хотите запустить",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🎲 Игра в слова", callback_data: "start_game" }],
          [{ text: "💄 Конкурс красоты", callback_data: "beauty_game" }],
        ],
      },
    }
  );
});

bot.onText(/\/startgbeautygame/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  console.log(currentGame[chatId]);

  if (currentGame[chatId] === "guessWord") {
    return bot.sendMessage(
      chatId,
      "Вы уже выбрали игру! Ждите до окончания текущей игры!"
    );
  }

  const beautyStatus = checkBeautyGameStatus(chatId);
  if (beautyStatus) {
    return bot.sendMessage(
      chatId,
      "Вы уже выбрали игру! Ждите до окончания текущей игры!"
    );
  }

  try {
    bot.sendMessage(
      userId,
      'Вы успешно присоединились к игре "Конкурс красоты" ✅'
    );
    beautyGame(bot, chatId, userId, msg.from.first_name);
    currentGame[chatId] = "beauty";
    selected[chatId] = true;
  } catch (error) {
    console.error("Ошибка при запуске конкурса красоты:", error);
    bot.sendMessage(
      chatId,
      "❌ Произошла ошибка при запуске конкурса красоты. Попробуйте снова."
    );
  }
});

bot.onText(/\/startguessgame/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (currentGame[chatId] === "beauty") {
    return bot.sendMessage(
      chatId,
      "Вы уже выбрали игру! Ждите до окончания текущей игры!"
    );
  }

  const guessWordStatus = checkGameStatus();
  if (guessWordStatus) {
    return bot.sendMessage(
      chatId,
      "Вы уже выбрали игру! Ждите до окончания текущей игры!"
    );
  }

  let statusDevelopment = checkDevelopmentStatus(isWorking, bot, chatId);
  if (statusDevelopment.status === true && msg.from.username !== "ApM_To") {
    return statusDevelopment.message;
  }

  startGuessWork(bot, chatId, userId, msg.from.first_name);
  currentGame[chatId] = "guessWord";
  selected[chatId] = true;
});

bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;

  if (!query.message || !query.id) {
    return;
  }

  if (
    selected[chatId] &&
    (query.data === "start_game" || query.data === "beauty_game")
  ) {
    bot.answerCallbackQuery(query.id, {
      text: "Вы уже выбрали игру!",
      show_alert: true,
    });
    return;
  }

  if (query.data === "start_game") {
    startGuessWork(bot, chatId, userId, query.from.first_name);
    currentGame[chatId] = "guessWord";
    selected[chatId] = true;
  } else if (query.data === "beauty_game") {
    try {
      bot.sendMessage(
        query.from.id,
        'Вы успешно присоединились к игре "Конкурс красоты" ✅'
      );
      beautyGame(bot, chatId, userId, query.from.first_name);
      currentGame[chatId] = "beauty";
      selected[chatId] = true;
    } catch (error) {
      console.error(
        "Ошибка при отправке сообщения или присоединении к игре:",
        error
      );

      bot.answerCallbackQuery(query.id, {
        text: "❌ Чтобы присоединиться к игре, вам нужно быть подписанным на бота!",
        show_alert: true,
      });
    }
  }
});

bot.onText("/cancelgame", async (msg) => {
  const chatId = msg.chat.id;

  if (currentGame[chatId] === null) {
    return;
  } else if (currentGame[chatId] === "guessWord") {
    resetGuessGame(chatId);
    currentGame[chatId] = null;
  } else if (currentGame[chatId] === "beauty") {
    resetBeautyGame(chatId);
    currentGame[chatId] = null;
  }

  bot.sendMessage(chatId, "🔴 Игра завершена!");
  selected[chatId] = false;
});

bot.setMyCommands([
  { command: "/startgame", description: "Меню Игр" },
  { command: "/startguessgame", description: "Начать игру 'Игру в слова'" },
  {
    command: "/startgbeautygame",
    description: "Начать игру 'Конкурс красоты'",
  },
  {command: "/rules", description: "Правила игры"},
  { command: "/cancelgame", description: "Завершить игру" },
  { command: "/start", description: "Приветствие" },
]);

bot.setWebHook(`${process.env.SERVER_LINK}/webhook`);

app.post("/webhook", (req, res) => {
  const update = req.body;
  bot.processUpdate(update);
  res.sendStatus(200);
});

app.get("/ping", (req, res) => {
  res.send("Server is alive");
});

setInterval(() => {
  fetch(`${process.env.SERVER_LINK}/ping`)
    .then((res) => res.text())
    .then((data) => console.log(`Keep-alive: ${data}`))
    .catch((err) => console.error(`Keep-alive error: ${err}`));
}, 9 * 60 * 1000);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
