const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const firebaseAdmin = require('firebase-admin');
const dotenv = require('dotenv');
dotenv.config();

// Firebase setup
firebaseAdmin.initializeApp({
   credential: firebaseAdmin.credential.cert(require('./serviceAccountKey.json')),
   databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const db = firebaseAdmin.firestore();
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 5000;

const clients = new Map();

wss.on('connection', (ws) => {
   ws.on('message', async (message) => {
      const data = JSON.parse(message);

      if (data.type === 'NEW_USER') {
         clients.set(data.userId, ws);
         ws.userId = data.userId;
      }

      if (data.type === 'NEW_MESSAGE') {
         const messageData = {
            text: data.text,
            timestamp: new Date().toISOString(),
            senderId: data.senderId,
            recipientId: data.recipientId,
         };

         // Store message in Firebase Firestore
         await db.collection('messages').add(messageData);

         // Send message to recipient if online
         const recipientSocket = clients.get(data.recipientId);
         if (recipientSocket) {
            recipientSocket.send(JSON.stringify({
               type: 'RECEIVE_MESSAGE',
               ...messageData,
            }));
         }
      }
   });

   ws.on('close', () => {
      clients.delete(ws.userId);
   });
});

server.listen(PORT, () => {
   console.log(`Server started on port ${PORT}`);
});
