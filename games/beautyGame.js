const TelegramBot = require("node-telegram-bot-api");
const {
  newBeautyGameUser,
  getRandomEliminationMessage,
  getRandomVictoryMessage,
  generateBeautyRuleText,
} = require("../utils/utils");
const { text } = require("body-parser");

const bot = new TelegramBot();

let players = [];
let isGameRunning = false;
let mainText = null;
let listenersAdded = false;
isCanceled = false;
let isFinal = { status: false, isSent: false };
let newRuleAdded = {
  status: false,
  isSent: false,
};
let selected = false;
let interval;
checkBeautyGameStatus = () => {
  if (selected) {
    return true;
  }
  resetBeautyGame();
  return false;
};

function getUsersName() {
  return players
    .map((p) => `- 🤖 [${p.username}](tg://user?id=${p.userId})`)
    .join("\n");
}

function generateGameText() {
  return (
    `🎉 **Старт отбора участников!**\n\n` +
    `Игра "Конкурс Красоты" скоро начнется! 🌹 Ознакомьтесь с правилами и подпишитесь на бота!\n\n` +
    `🔥 Чтобы участвовать:\n1. Ознакомьтесь с правилами\n2. Подпишитесь на бота\n\n` +
    `**Участники**\n\n${getUsersName()}`
  );
}

const beautyGame = (bot, chatId, userId, userName) => {
  selected = true;
  isCanceled = false;
  players = [];
  if (isGameRunning) return;

  players.push(newBeautyGameUser(userId, userName));

  bot
    .sendMessage(chatId, generateGameText(), {
      reply_markup: {
        inline_keyboard: [
          [{ text: "👀 Учавствовать", callback_data: "start_beauty" }],
          [{ text: "⚠ Правила игры", callback_data: "rule_beauty" }],
        ],
      },
      parse_mode: "Markdown",
    })
    .then((msg) => (mainText = msg));

  let timer = 15;
  interval = setInterval(() => {
    timer--;
    if (timer === 10 || timer === 5) {
      bot.sendMessage(chatId, `⏰ Осталось ${timer} секунд`);
    } else if (timer === 0) {
      clearInterval(interval);
      if (players.length < 2) {
        return bot.sendMessage(
          chatId,
          "❌ Недостаточно участников для игры. Минимум 4 игрока."
        );
      }
      isGameRunning = true;
      bot.sendMessage(chatId, "🚀 Игра начинается!");
      startGame(bot, chatId);
    }
  }, 1000);

  if (!listenersAdded) {
    listenersAdded = true;

    bot.on("callback_query", (query) => {
      if (query.data === "start_beauty") {
        const chatId = query.message.chat.id;
        const currentUser = query.from;

        if (players.some((p) => p.userId === currentUser.id)) {
          return bot.answerCallbackQuery(query.id, {
            text: "⚠ Вы уже участвуете",
            show_alert: true,
          });
        }
      }
      if (query.data === "rule_beauty") {
        const userId = query.from.id;
        try {
          bot.sendMessage(
            userId,
            generateBeautyRuleText()
          );
        } catch (error) {
          bot.answerCallbackQuery(query.id, {
            text: "Вы должны быть подписаны на бота, чтобы получить правила.",
            show_alert: true,
          });
        }
      }

      players.push(newBeautyGameUser(currentUser.id, currentUser.first_name));
      bot.editMessageText(generateGameText(), {
        chat_id: chatId,
        message_id: mainText.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "👀 Учавствовать", callback_data: "start_beauty" }],
            [{ text: "⚠ Правила игры", callback_data: "rule_beauty" }],
          ],
        },
        parse_mode: "Markdown",
      });
    });
  }
};

async function startGame(bot, groupId) {
  await bot.sendPhoto(groupId, "./assets/beauty-game-logo.png", {
    caption:
      "🧠🎮 Игра начинается. Напишите число от 0 до 100 в личку боту. Удачи!",
  });

  startRound(bot, groupId);
}

