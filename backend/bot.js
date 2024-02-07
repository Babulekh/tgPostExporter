const { Api, TelegramClient } = require("telegram");
const { NewMessage, NewMessageEvent } = require("telegram/events");
const { Album } = require("telegram/events/Album");

/**
 * 
 * @param {TelegramClient} client 
 */
exports.startBot = function (client)
{
    client.addEventHandler(
        /**
         * 
         * @param {NewMessageEvent} event 
         */
        async (event) => {
            const chatID = Number(event.message.chatId);      
            if (event.message.message.startsWith("/start")) {
            client.sendMessage(chatID, {
                message: "Welcome to my Telegram bot!",
            }); 
            } else {
            client.sendMessage(chatID, {
                message: "Сам ты " + event.message.message,
            });
            }
     }, new NewMessage({}));
  
     client.addEventHandler(
        /**
         * 
         * @param {Api.TypeUpdate} event 
         */
        async (event) => {
        if( event instanceof Api.UpdateChatParticipant)
        {
            // Added to chat
        }
        console.log(event);
     });
}