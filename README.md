# Update 0.1.6
The last update will bring refresh token and cookies out of sync and will result in authentication error. To fix this, you have to delete the configuration node and create a new one.

# Google Hangouts for Node-RED
Easily integrate google hangout messages into your node-RED flow.

## Installation
Use `npm install node-red-contrib-hangouts` to install.

## Usage
This package provides nodes to send and receive messages on Google Hangouts via Node-RED. The configuration node lets you setup your Google account.

The input node is used to receive messages from the hangouts network. You can use the senders field to filter incoming messages by sender. If the field is empty, all messages are accepted. You can use multiple contacts by separating them with a comma. Make sure to use valid and registered emails and make sure that both accounts have accepted the hangout invitation. The message contains the message in `msg.payload`, the contact information in `msg.sender` and the complete message event object in `msg.event`.

The output node is used to send messages to one or multiple contacts. You can use the recipients field or by providing a array to `msg.recipients` to define the recipients. If you have multiple contacts in one node, a group chat will be initialized. Use multiple nodes to create separated conversations. The `msg.payload` will be send to the contacts.

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
