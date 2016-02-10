# Update 0.1.6
The last update will bring refresh token and cookies out of sync and will result in authentication error. To fix this, you have to delete the configuration node and create a new one.

# Google Hangouts for Node-RED
Easily integrate google hangout messages into your node-RED flow.

## Installation
Use `npm install node-red-contrib-hangouts` to install.

## Usage
This package provides nodes to send and receive messages on Google Hangouts via Node-RED. The configuration node lets you setup your Google account.

The input node is used to receive messages from the hangouts network. You can use the senders field to filter incoming messages by sender. If the field is empty, all messages are accepted. Since the node will also receive messages send from the account, you can suppress this messages over the checkbox. You can use multiple contacts by separating them with a comma. You can use the gaia_id, email address or the fallback_name in the senders field. The message contains the message in `msg.payload`, the conversation id in `msg.conversationId` and the complete message event object in `msg.event`.

The output node is used to send messages to one or multiple contacts. You can use the recipients field or by providing a array to `msg.recipients` which includes the recipients. If you have multiple contacts in one node, a group chat will be initialized. Use multiple nodes to create separated conversations. The `msg.payload` will be send to the contacts. If the incoming message includes a conversation id in `msg.conversationId` it will be used to send the message to, `msg.recipients` and the recipients field will be ignored in this case.

## Contributing
1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

## History

## Credits
Jochen Scheib

## License
MIT
