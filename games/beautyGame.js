const words = require("../datas/words.js");

let currentWord = "";
let currentPlayerId = null;
let currentPlayerName = "";
let gameActive = false;
let isCanceled = false;
let gameTimeout = null;
let timer = null;
let selected = false;


checkGameStatus = () => {
  if (selected) {
    return true;
  }
  resetGuessGame();
  return false;
};

const startGuessWork = async (bot, chatId, userId, userName) => {
  isCanceled = false;
  selected = true;

  if (gameActive) {
    return bot.sendMessage(chatId, "🟡 Игра уже идёт!");
  }

  if (gameTimeout) {
    clearTimeout(gameTimeout);
  }

  currentPlayerId = userId;
  currentPlayerName = userName;
  currentWord = words[Math.floor(Math.random() * words.length)];
  gameActive = true;

  timer = setTimeout(() => {
    bot.sendMessage(chatId, "⏰ Время вышло! Игра обнуляется.");
    resetGuessGame(chatId);
  }, 300 * 1000);

  bot.sendMessage(
    chatId,
    `🎲 *Игра началась!*\n👤 *Объясняет:* ${currentPlayerName}`,
    {
      parse_mode: "Markdown",
    }
  );

  bot.sendMessage(chatId, "🔒 Нажми, чтобы увидеть слово!", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "👀 Показать слово", callback_data: "show_word" }],
        [{ text: "🔄 Сменить слово", callback_data: "change_word" }],
      ],
    },
  });

  bot.on("callback_query", (query) => {
    if (isCanceled || !gameActive) return;

    const chatId = query.message.chat.id;
    const userId = query.from.id;

    if (userId !== currentPlayerId) {
      return bot.answerCallbackQuery(query.id, {
        text: "❌ Только ведущий может видеть слово!",
        show_alert: true,
      });
    }

    if (query.data === "show_word") {
      bot.answerCallbackQuery(query.id, {
        text: `🤫 Твоё слово: ${currentWord}\nОбъясни его, но не называй напрямую!`,
        show_alert: true,
      });
    } else if (query.data === "change_word") {
      currentWord = words[Math.floor(Math.random() * words.length)];
      bot.answerCallbackQuery(query.id, {
        text: "✅ Слово изменено! Твоё новое слово: " + currentWord,
        show_alert: true,
      });
    }
  });

  bot.on("message", async (msg) => {
    if (!gameActive || !currentWord || isCanceled) return;

    const chatId = msg.chat.id;
    const text = msg.text?.toLowerCase();
    const userId = msg.from.id;
    const userName = msg.from.first_name;

    const replyText = msg.reply_to_message?.text?.toLowerCase();

    if (
      (text === currentWord.toLowerCase() ||
        replyText === currentWord.toLowerCase()) &&
      userId === currentPlayerId
    ) {
      resetGuessGame(chatId);
      return bot.sendMessage(
        chatId,
        "🔴 В связи с тем, что ведущий озвучил загаданное слово, игра завершается!"
      );
    }

    if (
      text === currentWord.toLowerCase() ||
      replyText === currentWord.toLowerCase()
    ) {
      bot.sendMessage(
        chatId,
        `🎉 *${userName} угадал(а) слово!* Это было: *${currentWord}*`,
        {
          parse_mode: "Markdown",
        }
      );
      currentPlayerId = userId;
      currentPlayerName = userName;
      currentWord = words[Math.floor(Math.random() * words.length)];

      bot.sendMessage(chatId, `🔄 Новый ведущий: *${currentPlayerName}*`, {
        parse_mode: "Markdown",
      });

      bot.sendMessage(chatId, "🔒 Нажми, чтобы увидеть слово!", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "👀 Показать слово", callback_data: "show_word" }],
            [{ text: "🔄 Сменить слово", callback_data: "change_word" }],
          ],
        },
      });

      clearTimeout(timer);
      timer = setTimeout(() => {
        bot.sendMessage(chatId, "⏰ Время вышло! Игра обнуляется.");
        resetGuessGame(chatId);
      }, 300 * 1000);
    }
  });

 
};

function resetGuessGame(chatId) {
  currentWord = "";
  currentPlayerId = null;
  currentPlayerName = "";
  gameActive = false;
  isCanceled = true;
  callbackQueryHandled = false;
  clearTimeout(timer);
  selected = false;
}

module.exports = { startGuessWork, checkGameStatus, resetGuessGame };
