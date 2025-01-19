function emptyDOM(elem) {
    while (elem.firstChild) elem.removeChild(elem.firstChild);
}

function createDOM(htmlString) {
    let template = document.createElement('template');
    template.innerHTML = htmlString.trim();
    return template.content.firstChild;
}

function* makeConversationLoader(room) {
    let lastConversationTimestamp = room.creationTimestamp;
    while (room.canLoadConversation) {        
        room.canLoadConversation = false;
        try {
            Service.getLastConversation(room.id, lastConversationTimestamp)
                .then(conversation => {
                    if (conversation) {
                        room.addConversation(conversation);
                        lastConversationTimestamp = conversation.timestamp;
                        room.canLoadConversation = true;
                    }
                })
                .catch(error => {
                    console.error('Error loading conversation:', error);
                    room.canLoadConversation = true;
                });
        } catch (error) {
            console.error('Error loading conversation:', error);
            room.canLoadConversation = true;
        }
        yield new Promise(resolve => setTimeout(resolve, 1000));
    }
}

let profile = {
    username: "Alice"
};

let Service = {
    origin: window.location.origin,
    getAllRooms: function () {
        console.log(`Getting all the rooms from this endpoint: ${this.origin}/chat`);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', `${this.origin}/chat`);
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        reject(new Error(xhr.responseText));
                    }
                }
            };
            xhr.onerror = function () {
                reject(new Error('Request failed'));
            };

            xhr.send();
        });
    },
    addRoom: function (data) {
        console.log("Trying to add a room to this endpoint: " + `${this.origin}/chat`);
        const { name, image } = data;
        const bodyData = {
            name: name
        };
        if (image) {
            bodyData.image = image;
        }

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${this.origin}/chat`);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    reject(new Error(`${xhr.responseText}`));
                }
            };
            xhr.onerror = function () {
                reject(new Error('Request failed'));
            };
            xhr.send(JSON.stringify(bodyData));
        });
    },
    getLastConversation: function (roomId, before) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', `${this.origin}/chat/${roomId}/messages?before=${before}`);
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        reject(new Error(xhr.responseText));
                    }
                }
            };
            xhr.onerror = function () {
                reject(new Error('Request failed'));
            };
            xhr.send();
        });
    },

    getProfile: function () {
        return new Promise((resolve, reject) => {
            fetch(`${this.origin}/profile`, { credentials: 'include' })
                .then(response => {
                    if (response.ok) {
                        return response.json();
                    } else {
                        throw new Error('Network response was not ok.');
                    }
                })
                .then(data => {
                    profile.username = data.username; // Update the profile with fetched username
                    resolve(data);
                })
                .catch(error => reject(error));
        });
    }

};

class LobbyView {
    constructor(lobby) {
        this.elem = createDOM(`
            <div class="content">
                <!-- Corresponding content from index.html -->
                <ul class="room-list">
                    // <li><a href="#/chat">Room 1</a></li>
                    // <li><a href="#/chat">Room 2</a></li>
                    // <li><a href="#/chat">Room 3</a></li>
                    // <li><a href="#/chat">Room 4</a></li>
                </ul>
                <div class="page-control">
                    <input type="text" class="page-control-input" placeholder="New room name">
                    <button class="page-control-btn">Create Room</button>
                </div>
            </div>
        `);

        this.listElem = this.elem.querySelector('.room-list');
        this.inputElem = this.elem.querySelector('.page-control-input');
        this.buttonElem = this.elem.querySelector('.page-control-btn');

        this.lobby = lobby;

        this.redrawList();

        this.buttonElem.addEventListener('click', () => {
            const newRoomName = this.inputElem.value.trim();
            const newRoomImage = 'assets/everyone-icon.png';

            Service.addRoom({
                name: newRoomName,
                image: newRoomImage
            })
                .then(newRoom => {
                    this.lobby.addRoom(newRoom.id, newRoom.name, newRoom.image);
                    this.inputElem.value = '';
                })
                .catch(error => {
                    console.error('Error adding room:', error);
                    const errorMessage = document.createElement('div');
                    errorMessage.textContent = `Error adding room: ${error.message}`;
                    errorMessage.classList.add('error-message');
                    this.elem.appendChild(errorMessage);
                });
        });

        this.lobby.onNewRoom = (room) => {
            const listItem = createDOM(`<li><a href="#/chat/${room.id}">${room.name}</a></li>`);
            this.listElem.appendChild(listItem);
        };
    }

    redrawList() {
        emptyDOM(this.listElem);

        for (const roomId in this.lobby.rooms) {
            const room = this.lobby.rooms[roomId];

            const listItem = createDOM(`<li><a href="#/chat/${room.id}">${room.name}</a></li>`);
            this.listElem.appendChild(listItem);
        }
    }
}

///

// function sanitizeString(str) {
//     return str.replace(/&/g, '&amp;')
//               .replace(/</g, '&lt;')
//               .replace(/>/g, '&gt;')
//               .replace(/"/g, '&quot;')
//               .replace(/'/g, '&#039;');
// }

function sanitizeString(str) {
    return str.replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;')
              .replace(/&(?!(amp;|lt;|gt;|quot;|apos;|#039;))/g, '&amp;');
}


class ChatView {
    constructor(socket) {
        this.elem = createDOM(`
            <div class="content">
                <!-- Corresponding content from chat.html -->
                <h4 class="room-name">Chat Room Title</h4>
                <div class="message-list">
                    <div class="message">
                        <span class="message-user">Alice:</span>
                        <span class="message-text">Hi there!</span>
                    </div>
                    <div class="message my-message">
                        <span class="message-user">Bob:</span>
                        <span class="message-text">Hello!</span>
                    </div>
                    <!-- More messages will go here -->
                </div>
                <div class="page-control">
                    <textarea class="page-control-input" placeholder="Type your message here..."></textarea>
                    <button class="page-control-btn">Send</button>
                </div>
            </div>
        `);



        this.titleElem = this.elem.querySelector('.room-name');
        this.chatElem = this.elem.querySelector('.message-list');
        this.inputElem = this.elem.querySelector('.page-control-input');
        this.buttonElem = this.elem.querySelector('.page-control-btn');

        this.room = null;

        this.buttonElem.addEventListener('click', () => this.sendMessage());

        this.inputElem.addEventListener('keyup', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                this.sendMessage();
            }
        });

        this.socket = socket;

        this.chatElem.addEventListener('wheel', (event) => {
            if (event.deltaY < 0 && this.chatElem.scrollTop === 0 && this.room.canLoadConversation) {
                this.room.getLastConversation.next();
            }
        });        
    }

    sendMessage() {
        const newMessage = this.inputElem.value.trim();

        if (newMessage) {
            this.room.addMessage(profile.username, newMessage);
            this.inputElem.value = '';
        }

        const message = {
            roomId: this.room.id,
            username: profile.username,
            text: newMessage
        };
        this.socket.send(JSON.stringify(message));
    }

    setRoom(room) {
        console.log("Setting room:", room);

        this.room = room;
        this.titleElem.textContent = room.name;

        emptyDOM(this.chatElem);

        console.log("Order of messages in room.messages:", room.messages);

        room.messages.forEach(message => {
            console.log("Adding message to chat:", message);
            this.addMessageToChat(message);
        });

        this.room.onNewMessage = (message) => {
            console.log("New message received:", message);
            this.addMessageToChat(message);
        };

        room.onFetchConversation = (conversation) => {
            const hb = this.chatElem.scrollHeight;
            conversation.messages.slice().reverse().forEach(message => {
                this.addMessageToChat(message, true); // Assuming addMessageToChat takes a second parameter to prepend
            });
    
            let ha = this.chatElem.scrollHeight;
            this.chatElem.scrollTo(0, ha - hb);
        };
    }

    addMessageToChat(message, prepend = false) {
        message.text = sanitizeString(message.text);
        const messageElem = createDOM(`<div class="message${message.username === profile.username ? ' my-message' : ''}">
            <span class="message-user">${message.username}</span>
            <span class="message-text">${message.text}</span>
        </div>`);
        // this.chatElem.appendChild(messageElem);
        if (prepend) {
            this.chatElem.insertBefore(messageElem, this.chatElem.firstChild);
        } else {
            this.chatElem.appendChild(messageElem);
        }
    }
}

class ProfileView {
    constructor() {
        this.elem = createDOM(`
            <div class="content">
                <!-- Corresponding content from profile.html -->
                <div class="profile-form">
                    <div class="form-field">
                        <label for="username">Username:</label>
                        <input type="text" id="username">
                    </div>
                    <div class="form-field">
                        <label for="password">Password:</label>
                        <input type="password" id="password">
                    </div>
                    <div class="form-field">
                        <label for="avatar">Avatar:</label>
                        <input type="file" id="avatar">
                    </div>
                    <div class="form-field">
                        <label for="about">About:</label>
                        <textarea id="about" placeholder="Tell us about yourself..."></textarea>
                    </div>
                </div>
                <div class="page-control">
                    <button class="page-control-btn">Save Changes</button>
                </div>
            </div>
        `);
    }
}

class Room {
    constructor(id, name, image = 'assets/everyone-icon.png', messages = []) {
        this.id = id;
        this.name = name;
        this.image = image;
        this.messages = messages;
        this.creationTimestamp = Date.now();
        this.getLastConversation = makeConversationLoader(this);
        this.canLoadConversation = true;
    }

    addConversation(conversation) {
        this.messages.unshift(...conversation.messages);
        if (this.onFetchConversation) {
            this.onFetchConversation(conversation);
        }
    }


    addMessage(username, text) {
        if (!text.trim()) {
            return;
        }

        console.log(`Adding message to ${this.name} room:`, { username, text });

        const message = { username, text };
        this.messages.push(message);

        if (this.onNewMessage) {
            this.onNewMessage(message);
        }
    }
}

class Lobby {
    constructor() {
        this.rooms = {};
        this.onNewRoom = null;
    }

    getRoom(roomId) {
        return this.rooms[roomId] || null;
    }

    addRoom(id, name, image, messages) {
        this.rooms[id] = new Room(id, name, image, messages);

        if (this.onNewRoom) {
            this.onNewRoom(this.rooms[id]);
        }
    }
}

function main() {

    const socket = new WebSocket('ws://localhost:8000');

    socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        const room = lobby.getRoom(message.roomId);
        if (room) {
            room.addMessage(message.username, message.text);
        }
    });

    const lobby = new Lobby();

    const lobbyView = new LobbyView(lobby);
    const chatView = new ChatView(socket);
    const profileView = new ProfileView();

    function refreshLobby() {
        Service.getAllRooms()
            .then(rooms => {
                for (const room of rooms) {
                    if (lobby.rooms[room.id]) {
                        lobby.rooms[room.id].name = room.name;
                        lobby.rooms[room.id].image = room.image;
                        lobby.rooms[room.id].messages = room.messages;
                    } else {
                        lobby.addRoom(room.id, room.name, room.image, room.messages);
                    }
                }
            })
            .catch(error => {
                console.error("Error refreshing the lobby: " + error);
            });
    }

    refreshLobby();

    setInterval(refreshLobby, 60000);

    Service.getProfile()
        .then(() => {
            console.log('Profile updated:', profile);
        })
        .catch(error => console.error('Error fetching profile:', error));

    function renderRoute() {
        console.log("Current path:", window.location.hash.substring(1));

        const path = window.location.hash.substring(1);
        console.log("Path extracted from URL:", path);

        const pageView = document.getElementById('page-view');

        console.log("Page View Element:", pageView);

        emptyDOM(pageView);

        if (path == "" || path === "/") {
            pageView.appendChild(lobbyView.elem);
        } else if (path.startsWith("/chat")) {
            console.log("Path before extracting room ID:", path);
            const parts = path.split('/');
            console.log("Parts array:", parts);
            const roomId = parts[2];
            console.log("Rooms in the lobby:", Object.keys(lobby.rooms));

            const room = lobby.getRoom(roomId);

            if (room) {
                chatView.setRoom(room);
                pageView.appendChild(chatView.elem);
            } else {
                console.error("Room not found");
            }
        } else if (path === "/profile") {
            pageView.appendChild(profileView.elem);
        }
    }

    


    window.addEventListener('popstate', renderRoute);

    renderRoute();
    
    cpen322.export(arguments.callee, {
        refreshLobby: refreshLobby,
        lobby: lobby,
        socket: socket,
        chatView: chatView
    });

    cpen322.setDefault("testRoomId", "room-1");
    cpen322.setDefault("cookieName", "cpen322-session");
    // cpen322.setDefault("testUser1", "{ username: 'alice', password: 'secret', saltedHash: '1htYvJoddV8mLxq3h7C26/RH2NPMeTDxHIxWn49M/G0wxqh/7Y3cM+kB1Wdjr4I=' }");
    // cpen322.setDefault("testUser2", "{ username: 'bob', password: 'password', saltedHash: 'MIYB5u3dFYipaBtCYd9fyhhanQkuW4RkoRTUDLYtwd/IjQvYBgMHL+eoZi3Rzhw=' }");
    cpen322.setDefault("image", "assets/everyone-icon.png");
    cpen322.setDefault("webSocketServer", "ws://localhost:8000");
}

window.addEventListener('load', main);
