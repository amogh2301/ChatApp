# Chat App

## 📌 Overview
This is a simple **chat application** built using **Node.js** and **MongoDB**. It allows users to communicate with each other in real-time, with user sessions managed securely.

## 🚀 Features
- User authentication and session management
- Real-time chat functionality
- Database integration with **MongoDB**
- RESTful API for managing users and messages
- Frontend integration with a client-side application

## 🏗️ Tech Stack
- **Backend:** Node.js, Express.js
- **Database:** MongoDB
- **Frontend:** JavaScript (Client-side)

## 📂 Directory Structure
```
📁 project-root/
├── 📁 client/              # Frontend files
├── 📄 Database.js         # Database connection and queries
├── 📄 initdb.mongo        # MongoDB initialization script
├── 📄 initUsers.mongo     # Predefined users for testing
├── 📁 node_modules/       # Dependencies (ignored in GitHub)
├── 📄 package.json        # Project dependencies and metadata
├── 📄 package-lock.json   # Dependency lock file
├── 📄 server.js           # Main server script
├── 📄 SessionManager.js   # User session management
└── 📄 .gitignore          # Ignored files (node_modules, logs, etc.)
```

## 📦 Installation & Setup
### 1️⃣ Clone the Repository

### 2️⃣ Install Dependencies
```sh
npm install
```

### 3️⃣ Setup MongoDB
Make sure MongoDB is installed and running on your local machine. You can initialize the database with:
```sh
mongo < initdb.mongo
mongo < initUsers.mongo
```

### 4️⃣ Run the Server
```sh
node server.js
```

## 🛠️ Usage
- Open `http://localhost:3000` in your browser.
- Register or log in to start chatting.
- The server handles user authentication and real-time message exchange.



