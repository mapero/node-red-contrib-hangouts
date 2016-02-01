# Edimax Smartplug for Node-RED
Easily integrate your edimax smartplug into your node-RED flow.
## Installation
Just install this plugin in your Node-RED folder by using npm:

```bash
npm install node-red-contrib-smartplug
```

Or if you have installed Node-RED globally use:

```bash
npm install -g node-red-contrib-smartplug
```

## Usage
This packages brings two nodes to your node-RED palette:

The input node polls the status of your Edimax Smartplug device and injects the result to your flow.

The output node lets you change the state of your Edimax Smartplug by sending **true** respectively **false** to the input. It is able to inject the new state to the flow as output.

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
