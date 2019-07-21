SET UP:
1. Stop any mysql server running on your system.
2. Turn on mysql server from xampp manager.
 2.1: if required change the database configuarations in the file 1CWK50JS/my_modules/db.js. 
      You can find the database settings in the object
		config = {
    			host: "127.0.0.1",
    			user: "root",
    			password: "",
    			port: "3306",
    			database: ""
		} 
3. install these reuqired modules from your npm manager:
    express, http-server, socket.io, mysql .

4. move into 1CWK50JS directory and run the command "node DungeonServer".

5. Open a web browser and navigate to localhost:8081
  5.1. if your browser window is resized at a width less than 1080 pixels the game will detect your device
     as a mobile phone.


HOW TO PLAY THE GAME:
use mouse clicks, taps(if in mobile phone) and keyboard arrows to move around.
     
