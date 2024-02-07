const { log } = require('console');
const { writeFileSync, readFileSync } = require('fs');
const { startBot } = require('./bot');

const {
  Api: {
    channels: { GetMessages },
    InputPhotoFileLocation,
  },
  TelegramClient,
} = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');
const { NewMessage, NewMessageEvent } = require('telegram/events');

let client = {};

(async () => {
  let settings = readFileSync('settings.json', 'utf8');
  settings = JSON.parse(settings);
  let apiId = settings.apiId,
    apiHash = settings.apiHash,
    sessionString = settings.sessionString;

  if (!(settings.apiId && settings.apiHash)) {
    log(`Не хватает данных для авторизации
1. Залогинься на https://my.telegram.org/apps
2. Нажми на API Development tools
3. На странице создания приложения заполни только поля App title и Short name
4. Создай приложение
5. Скопируй (с помощью нажатия правой кнопкой мыши по полю ввода) необходимые значения со страницы сюда`);
  }

  if (!settings.apiId) apiId = await input.text('Скопируйте и вставьте сюда ваш api_id ');
  if (!settings.apiHash) apiHash = await input.text('Скопируйте и вставьте сюда ваш api_hash ');

  sessionString = new StringSession(sessionString);

  client = new TelegramClient(sessionString, Number(apiId), apiHash, {
    connectionRetries: 5,
  });
  client.setLogLevel('error');
  if (settings.botToken) {
    await client.start({botAuthToken: settings.botToken});
    startBot(client);
  }
  else {
    await client.start({
      phoneNumber: async () => await input.text('Номер телефона с кодом страны '),
      password: async () => await input.text('Пароль '),
      phoneCode: async () => await input.text('Код подтверждения '),
      onError: (err) => console.log(err),
    });
  }
  sessionString = client.session.save();

  writeFileSync('settings.json', JSON.stringify({ ...settings, apiId, apiHash, sessionString }, null, 2), () => {});
  log('Авторизация прошла успешно, можно работать');
})();

exports.getPhoto = async ({ id, accessHash, fileReference, dcId }, folderName) => {
  try {
    const buffer = await client.downloadFile(
      new InputPhotoFileLocation({
        id,
        accessHash,
        fileReference,
        thumbSize: 'i',
      }),
      {
        dcId,
      }
    );

    writeFileSync(`reports/${folderName}/${id}.jpg`, buffer);

    return id;
  } catch {}
};

exports.getPosts = async (channelName, postIds, fullLink) => {
  try {
    const post = await client.invoke(
      new GetMessages({
        channel: channelName,
        id: postIds,
      })
    );

    if (post.messages[0].className === 'MessageEmpty') return false;

    return post;
  } catch (e) {
    log(e);
  }

  return false;
};
