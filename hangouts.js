var hangups = require("hangupsjs");
var tough = require('tough-cookie');
var Q = require("q");
var homeDir = require("home-dir");
var fs = require("fs");

function map(arr, func) {
	return Q().then(function() {
		return arr.map(function(el) {return func(el);});
	}).all();
}

function mkdirSync(path) {
	try {
		fs.mkdirSync(path);
	} catch(e) {
		if ( e.code != 'EEXIST' ) throw e;
	}
}

module.exports = function(RED) {

	function HangoutsConfigNode(n) {
		RED.nodes.createNode(this,n);
		var node = this;
		node.gaia_id = "";
		node.contacts = [];
		node.isConnected = false;
		node.status = {fill:"yellow",shape:"ring",text:"connecting ..."};
		node.refreshtoken = homeDir('/.node-red-contrib-hangouts/'+node.id+'.txt');

		mkdirSync(homeDir('/.node-red-contrib-hangouts'));

		node.cookiestore = new tough.MemoryCookieStore();

		if(node.credentials.cookiestore) {
			node.log("Loading cookies");
			tough.CookieJar.deserializeSync(node.credentials.cookiestore, node.cookiestore);
		}

		node.client = new hangups({
			jarstore: node.cookiestore,
			rtokenpath: node.refreshtoken
		});
		if(n.debug) node.client.loglevel('debug');


		function updateContacts() {
			node.gaia_id = node.client.init.self_entity.id.gaia_id;
			node.log("Your gaia_id is: "+node.gaia_id);
			node.client.init.conv_states.forEach(function(conv){
				conv.conversation.participant_data.forEach(function(participant) {
					if(participant.id.gaia_id != node.gaia_id) {
						node.client.getentitybyid([participant.id.gaia_id]).then(function(entity) {
							node.contacts.push({
								fallback_name: participant.fallback_name,
								id: participant.id.gaia_id,
								emails: entity.entities[0].properties.emails
							});
							node.log(JSON.stringify({fallback_name: participant.fallback_name,
								id: participant.id.gaia_id,
								emails: entity.entities[0].properties.emails
							}));
						}).done();
					}
				});
			});
		}

		node.getContactId = function(request) {
			if(!isNaN(request)) {
				return request;
			} else {
				var contact = node.contacts.find(function(contact) {
					if(/^[a-z0-9_\-\.]{2,}@[a-z0-9_\-\.]{2,}\.[a-z]{2,}$/i.test(request)) {
						if (contact.emails.indexOf(request) > -1) return true;
					} else {
						if (request === contact.fallback_name) return true;
					}
				});
				if(contact) return contact.id;
			}
		};

		//node.client.loglevel('debug');

		var creds = function() {
			return {
				auth: function() {
					return Q().then(function() {
						return node.credentials.token;
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
			node.warn("Connection lost, reconnecting ...");
			node.status = {fill:"red",shape:"ring",text:"disconnected"};
			node.emit("status", node.status);
			node.isConnected = false;
			node.timeout = setTimeout(reconnect, 5000);
		});

		node.client.on('connected', function() {
			node.status = {fill:"green",shape:"dot",text:"connected"};
			node.emit("status", node.status);
			node.isConnected = true;
			updateContacts();
		});

		node.client.on('connecting', function() {
			node.status = {fill:"yellow",shape:"ring",text:"connecting ..."};
			node.emit("status", node.status);
			node.isConnected = false;
		});

		node.on("close", function(){
			node.client.removeAllListeners();
			if (node.timeout) clearTimeout(node.timeout);
		});

		reconnect();
	}
	RED.nodes.registerType("hangouts-config", HangoutsConfigNode, {
		credentials: {
			token: {type: "text"},
			cookiestore: {type: "password"}
		}
	});

	function HangoutsInNode(n) {
		RED.nodes.createNode(this,n);
		var node = this;
		node.suppress = n.suppress;

		node.config = RED.nodes.getNode(n.config);
		if(!node.config) {
			node.error("Config node missing");
			node.status({fill:"red",shape:"ring",text:"Error: Config node missing"});
			return;
		}
		node.client = node.config.client;


		if(n.senders) {
			node.senders = n.senders.split(",");
		} else {
			node.senders = [];
		}

		node.status(node.config.status);
		node.refreshStatus = function(status) {
			node.status(status);
		};
		node.config.on("status", node.refreshStatus);

		// receive chat message events
		var chat_message = function(ev) {

			if(node.suppress && ev.sender_id.gaia_id === ev.self_event_state.user_id.gaia_id) {
				return;
			}

			var senderIds = node.senders.map(node.config.getContactId);

			if(senderIds.length === 0 || senderIds.indexOf(ev.sender_id.gaia_id) > -1) {
				node.send({
					topic: node.topic,
					payload: ev.chat_message.message_content.segment.map(function(segment) {
						return segment.text;
					}).join(),
					event: ev,
					conversationId: ev.conversation_id.id
				});
			}

		};
		node.client.on('chat_message', chat_message);


		node.on("close", function(){
			node.config.removeListener("status", node.refreshStatus);
			node.client.removeListener("chat_message", chat_message);
		});
	}
	RED.nodes.registerType("hangouts-in", HangoutsInNode);

	function HangoutsOutNode(n) {
		RED.nodes.createNode(this,n);
		var node = this;
		node.recipients = n.recipients;

		node.config = RED.nodes.getNode(n.config);
		if(!node.config) {
			node.error("Config node missing");
			node.status({fill:"red",shape:"ring",text:"Error: Config node missing"});
			return;
		}
		node.client = node.config.client;


		node.status(node.config.status);
		node.refreshStatus = function(status) {
			node.status(status);
		};
		node.config.on("status", node.refreshStatus);


		node.on("input", function(msg) {
			if(!node.config.isConnected) return;

			var users = msg.recipients || node.recipients.split(",");

			if(!Array.isArray(users)) {
				users = [users];
			}

			if (msg.conversationId) {
				node.client.sendchatmessage(msg.conversationId,[[0, msg.payload.toString()]]).then(function(result) {
					node.log("Message successfully send.");
				}).catch(function(error) {
					node.error(error);
				}).done();
			} else {
				map(users, node.config.getContactId).then(function(results) {
					return node.client.createconversation(results);
				}).then(function(result) {
					if(result.conversation) {
						return node.client.sendchatmessage(result.conversation.id.id,[[0, msg.payload.toString()]]);
					} else {
						throw new Error("Can not create conversation. This is usually the case when you provide wrong recipients.");
					}
				}).then(function(result) {
					node.log("Message successfully send.");
				}).catch(function(error) {
					node.log(error);
				}).done();
			}

			node.on("close", function(){
				node.config.removeListener("status", node.refreshStatus);
			});
		});
	}
	RED.nodes.registerType("hangouts-out", HangoutsOutNode);

};