async function startRound(bot, groupId) {
  bot.removeAllListeners("message");

  if (players.length === 2) {
    isFinal.status = true;
  }
  if (players.length <= 3) {
    newRuleAdded.status = true;
  }

  players.forEach((user) => {
    user.isSelected = false;
    user.number = null;
    user.originalNumber = null;
    bot.sendMessage(user.userId, "📌 Выберите число от 0 до 100");
  });

  if (newRuleAdded.status && !newRuleAdded.isSent) {
    await bot.sendMessage(
      groupId,
      `⚠ Игроков становится всё меньше... \n\n*Новое беспощадное правило:*\nЕсли оба выберут *одинаковое число* — *каждый из вас потеряет по 2 очка*.\n\n♟️ *Игра становится хищной. Предсказуемость — путь к поражению. Подумай дважды.*`,
      { parse_mode: "Markdown" }
    );

    newRuleAdded.isSent = true;
  }

  if (isFinal.status && !isFinal.isSent) {
    await bot.sendMessage(
      groupId,
      `⚠ Финальный раунд начинается... 🎭\n\n*Новое правило вступает в силу:*\nЕсли один из финалистов выберет *0*, а другой *100* — *победа безжалостно достаётся тому, кто рискнул и выбрал 0*.\n\nНо... если оба сыграют на *0* — *оба теряют по 1 очку*. \n\n♟️ *Ставки выросли. Ошибок не прощают. Время сделать выбор.*`,
      { parse_mode: "Markdown" }
    );

    isFinal.isSent = true;
  }

  bot.on("message", async (chat) => {
    const chatId = chat.chat.id;
    const text = +chat.text;

    const player = players.find((p) => p.userId === chatId);
    if (!player || player.isSelected) return;

    if (isNaN(text) || text < 0 || text > 100) {
      bot.sendMessage(chatId, "⚠ Пожалуйста, введите число от 0 до 100");
    } else {
      const result = Math.floor(text * 0.8);
      player.originalNumber = text;
      player.number = result;
      player.isSelected = true;

      await bot.sendMessage(chatId, `✅ Ваше число: ${text} * 0.8 = ${result}`);

      await bot.sendMessage(
        groupId,
        `[${chat.from.first_name}](tg://user?id=${chat.from.id}) выбрал(а) число`,
        { parse_mode: "Markdown" }
      );

      const allSelected = players.every((p) => p.isSelected);

      if (allSelected) {
        if (isFinal.status) {
          const [firstPlayer, secondPlayer] = players;

          const isFirst0 = firstPlayer.originalNumber === 0;
          const isFirst100 = firstPlayer.originalNumber === 100;
          const isSecond0 = secondPlayer.originalNumber === 0;
          const isSecond100 = secondPlayer.originalNumber === 100;

          if (isFirst0 && isSecond100) {
            secondPlayer.score += 1;
            await bot.sendMessage(
              groupId,
              `⚔️ [${firstPlayer.username}](tg://user?id=${firstPlayer.userId}) выбрал **0**, а [${secondPlayer.username}](tg://user?id=${secondPlayer.userId}) выбрал **100**.\n\n🏆 [${secondPlayer.username}] теряет **1 балл** и проигрывает раунд.`,
              { parse_mode: "Markdown" }
            );
          } else if (isFirst100 && isSecond0) {
            firstPlayer.score += 1;
            await bot.sendMessage(
              groupId,
              `⚔️ [${secondPlayer.username}](tg://user?id=${secondPlayer.userId}) выбрал **0**, а [${firstPlayer.username}](tg://user?id=${firstPlayer.userId}) выбрал **100**.\n\n🏆 [${firstPlayer.username}] теряет **+1 балл** и проигрывает раунд.`,
              { parse_mode: "Markdown" }
            );
          } else if (isFirst0 && isSecond0) {
            firstPlayer.score += 1;
            secondPlayer.score += 1;
            await bot.sendMessage(
              groupId,
              `⚔️ Оба финалиста выбрали **0**! Каждый из них теряет **1 балл**.`,
              { parse_mode: "Markdown" }
            );
          } else {
            await standardWinnerCalc(bot, groupId);
            return;
          }

          eliminateAndContinue(bot, groupId);
          return;
        }

        await standardWinnerCalc(bot, groupId);
      }
    }
  });
}

