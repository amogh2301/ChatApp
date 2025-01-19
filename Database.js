const { MongoClient, ObjectId } = require('mongodb');	// require the mongodb driver

/**
 * Uses mongodb v6.3 - [API Documentation](http://mongodb.github.io/node-mongodb-native/6.3/)
 * Database wraps a mongoDB connection to provide a higher-level abstraction layer
 * for manipulating the objects in our cpen322 app.
 */
function Database(mongoUrl, dbName){
	if (!(this instanceof Database)) return new Database(mongoUrl, dbName);
 	this.connected = new Promise((resolve, reject) => {
  		const client = new MongoClient(mongoUrl);

  		client.connect()
			.then(() => {
   				// Ping the dbName to ensure it exists
   				return client.db(dbName).command({ ping: 1 });
  			})
			.then(() => {
  	 			console.log('[MongoClient] Connected to ' + mongoUrl + '/' + dbName);
   				resolve(client.db(dbName));
  			})
  			.catch((err) => {
  	 			reject(err);
 		 	});
	});
 	this.status = () => this.connected.then(
  		db => ({ error: null, url: mongoUrl, db: dbName }),
  		err => ({ error: err })
 	);
}

Database.prototype.getRooms = function() {
    return this.connected.then(db =>
        new Promise((resolve, reject) => {
            const collection = db.collection('chatrooms');
            collection.find({}).toArray().then(rooms => {
                resolve(rooms);
            }).catch(error => {
                console.error('Error retrieving rooms:', error);
                reject(error);
            });
        })
    );
}

Database.prototype.getRoom = function(room_id){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			if (db) {
				resolve(db.collection('chatrooms').findOne({ _id: room_id }));
			} else {
				reject(err);
			}
		})
	)
}

Database.prototype.addRoom = function(room){
    return this.connected.then(db =>
        new Promise((resolve, reject) => {
			if (db) {
				if (!room.name) {
					reject(new Error('dne'));
				} else {
					if (!room._id) {
						room._id = new ObjectId().toString();
					}
					db.collection('chatrooms').insertOne(room);
					resolve(room);
				}
			} else {
				reject(err);
			}
        })
    );
};

Database.prototype.addConversation = function(conversation){
    if (!conversation.room_id || !conversation.timestamp || !conversation.messages) {
        return Promise.reject(new Error("Missing required fields in conversation object"));
    }

    return this.connected.then(db =>
        new Promise((resolve, reject) => {
            db.collection('conversations').insertOne(conversation)
            .then(result => {
                db.collection('conversations').findOne({ _id: result.insertedId })
                .then(newConversation => {
                    resolve(newConversation);
                }).catch(findError => {
                    reject(findError);
                });
            }).catch(insertError => {
                reject(insertError);
            });
        })
    );
};

Database.prototype.getLastConversation = function(room_id, before = Date.now()){
    return this.connected.then(db =>
        new Promise((resolve, reject) => {
            db.collection('conversations').find({ room_id: room_id, timestamp: { $lt: before } })
            .sort({ timestamp: -1 })
            .limit(1)
            .toArray()
            .then(result => {
                resolve(result[0] || null);
            }).catch(error => {
                reject(error);
            });
        })
    );
};

Database.prototype.getUser = function(username) {
    console.log(`getUser called with username: ${username}`);
    return this.connected.then(db => {
        console.log('Connected to database, querying for user');
        return db.collection('users').findOne({ username: username })
            .then(user => {
                console.log(`User found: ${user}`);
                return user;
            })
            .catch(err => {
                console.error('Error fetching user:', err);
                throw err;
            });
    });
};

module.exports = Database;