const path = require('path');
const fs = require('fs');
const express = require('express');
const WebSocket = require('ws');
const cpen322 = require('./cpen322-tester.js');
const Database = require('./Database.js');
const SessionManager = require('./SessionManager.js');
const sessionManager = new SessionManager();
const crypto = require('crypto');
const language = require('@google-cloud/language');
const client = new language.LanguageServiceClient({
    keyFilename: 'path/to/your/service-account-file.json'  //
});

const mongoUrl = 'mongodb://127.0.0.1:27017';
const dbName = 'cpen322-messenger';

const db = new Database(mongoUrl, dbName);

db.connected.then(() => {
    console.log(`[MongoClient] Connected to ${mongoUrl}/${dbName}`);
}).catch(err => {
    console.error('[MongoClient] Connection error:', err);
});

function logRequest(req, res, next){
	console.log(`${new Date()}  ${req.ip} : ${req.method} ${req.path}`);
	next();
}

const host = 'localhost';
const port = 3000;
const clientApp = path.join(__dirname, 'client');

const broker = new WebSocket.Server({ port: 8000 });

const messageBlockSize = 10;

// express app
let app = express();

app.use(express.json()) 						// to parse application/json
app.use(express.urlencoded({ extended: true })) // to parse application/x-www-form-urlencoded
app.use(logRequest);							// logging for debug

let messages = {};

