var hangups = require("hangupsjs");
var tough = require('tough-cookie');
var Q = require("q");

module.exports = function(RED) {

	function HangoutsConfigNode(n) {
		RED.nodes.createNode(this,n);
		var node = this;
		node.token = n.token;

		node.cookiestore = new tough.MemoryCookieStore();

		if(node.credentials.cookiestore) {
			node.log("Loading cookies");
			tough.CookieJar.deserializeSync(node.credentials.cookiestore, node.cookiestore);
		}

		node.client = new hangups({jarstor: node.cookiejar});
		//node.client.loglevel('debug');

		var creds = function() {
			return {
				auth: function() {
					return Q().then(function() {
						return node.token;
					});
				}
			};
		};

		var reconnect = function() {
			node.client.connect(creds).then( function() {
				if (!node.credentials.cookiestore) {
					node.log("Writing cookies into credentials");
					var cookiejar = new tough.CookieJar(node.cookiestore);
					RED.nodes.addCredentials(node.id, {cookiestore: cookiejar.toJSON()} );
				}
				node.log("connected");
			});
		};

		node.client.on('connect_failed', function() {
			node.emit("status", {fill:"red",shape:"ring",text:"disconnected"});
			reconnect();
		});

		node.client.on('connected', function() {
			node.emit("status", {fill:"green",shape:"dot",text:"connected"});
		});

		node.client.on('connecting', function() {
			node.emit("status", {fill:"yellow",shape:"ring",text:"connecting ..."});
		});

		node.on("close", function(){
			node.client.removeAllListeners();
		});

		reconnect();
	}
	RED.nodes.registerType("hangouts-config", HangoutsConfigNode, {
		credentials: {
			cookiestore: {type: "password"}
		}
	});

	function HangoutsInNode(n) {
		RED.nodes.createNode(this,n);
		var node = this;
		node.config = RED.nodes.getNode(n.config);
		node.client = node.config.client;
		node.senders = n.senders;

		var status = function(status) {
			node.status(status);
		};
		node.config.on("status", status);

		// receive chat message events
		var chat_message = function(ev) {
			if(ev.sender_id.gaia_id === ev.self_event_state.user_id.gaia_id) {
				return;
			}
			node.send({
				topic: node.topic,
				payload: ev.chat_message.message_content.segment.map(function(segment) {
					return segment.text;
				}).join(),
				event: ev
			});
		};
		node.client.on('chat_message', chat_message);


		node.on("close", function(){
			node.config.removeListener("status", status);
			node.client.removeListener("chat_message", chat_message);
		});
	}
	RED.nodes.registerType("hangouts-in", HangoutsInNode);

		function HangoutsOutNode(n) {
			RED.nodes.createNode(this,n);
			var node = this;
			node.config = RED.nodes.getNode(n.config);
			node.client = node.config.client;
			node.recipes = n.recipes;

			var status = function(status) {
				node.status(status);
			};
			node.config.on("status", status);

			node.on("input", function(msg) {
				var users = msg.recipes || node.recipes.split(",");

				if(!Array.isArray(users)) {
					users = [users];
				}

				node.client.createconversation(users).then(
					function(result) {
						node.log(JSON.stringify(result));
						return node.client.sendchatmessage(result.conversation.id.id,[[0, msg.payload.toString()]]);
					})
					.then(function(result) {
						node.log(JSON.stringify(result));
					})
					.catch(function(error){
						node.error(error);
					})
					.done();
			});


			node.on("close", function(){
				node.config.removeListener("status", status);
			});
		}
		RED.nodes.registerType("hangouts-out", HangoutsOutNode);

};
