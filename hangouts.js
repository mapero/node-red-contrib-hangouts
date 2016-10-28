var hangups = require("hangupsjs"),
		tough = require('tough-cookie'),
		Q = require("q"),
		homeDir = require("home-dir"),
		fs = require("fs");

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

	//Create directory for refresh tokens
	mkdirSync(homeDir('/.node-red-contrib-hangouts'));

	RED.httpAdmin.get('/hangouts/conversations', function(req, res, next) {
		var id = req.query.id;
		var node = RED.nodes.getNode(id);
		if (node && node.contacts) {
			res.end(JSON.stringify(node.conversations));
		} else {
			res.end("[]");
		}
	});

	function HangoutsConfigNode(n) {
		RED.nodes.createNode(this,n);
		var node = this;
		node.gaia_id = "";
		node.contacts = [];
		node.conversations = [];
		node.isConnected = false;
		node.status = {fill:"yellow",shape:"ring",text:"connecting ..."};
		node.refreshtoken = homeDir('/.node-red-contrib-hangouts/'+node.id+'.txt');

		if(node.credentials.cookiejar) {
			node.log("Loading cookies");
			node.cookiejar = tough.CookieJar.deserializeSync(node.credentials.cookiejar);
		} else {
			node.cookiejar = new tough.CookieJar();
		}

		node.client = new hangups({
			jarstore: node.cookiejar.store,
			rtokenpath: node.refreshtoken
		});
		if(n.debug) node.client.loglevel('debug');

		function updateConversations() {
			node.client.init.conv_states.forEach(function(conversation) {
				node.conversations.push({
					id: conversation.conversation.conversation_id.id,
					name: conversation.conversation.name,
					participants: conversation.conversation.participant_data.map(function(participant) {
						return participant.fallback_name;
					})
				});
			});
			node.warn(JSON.stringify(node.conversations));
		}

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
				if (!node.credentials.cookiejar) {
					node.log("Writing cookies into credentials");
					RED.nodes.addCredentials(node.id, {cookiejar: node.cookiejar.toJSON()} );
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
			updateConversations();
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
			cookiejar: {type: "password"}
		}
	});

	function HangoutsInNode(n) {
		RED.nodes.createNode(this,n);
		var node = this;
		node.suppress = n.suppress;
		node.conversationId = n.conversationId;

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

		// receive chat message events
		var chat_message = function(ev) {

			if(node.suppress && ev.sender_id.gaia_id === ev.self_event_state.user_id.gaia_id) {
				node.log("Ignored own message.");
				return;
			}

			if(!node.conversationId || node.conversationId === ev.conversation_id.id) {
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
		node.conversationId = n.conversationId;

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
			if(!node.config.isConnected) {
				node.error("Client not connected.");
			}

			var conversationId = msg.conversationId ? msg.conversationId : node.conversationId;
			if(!conversationId) {
				node.error("No conversation id provided.");
			}

			var bld = new hangups.MessageBuilder();
			bld.text(msg.payload.toString());

			(msg.links || []).forEach(function(link) {
				bld.linebreak().link(link, link);
			});
			var img = msg.image && node.client.uploadimage(msg.image, "image.jpg") || Promise.resolve(null);
			img.then(function(imageId) {
				return node.client.sendchatmessage(conversationId, bld.toSegments(), imageId);
			}).then(function(result) {
				node.log("Message successfully send.");
			}).catch(function(error) {
				node.error(error);
			}).done();

			node.on("close", function(){
				node.config.removeListener("status", node.refreshStatus);
			});
		});
	}
	RED.nodes.registerType("hangouts-out", HangoutsOutNode);

};