function sanitizeString(str) {
    return str.replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;')
              .replace(/&(?!(amp;|lt;|gt;|quot;|apos;|#039;))/g, '&amp;');
}


db.getRooms()
    .then(rooms => {
        rooms.forEach(room => {
            messages[room._id] = [];
        });
    })
    .catch(err => {
        console.error('Error initializing messages:', err);
    });

    broker.on('connection', function connection(ws, req) {
        console.log('Client connected');
    
        // Parse cookies from request
        const cookieHeader = req.headers.cookie;
        if (!cookieHeader) {
            console.log('No cookie header, closing WebSocket connection.');
            ws.close();
            return;
        }
    
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
            const [name, value] = cookie.split('=').map(c => c.trim());
            acc[name] = value;
            return acc;
        }, {});
    
        const sessionToken = cookies['cpen322-session'];
        if (!sessionManager.isValidSession(sessionToken)) {
            console.log('Invalid session, closing WebSocket connection.');
            ws.close();
            return;
        }
    
        ws.username = sessionManager.getUsername(sessionToken);
    
        ws.on('message', function incoming(message) {
            
            console.log('Received message:', message);
    
            try {
                let parsedMessage = JSON.parse(message);
                parsedMessage.text = sanitizeString(parsedMessage.text);
                parsedMessage.username = ws.username;
    
                const serializedMessage = JSON.stringify(parsedMessage);
    
                broker.clients.forEach(function each(client) {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(serializedMessage);
                    }
                });
    
                if (!messages[roomId]) {
                    messages[roomId] = [];
                }
                messages[roomId].push({ username, text });
    
                broker.clients.forEach(function each(client) {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        console.log('Broadcasting message to client');
                        client.send(serializedMessage);
                    }
                });
    
                if (messages[roomId].length === messageBlockSize) {
                    const conversation = {
                        room_id: roomId,
                        timestamp: Date.now(),
                        messages: messages[roomId].slice()
                    };

                    // messages.text = sanitizeString(messages.text);
    
                    db.addConversation(conversation)
                    .then(() => {
                        messages[roomId] = [];
                    }).catch(err => {
                        console.error('Error saving conversation:', err);
                    });
                }
    
            } catch (error) {
                console.error('Error parsing incoming message:', error);
            }
        });
    
        ws.on('close', function () {
            console.log('Client disconnected');
        });
    });

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await db.getUser(username);
        
        if (!user) {
            res.redirect('/login');
        } else {
            if (isCorrectPassword(password, user.password)) {
                sessionManager.createSession(res, username);
                res.redirect('/');
            } else {
                res.redirect('/login');
            }
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

app.use('/login', express.static(clientApp + '/login.html', {extensions: ['html', 'css']}));
app.use('/', sessionManager.middleware, express.static(clientApp, {extensions: ['html', 'css']}));

app.get('/chat/:room_id/messages', sessionManager.middleware, (req, res) => {
    const room_id = req.params.room_id;
    const before = req.query.before ? parseInt(req.query.before) : Date.now();

    db.getLastConversation(room_id, before)
    .then(conversation => {
        if (conversation) {
            res.json(conversation);
        } else {
            res.status(404).json({ error: `No conversation found for room ${room_id}` });
        }
    })
    .catch(err => {
        console.error('Error getting last conversation:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    });
});

app.get('/chat/:room_id', sessionManager.middleware, async (req, res) => {
    const room_id = req.params.room_id;
	console.log("Room ID:", room_id);

	let room = await db.getRoom(room_id);
	if (room) {
		res.json(room);
	} else {
		res.status(404).json({ error: `Room ${room_id} was not found` });
	}
});

app.post('/chat', sessionManager.middleware, (req, res) => {
    console.log("Received POST request to /chat with data:", req.body);
    const roomData = req.body;
    

    if (!roomData || !roomData.name) {
        console.error("Name field is required");
        res.status(400).json({ error: 'Name field is required' });
        return;
    }
    roomData.name = sanitizeString(roomData.name);

    

    db.getRooms().then(existingRooms => {
        const newRoomId = `room-${existingRooms.length + 1}`;
        const newRoom = {
            _id: newRoomId,
            name: roomData.name,
            image: roomData.image || 'assets/default-room-icon.png'
        };

        return db.addRoom(newRoom);
    })
    .then(addedRoom => {
        messages[addedRoom._id] = [];

        console.log("New room added successfully");
        res.status(200).json(addedRoom);
    })
    .catch(err => {
        console.error("Error adding new room:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    });
});

app.get('/chat', sessionManager.middleware, async (req, res) => {
    try {
        const rooms = await db.getRooms();
        const chatData = rooms.map(room => {
            return {
                id: room._id,
                name: room.name,
                image: room.image,
                messages: messages[room._id] || []
            };
        });
        res.json(chatData);
    } catch (error) {
        console.error("Error handling GET request for /chat:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

'/app.js', sessionManager.middleware, express.static(path.join(clientApp, 'app.js'));

'/index.html', sessionManager.middleware, express.static(path.join(clientApp, 'index.html'));

'/index', sessionManager.middleware, express.static(path.join(clientApp, 'index'));

'/', sessionManager.middleware, express.static(path.join(clientApp));

app.use((err, req, res, next) => {
    if (err instanceof SessionManager.Error) {
        if (req.headers.accept == 'application/json') {
            res.status(401).send(err);
        } else {
            res.redirect('/login');
        }
    } else {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/profile', sessionManager.middleware, (req, res) => {
    res.json({ username: req.username });
});

app.get('/logout', (req, res) => {
    sessionManager.deleteSession(req);
    res.redirect('/login');
});


function isCorrectPassword(password, saltedHash) {
    const salt = saltedHash.substring(0, 20);
    const originalHash = saltedHash.substring(20);
    const hash = crypto.createHash('sha256').update(password + salt).digest('base64');
    return hash === originalHash;
}

async function analyzeSentiment(text) {
    const document = {
        content: text,
        type: 'PLAIN_TEXT',
    };

    const [result] = await client.analyzeSentiment({document});
    return result.documentSentiment;
}

app.listen(port, () => {
	console.log(`${new Date()}  App Started. Listening on ${host}:${port}, serving ${clientApp}`);
});

cpen322.connect('http://3.98.223.41/cpen322/test-a5-server.js');
cpen322.export(__filename, { app, db, messages, messageBlockSize, sessionManager, isCorrectPassword , broker });