const { createServer } = require('http');
const { writeFile, mkdirSync, existsSync, readFile } = require('fs');
const { log } = require('console');
const { exec } = require('child_process');
const process = require('process');

const { getPosts, getPhoto } = require('./telegram');

const contentTypes = {
  jpg: 'image/jpeg',
  svg: 'image/svg+xml',
  js: 'text/javascript',
  json: 'application/json',
  html: 'text/html',
  css: 'text/css',
};

async function requestListener(req, res) {
  const [route, folderName, fileName] = req.url.slice(1).split('/');

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');

  let body = [];

  req
    .on('data', (chunk) => {
      body.push(chunk);
    })
    .on('end', async () => {
      body = Buffer.concat(body).toString();

      if (route === '') {
        readFile('front/index.html', (err, data) => {
          if (!err) {
            res.setHeader('Content-Type', contentTypes.html);
            res.writeHead(200);
            res.end(data);
          } else {
            res.writeHead(404);
            res.end();
          }
        });
        return;
      }

      if (route === 'posts') {
        if (req.headers['content-type'] === contentTypes.json) {
          const parsedBody = JSON.parse(body);
          const { posts, failedPosts } = await fetchPosts(parsedBody);

          writeFile(`reports/${parsedBody.folderName}/report.csv`, assembleCsv(posts), () => {});
          writeFile(`reports/${parsedBody.folderName}/failedReport.csv`, assembleCsv(failedPosts), () => {});

          res.setHeader('Content-Type', contentTypes.json);
          res.writeHead(200);
          res.end(JSON.stringify(failedPosts));
        } else {
          res.writeHead(200);
          res.end();
        }
        return;
      }

      if (route === 'images' || route === 'assets') {
        let path, ext;

        if (route === 'assets') {
          path = `front/assets/${folderName}`;
          ext = folderName.split('.')[1];
        }

        if (route === 'images') {
          path = `reports/${folderName}/${fileName}`;
          ext = fileName.split('.')[1];
        }

        readFile(path, (err, data) => {
          if (!err) {
            res.setHeader('Content-Type', contentTypes[ext]);
            res.writeHead(200);
            res.end(data);
          } else {
            log(err);
            res.writeHead(404);
            res.end();
          }
        });
        return;
      }

      if (route === 'settings') {
        readFile('settings.json', (err, data) => {
          if (!err) {
            let settings = JSON.parse(data);

            if (req.headers['content-type'] === contentTypes.json) {
              const parsedBody = JSON.parse(body);
              settings = { ...settings, ...parsedBody };
              writeFile('settings.json', JSON.stringify(settings, null, 2), () => {});
            }

            res.setHeader('Content-Type', contentTypes.json);
            res.writeHead(200);
            res.end(JSON.stringify(settings));
          } else {
            res.writeHead(200);
            res.end();
          }
        });
        return;
      }

      if (route === 'ping') {
        res.writeHead(200);
        res.end();
        return;
      }

      res.writeHead(404);
      res.end();
      return;
    });
}

function formatDateString(date) {
  const dateObject = new Date(date * 1000);
  const dateArray = [dateObject.getFullYear(), dateObject.getMonth() + 1, dateObject.getDate(), dateObject.getHours(), dateObject.getMinutes()];

  return dateArray.map((date) => date.toString().padStart(2, '0')).join('');
}

