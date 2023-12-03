# Запуск

NodeJs v21.1

Для запуска нужен pnpm
npm i pnpm -g

Для доступа к апи нужно создать приложение на
https://my.telegram.org/auth

При первом запуске надо будет авторизоваться, ввести номер телефона, пароль, код и затем сохранить полученную строку сессии в коде

## Фронтенд

cd ./frontend
pnpm i
pnpm dev

# Бэкенд

cd ./backend
pnpm i
node server.js

Для сборки сервера под винду нужно прописать команду elevate pkg --target node18-win-x64 -o server-win.exe server.js
Для сборки сервера под макос нужно прописать команду elevate pkg --target node18-macos-x64 -o server-mac.app server.js
