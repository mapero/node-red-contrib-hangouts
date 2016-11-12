[![Join the chat at https://gitter.im/mapero/node-red-contrib-hangouts](https://badges.gitter.im/mapero/node-red-contrib-hangouts.svg)](https://gitter.im/mapero/node-red-contrib-hangouts?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

# Update 0.1.12
Another breaking change, sorry for this. Since the create conversation and filter by sender is not working properly it was removed from the node. Instead on input and output the conversation id is used. To get all valid conversation ids, the config node will output all available conversations including the participants on connect. Use one of these to filter incoming messages and filter outgoing messages.

I will check in the future, how to simplify this.

# Google Hangouts for Node-RED
Easily integrate google hangout messages into your node-RED flow.

## Installation
Use `npm install node-red-contrib-hangouts` to install.

## Usage
This package provides nodes to send and receive messages on Google Hangouts via Node-RED. The configuration node lets you setup your Google account.

The input node is used to receive messages from the hangouts network. You can use the conversation id to filter incoming messages by conversation. If the field is empty, all messages are accepted. Make sure to use a valid conversation id. Since the node will also receive messages send from the account, you can suppress this messages over the checkbox. The message contains the message in `msg.payload`, the conversation id in `msg.conversationId` and the complete message event object in `msg.event`.

The output node is used to send messages to an existing conversation. You can use the conversation id on the properties or provide a valid conversation id in `msg.conversationId`. The `msg.payload` will be send to the contacts.

## Contributing
1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

## History

## Credits
Jochen Scheib
Tommy Jonsson

## License
MIT
