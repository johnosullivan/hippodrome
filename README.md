<img src="resources/hippodrome.png">

<b>hippodrome</b> is a simple lightweight game server for introductory game development. The game server includes authentication (via jwt), socket.io, and sessions delegator. The repository includes some dropin clients to interface with the server in popular languages like swift and java. hippodrome is perfect for 2D indie games running on the Android and iOS platforms. hippodrome manages the session players and their data. The client side (the game) is only responsible acting of certains events that fires from the server. These events included but do not excluded matchmaking started, match found, countdown, session start, and match overview. The backbone of the project is socket.io and express which handles the websocket events and http routes respectfully.    

## Requirements

- Node.js 
- MongoDB

## Installation 

```
git clone https://github.com/johnosullivan/hippodrome
cd hippodrome
npm install
```

Once the installation of hippodrome has been completed please ensure the configs of the server meet your dev environment. The ```configs.json``` is located in the root of the repo and looks like the following:

```
{
  "server": {
    "hostName": "localhost",
    "port": "8888"
  },
  "token": {
    "secret": "secretapplication",
    "expiresInSeconds": "2628000"
  },
  "database": {
    "address":"mongodb://localhost:27017/hippodrome"
  }
}
```

After the configuration have been completed run in the root with the following command: ```npm start ```.

## Client Interfaces

Please select the wiki you like to use for the client interfaces dropin. 

- <a href="https://github.com/johnosullivan/hippodrome/wiki/hippodrome---Swift">Swift (iOS/Mac/tvOS)</a>
- Java - Coming Soon!

## Contributing

Please read the <a>contribution guidelines</a> before starting work on a pull request.

Summary of the guidelines:

- One pull request per issue.
- Choose the right base branch.
- Include tests and documentation.
- Clean up "oops" commits before submitting.
- Follow the coding style guide.
