## Installation

### Install dependencies

```bash
cd frontend
npm install
```

### Install and connect the Roomba integration

You'll need your Roomba's IP address for this.

Find your Roomba's BLID and password:

```bash
npm install -g dorita980
get-roomba-password <robotIP>
```

* In Home Assistant, go to Configuration -> Integrations
* Find the Roomba/Braava integration and add it.
* You will be prompted for Host and BLID. Enter the Roomba's IP address for the host and paste the BLID.
* You may be prompted for a password - if so, paste it.

## Development

```bash
# Compile TS once
npm run compile

# Watch the TS files for changes and recompile
npm run watch

# Serve the app in another shell (http://localhost:3000)
npm run serve
```