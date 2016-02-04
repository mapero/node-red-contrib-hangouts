var hangups = require("hangupsjs");
var tough = require('tough-cookie');
var Q = require("q");

function map(arr, func) {
	return Q().then(function() {
		return arr.map(function(el) {return func(el);});
	}).all();
}

module.exports = function(RED) {

	function HangoutsConfigNode(n) {
		RED.nodes.createNode(this,n);
		var node = this;
		node.token = n.token;
		node.contacts = {};
		node.isConnected = false;

		node.cookiestore = new tough.MemoryCookieStore();

		if(node.credentials.cookiestore) {
			node.log("Loading cookies");
			tough.CookieJar.deserializeSync(node.credentials.cookiestore, node.cookiestore);
		}

		node.client = new hangups({jarstor: node.cookiejar});

		node.getId = function (user) {

			if(node.contacts[user]) return node.contacts[user];

			var promise = node.client.searchentities(user, 1);

			promise.then(function(result) {
				node.contacts[user] = result;
			});
			return promise;
		};

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
			node.isConnected = false;
			reconnect();
		});

		node.client.on('connected', function() {
			node.emit("status", {fill:"green",shape:"dot",text:"connected"});
			node.isConnected = true;
		});

		node.client.on('connecting', function() {
			node.emit("status", {fill:"yellow",shape:"ring",text:"connecting ..."});
			node.isConnected = false;
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
		node.senders = n.senders.split(",");

		function updateSenderIds() {
			if (node.senders.length > 0) {
				node.log("Update SenderIds");
				map(node.senders, node.config.getId).then(function(results) {
					node.senderIds = results.map(function(result,index){
						if(result.entity) {
							node.log("Found id for contact "+node.senders[index]+": "+result.entity[0].id.gaia_id);
							return result.entity[0].id.gaia_id;
						} else {
							node.error("Cannot resolve gaia_id from contact: "+node.senders[index]);
						}
					});
				}).done();
			} else {
				node.senderIds = [];
			}
		}
		node.client.on("connected", updateSenderIds);

		if(node.config.isConnected) {
			updateSenderIds();
		}

		var status = function(status) {
			node.status(status);
		};
		node.config.on("status", status);

		// receive chat message events
		var chat_message = function(ev) {

			if(node.senderIds === undefined) {
				return;
			}
			else if (node.senderIds > 0 && node.senderIds.indexOf(ev.sender_id.gaia_id) == -1) {
				return;
			}
			else {
				node.client.getentitybyid([ev.sender_id.gaia_id]).then(function(result) {
					node.log(JSON.stringify(result));
					node.send({
						topic: node.topic,
						payload: ev.chat_message.message_content.segment.map(function(segment) {
							return segment.text;
						}).join(),
						event: ev,
						sender: result.entities[0]
					});
				}, function(error) {
					node.error(error);
				});
			}

		};
		node.client.on('chat_message', chat_message);


		node.on("close", function(){
			node.config.removeListener("status", status);
			node.client.removeListener("connected", updateSenderIds);
			node.client.removeListener("chat_message", chat_message);
		});
	}
	RED.nodes.registerType("hangouts-in", HangoutsInNode);

	function HangoutsOutNode(n) {
		RED.nodes.createNode(this,n);
		var node = this;
		node.config = RED.nodes.getNode(n.config);
		node.client = node.config.client;
		node.recipients = n.recipients;

		var status = function(status) {
			node.status(status);
		};
		node.config.on("status", status);

		node.on("input", function(msg) {
			if(!node.config.isConnected) return;

			var users = msg.recipients || node.recipients.split(",");

			if(!Array.isArray(users)) {
				users = [users];
			}

			var userIds = [];


			map(users, node.config.getId).then(function(results) {
				return node.client.createconversation(results.map(function(result, index){
					if(result.entity) {
						return result.entity[0].id.gaia_id;
					} else {
						throw new Error("Cannot resolve gaia_id from contact: "+users[index]);
					}
				}));
			})
			.then(
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
