const crypto = require('crypto');

class SessionError extends Error {};

function SessionManager (){
	// default session length - you might want to
	// set this to something small during development
	const CookieMaxAgeMs = 600000;

	// keeping the session data inside a closure to keep them protected
	const sessions = {};

	// might be worth thinking about why we create these functions
	// as anonymous functions (per each instance) and not as prototype methods
	this.createSession = (response, username, maxAge = CookieMaxAgeMs) => {
		const token = crypto.randomBytes(16).toString('hex');

		if (maxAge) {
			console.log(maxAge);
		}
        
        sessions[token] = {
            username: username,
            createdAt: Date.now(),
            expiresAt: Date.now() + maxAge
        };

		response.cookie('cpen322-session', token, { 'maxAge': maxAge });

        console.log(`Set-Cookie header: cpen322-session=${token}; Max-Age=${maxAge};`);
		console.log("username: " + sessions[token].username);

        setTimeout(() => {
            console.log(`Deleting session for token: ${token}`);
            delete sessions[token];
        }, maxAge);

        return token;
	};

	this.deleteSession = function(request) {
		if (request.session && sessions[request.session]) {
			delete sessions[request.session];
			console.log(`Session for token: ${request.session} has been deleted`);
		}
		delete request.session;
		delete request.username;
	};

	this.middleware = (request, response, next) => {
		console.log(request.headers);
		const cookieHeader = request.headers.cookie;
		if (!cookieHeader) {
			console.log('No cookie found, skipping session validation.');
			next(new SessionError("No cookie header found."));
			return;
		}
	
		const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
			const [key, value] = cookie.split('=').map(c => c.trim());
			acc[key] = value;
			console.log(key);
			console.log(value);
			return acc;
		}, {});
	
		const token = cookies['cpen322-session'];
		if (!token || !(token in sessions)) {
			next(new SessionError("Invalid or missing session token."));
			return;
		}
	
		request.username = sessions[token].username;
		request.session = token;
		next();
	};

	this.isValidSession = (token) => {
        return token in sessions && sessions[token].expiresAt > Date.now();
	};

	// this function is used by the test script.
	// you can use it if you want.
	this.getUsername = (token) => ((token in sessions) ? sessions[token].username : null);

};

// SessionError class is available to other modules as "SessionManager.Error"
SessionManager.Error = SessionError;

module.exports = SessionManager;