async function standardWinnerCalc(bot, groupId) {
  const botNumber =
    (players.reduce((acc, p) => acc + p.number, 0) / players.length) * 0.8;

  const closestPlayer = players.reduce((prev, curr) => {
    return Math.abs(curr.number - botNumber) < Math.abs(prev.number - botNumber)
      ? curr
      : prev;
  });

  const getAllUsersNumbers = players.map(
    (p) =>
      `- ${p.username}: ${p.number} (${
        p.score !== 0 ? "-" + p.score : p.score
      })\n`
  );

  const numberCounts = {};
  players.forEach((p) => {
    numberCounts[p.number] = (numberCounts[p.number] || 0) + 1;
  });

  const repeatedNumbers = Object.keys(numberCounts).filter(
    (key) => numberCounts[key] > 1
  );

  if (repeatedNumbers.length > 0) {
    const repeatedPlayers = players.filter((p) =>
      repeatedNumbers.includes(String(p.number))
    );

    const uniquePlayers = players.filter(
      (p) => !repeatedNumbers.includes(String(p.number))
    );

    if (players.length <= 3) {
      repeatedPlayers.forEach((p) => (p.score += 2));
      const repeatedNames = repeatedPlayers
        .map((p) => `- [${p.username}](tg://user?id=${p.userId}) (${p.number})`)
        .join("\n");

      await bot.sendMessage(
        groupId,
        `⚠️ Игроки выбрали одинаковое число и были наказаны:\n\n${repeatedNames}\n\nВсе они теряют **-2 балла** (наказание за повторение).\nРаунд завершён без победителя.`,
        { parse_mode: "Markdown" }
      );

      setTimeout(async () => {
        await eliminateAndContinue(bot, groupId);
      }, 1500);
      return;
    } else {
      const winnerChoseRepeatedNumber = repeatedPlayers.some(
        (p) => p.userId === closestPlayer.userId
      );

      if (winnerChoseRepeatedNumber) {
        await bot.sendMessage(
          groupId,
          `⚖️ Несколько игроков выбрали одинаковые числа, и среди них оказался победитель.\nРаунд завершён **ничьей**, никто не получает баллы. Начнём заново!`,
          { parse_mode: "Markdown" }
        );

        setTimeout(async () => {
          await eliminateAndContinue(bot, groupId);
        }, 1500);
        return;
      }
    }
  }

  await bot.sendMessage(groupId, `🎯 Все выбрали число!\n\nИдет рассчет...`);
  players.forEach((p) => {
    if (p.userId !== closestPlayer.userId) {
      p.score += 1;
    }
  });
  setTimeout(async () => {
    await bot.sendMessage(
      groupId,
      `🤖 Бот выбрал число: ${botNumber.toFixed(0)}\n\n` +
        `🏆 Победитель: [${closestPlayer.username}](tg://user?id=${closestPlayer.userId})\n\n` +
        `**Все числа:**\n\n${getAllUsersNumbers.join(
          ""
        )}\n\n А остальные участники теряют **1 балл**.\n\n`,
      { parse_mode: "Markdown" }
    );
    await eliminateAndContinue(bot, groupId);
  }, 2000);
}

async function eliminateAndContinue(bot, groupId) {
  const eliminatedPlayers = players.filter((p) => p.score >= 3);
  if (eliminatedPlayers.length > 0) {
    for (const p of eliminatedPlayers) {
      await bot.sendMessage(
        groupId,
        `❌ [${p.username}](tg://user?id=${
          p.userId
        }) ${getRandomEliminationMessage()}`,
        { parse_mode: "Markdown" }
      );
    }
    players = players.filter((p) => p.score < 3);
  }

  if (players.length === 0) {
    await bot.sendMessage(
      groupId,
      `🎭 Игра окончена! Все игроки были устранены. Победителей нет.`,
      { parse_mode: "Markdown" }
    );
    isGameRunning = false;
    return;
  }

  if (players.length === 1) {
    const winner = players[0];
    await bot.sendMessage(
      groupId,
      `Игра окончена!\n\n [${winner.username}](tg://user?id=${
        winner.userId
      }) ${getRandomVictoryMessage()} 🎉`,
      { parse_mode: "Markdown" }
    );
    resetBeautyGame();
    return;
  }

  setTimeout(() => {
    bot.sendMessage(groupId, "Начинается новый раунд! 😈");
    startRound(bot, groupId);
  }, 1500);
}

function resetBeautyGame(chatId) {
  players = [];
  clearInterval(interval);
  isGameRunning = false;
  mainText = null;
  listenersAdded = false;
  isCanceled = false;
  isFinal = { status: false, isSent: false };
  selected = false;
}

module.exports = { beautyGame, checkBeautyGameStatus, resetBeautyGame };