async function formatPost(rawPost, fullLink, fetchPhotos, notes, rawNotes, photosPositions, folderName) {
  const {
    chats: [{ title }, ...otherChats],
    messages: [{ message, media, date, fwdFrom }, ...restMessages],
    users,
  } = rawPost;

  const formattedMessage = [message ?? ''];

  if (media) {
    const { photo, webpage } = media;

    if (photo && fetchPhotos) {
      if (photosPositions.includes('1') || photosPositions.length === 0) {
        const photoId = await getPhoto(photo, folderName);
        formattedMessage.push(`http://${host}:${port}/images/${folderName}/${photoId}.jpg`);
      }

      try {
        for (const {
          media: { photo },
        } of restMessages) {
          const photoId = await getPhoto(photo, folderName);
          formattedMessage.push(`http://${host}:${port}/images/${folderName}/${photoId}.jpg`);
        }
      } catch (error) {
        return {
          result: false,
          post: {
            fullLink,
            notes: rawNotes,
          },
        };
      }
    }

    if (webpage) {
      const { siteName = '', title = '', description = '' } = webpage;
      formattedMessage.push(siteName, title, description);
    }
  }

  let forwardedFrom = null;
  if (fwdFrom) {
    if (fwdFrom.fromId) {
      if (fwdFrom.fromId.className === 'PeerUser') {
        const fwdUserId = Number(fwdFrom.fromId.userId);
        const { firstName, lastName } = users.filter(({ id }) => id == fwdUserId)[0];

        forwardedFrom = `${firstName} ${lastName}`;
      }
      if (fwdFrom.fromId.className === 'PeerChannel') {
        const fwdChannelId = Number(fwdFrom.fromId.channelId);

        if (otherChats) {
          const { title } = otherChats.filter(({ id }) => id == fwdChannelId)[0];

          forwardedFrom = title;
        } else forwardedFrom = title;

        forwardedFrom = title;
      }
    } else forwardedFrom = fwdFrom.fromName;
  }

  return {
    result: true,
    post: {
      title,
      forwardedFrom,
      message: formattedMessage.join('\n').replace(/^\s*$(?:\r\n?|\n)/gm, ''),
      date: formatDateString(date),
      fullLink,
      notes,
    },
  };
}

async function fetchPosts({ linksList, folderName }) {
  if (!existsSync(`reports/${folderName}`)) {
    mkdirSync(`reports/${folderName}`);
  }

  const posts = [];
  const failedPosts = [];

  for (const { fullLink, channelName, postId, notes, rawNotes, fetchPhotos, photosPositions } of linksList) {
    if (channelName === 'c') {
      failedPosts.push({
        fullLink,
        notes: rawNotes,
      });
      log(`Ошибка при сборе поста: ${fullLink}`);
      continue;
    }

    let postIds;

    // Форматируем id постов
    if (photosPositions.length > 0) postIds = [Number(postId), ...photosPositions.map((position) => Number(postId) + Number(position) - 1)];
    else postIds = [Number(postId)];

    // Получаем пост из телеграма
    const rawPost = await getPosts(channelName, postIds, fullLink);

    if (!rawPost) {
      failedPosts.push({
        fullLink,
        notes: rawNotes,
      });
      log(`Ошибка при сборе поста: ${fullLink}`);
      continue;
    }

    const { result, post: formattedPost } = await formatPost(rawPost, fullLink, fetchPhotos, notes, rawNotes, photosPositions, folderName);

    if (result) {
      posts.push(formattedPost);
      log(`Успешно собран пост: ${fullLink}`);
    } else {
      failedPosts.push(formattedPost);
      log(`Ошибка при сборе поста: ${fullLink}`);
    }
  }

  log('Сбор постов завершен');
  return { posts, failedPosts };
}

function assembleCsv(posts) {
  log('Начал собирать таблицу');

  const delimeter = '\t';
  let header = `Channel${delimeter}Repost${delimeter}Date & Time${delimeter}Text${delimeter}Link`;
  let maximumNotesPerRow = 0;
  const rows = [];

  for (const { title, forwardedFrom, date, message, fullLink, notes } of posts) {
    let row = [];

    row.push(title ?? '');
    row.push(forwardedFrom ?? '');
    row.push(date ?? '');
    row.push(message?.replace(/\n/gm, ' NEWLINE ') ?? '');
    row.push(fullLink);

    if (notes) {
      row.push(...notes);
      maximumNotesPerRow = notes.length > maximumNotesPerRow ? notes.length : maximumNotesPerRow;
    }

    rows.push(row.join(delimeter));
  }

  for (let i = 1; i <= maximumNotesPerRow; i++) {
    header += `${delimeter}Note${i}`;
  }
  header += '\n';

  log('Закончил собирать таблицу');
  return header + rows.join('\n');
}

const host = 'localhost';
const port = 8083;
const server = createServer(requestListener);
server.listen(port, host, () => {});

exec(`start http://${host}:${port}/`);

process.on('uncaughtException', UncaughtExceptionHandler);

function UncaughtExceptionHandler(err) {
  console.log('Uncaught Exception Encountered!!');
  console.log('err: ', err);
  console.log('Stack trace: ', err.stack);
}
