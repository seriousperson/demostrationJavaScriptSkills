// See Real-Time Servers II: File Servers for understanding 
// how we set up and use express
const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const mysql = require("mysql");
const db = require("./my_modules/db.js");

// We will use the dungeongenerator module to generate random dungeons
// Details at: https://www.npmjs.com/package/dungeongenerator
// Source at: https://github.com/nerox8664/dungeongenerator
const DungeonGenerator = require("dungeongenerator");

// We are going to serve our static pages from the public directory
// See Real-Time Servers II: File Servers for understanding
// how we set up and use express
app.use(express.static("public"));

/*  These variables store information about the dungeon that we will later
 *  send to clients. In particular:
 *  - the dungeonStart variable will store the x and y coordinates of the start point of the dungeon
 *  - the dungeonEnd variable will store the x and y coordinates of the end point of the dungeon
 *  - the dungeonOptions object contains four variables, which describe the default state of the dungeon:
 *  - - dungeon_width: the width of the dungeon (size in the x dimension)
 *  - - dungeon_height: the height of the dungeon (size in the y dimension)
 *  - - number_of_rooms: the approximate number of rooms to generate
 *  - - average_room_size: roughly how big the rooms will be (in terms of both height and width)
 *  - this object is passed to the dungeon constructor in the generateDungeon function
 */
let dungeon = {};
let dungeonStart = {};
let dungeonEnd = {};
const dungeonOptions = {
    dungeon_width: 25,
    dungeon_height: 25,
    number_of_rooms: 25,
    average_room_size: 5
};

/*
 * players is an object containing details about the game:
 * - counter: the number of players connected to the server.
 * - instance: array instanciating all players as ojects. (will)contain(s):
 * -- x: x coordinate of player in the maze.
 * -- y: y coordinate of player in the maze.
 * -- socketId: id of the player.
 * -- isMoving: moving state of the player. 
 * -- nextPicIndex: next picture to be drawn for animation 
 * -- isRightDirection: further determines which picture is to be displayed.
 */
let players = {
    counterId : 0,
    instance : [],
    count : 0
};

//holds connection to database
let conn

/*
 * timeStart: holds the time when the game started.
 * timeUp: holds the time when the ending point was reached.
*/
let timeStart;
let timeUp;

//time taken to finish the maze
let elapsed;





/*
 * The getDungeonData function packages up important information about a dungeon
 * into an object and prepares it for sending in a message. 
 *
 * The members of the returned object are as follows:
 *
 * - dungeon, an object, containing the following variables:
 * -- maze: a 2D array of integers, with the following numbers:
 * --- 0: wall
 * --- 1: corridor
 * --- 2+: numbered rooms, with 2 being the first room generated, 3 being the next, etc.
 * -- h: the height of the dungeon (y dimension)
 * -- w: the width of the dungeon (x dimension)
 * -- rooms: an array of objects describing the rooms in the dungeon, each object contains:
 * --- id: the integer representing this room in the dungeon (e.g. 2 for the first room)
 * --- h: the height of the room (y dimension)
 * --- w: the width of the room (x dimension)
 * --- x: the x coordinate of the top-left corner of the room
 * --- y: the y coordinate of the top-left corner of the room
 * --- cx: the x coordinate of the centre of the room
 * --- cy: the y coordinate of the centre of the room
 * -- roomSize: the average size of the rooms (as used when generating the dungeon)
 * -- _lastRoomId: the id of the next room to be generated (so _lastRoomId-1 is the last room in the dungeon)
 *
 * - startingPoint
 * -- x: the column at which players should start in the dungeon
 * -- y: the row at which players should start in the dungeon
 *
 * - endingPoint
 * -- x: the column where the goal space of the dungeon is located
 * -- y: the row where the goal space of the dungeon is located
 *
 * - players
 *
 */
function getDungeonData() {
    return {
        dungeon,
        startingPoint: dungeonStart,
        endingPoint: dungeonEnd
    };
}


/*
 * This function receives a socket as a parameter and 
 * creates a new player.
 */
function initialisePlayer(_socket){
    // Print an acknowledge to the server's console to confirm a player has connected
    console.log("A player has connected - sending dungeon data...");
    //increase player counter
    players.counterId +=1;
    players.count +=1;
    //add new player to players object
    players.instance.push({x: 0, y: 0, socketId: _socket.id, isMoving: false, nextPicIndex: 0, isRightDirection: true, id: players.counterId});
    //set initial player position
    setInitialPlayerPosition(dungeonStart.x, dungeonStart.y, players.instance[players.instance.length-1].socketId);
    //tell client to save id
    _socket.emit("newId", players.counterId);
}



/*
 * Cycle though all players. For every instance of the foor loop
 * send to the current player all players object without socket.id but 
 * they maintain their id.
 */
function sanitizeAndSendPlayers(){
    let copyOfPlayersObject = {instance: []};

    //for every palyer that has to receive a copy of players object
    players.instance.forEach(function (_this) {
        //remove every player's id that's not his own.
        copyOfPlayersObject.instance.push({x: _this.x, y: _this.y, isMoving: _this.isMoving, nextPicIndex: _this.nextPicIndex, isRightDirection: _this.isRightDirection, id: _this.id});
    }); 
    //now send the sanitized players object
    io.sockets.emit("getPlayers", copyOfPlayersObject);
}




/*
 * This is our event handler for a connection.
 * That is to say, any code written here executes when a client makes a connection to the server
 * (i.e. when the page is loaded)
 * 
 * See Real-Time Servers III: socket.io and Messaging for help understanding how
 * we set up and use socket.io
 */
io.on("connection", function (socket) {
    //create a new player.
    initialisePlayer(socket);
    /*
     * Here we send all information about a dungeon to the client that has just connected
     * For full details about the data being sent, check the getDungeonData method
     * This message triggers the socket.on("dungeon data"... event handler in the client
     */
    sendDungeonToClients(true);
    //listen for disconnections
    disconnectUser(socket);
    //listen for coordinates to be updated
    updateCoordinates(socket);
    //the the array of players to all players
    sanitizeAndSendPlayers();
});




/* Listen for disconnections.
 * Remove "instances of players who disconnected from the server. 
 * This function will loop through the array
 * containing the players till it finds the one that disconnected,
 * removes it and updates all players of the change
*/
function disconnectUser(_socket){
    _socket.on("disconnect", function () {
        players.instance.forEach(function (_this, index) {
            if(_this.socketId == _socket.id){
                //remove player
                players.instance.splice(index, 1);
                //adjust counter
                players.count--;
                //update players
                io.sockets.emit("removedPlayers", index);
            }
        });
    });
}




/*
 * if player is exactly positioned on the same x/y axes as the 
 * ending point in the last room(i.e on top of it), 
 * then generate a new dungeon, send it to all clients and update database. 
 * Otherwise just update players about each other's coordinates
 */
function updateCoordinates(_socket){
    _socket.on("newCoordinates", function (player){
        //update player's position in the server
        players.instance.forEach(function (_this){
            if(_this.socketId == _socket.id){
                let canMove = getNextSpaceType(_this.x, _this.y);
                switch(player.move){
                    case "right":
                        if(canMove.right){
                            _this.x += 1;
                            _this.isRightDirection = true;
                        }
                        break;
                    case "left":
                        if(canMove.left){
                            _this.x -= 1;
                            _this.isRightDirection = false;
                        }
                        break;
                    case "up":
                        if(canMove.up)
                            _this.y -= 1;
                            break;
                    case "down":
                        if(canMove.down)
                            _this.y += 1;
                            break;
                }
                //character is moving
                _this.isMoving = true;

                //check if player reached the ending point
                if(_this.x >= dungeonEnd.x && _this.x <= dungeonEnd.x
                && _this.y >= dungeonEnd.y && _this.y <= dungeonEnd.y){
        
                    timeUp = Date.now();
                    elapsed = timeUp - timeStart;
                    //milliseconds to seconds
                    elapsed = elapsed/1000;
                    //save details of the game in the database.
                    db.saveDetails({connection: conn, duration: elapsed, playerscount: players.count});
                    generateDungeon();
                    sendDungeonToClients(false);
                }else {
                    //update players of new player's coordinates
                    io.sockets.emit("updatePlayers", {x: _this.x, y: _this.y, isMoving: _this.isMoving, nextPicIndex: _this.nextPicIndex, isRightDirection: _this.isRightDirection, id: _this.id}); 
                }
            }
        });
    }); 
}



/*
 * The getNextSpaceType function takes an x, y coordinate within the dungeon and
 * determines if player can move up, down, right or left.
 */
function getNextSpaceType(x, y){

    let returnObject = {
        up : false,
        down : false,
        left : false,
        right : false
    };
    
    // check for out of bounds (i.e. this move would move the player off the edge,
    // which also saves us from checking out of bounds of the array) and, if not
    // out of bounds, check if the space can be moved to (i.e. contains a corridor/room)
    if (x - 1 >= 0 && dungeon.maze[y][x - 1] > 0) {
        returnObject.left = true;
    }
    if (x + 1 < dungeon.w && dungeon.maze[y][x + 1] > 0) {
        returnObject.right = true;
    }
    if (y - 1 >= 0 && dungeon.maze[y - 1][x] > 0) {
        returnObject.up = true;
    }
    if (y + 1 < dungeon.h && dungeon.maze[y + 1][x] > 0) {
        returnObject.down = true;
    }
    
    return returnObject;
}


/*
 * this function resets all users' coordinates to the center of the first room when 
 * someone reaches the ending point and sends to all of them a new dungeon,
 * or just to the one client if this is its first connection.
 *
 * setInitialPlayerPosition(boolean)
 * param: true: a user has conneted. Just send the already generated dungeon.
 * param: false: its not a new connection but a player reached the end of the maze. 
 * reset every player's coordinates, start timer and send a new dungeon.
*/
function sendDungeonToClients(isConnection){
    //set players positions if not a new connection
    if(!isConnection){
        players.instance.forEach(function (_this) {
            _this.x = dungeonStart.x;
            _this.y = dungeonStart.y;
        });

        //start taking the time.
        timeStart = Date.now();
    }
    io.sockets.emit("dungeon data", getDungeonData());
    sanitizeAndSendPlayers();
}





/*
 * This function locates a specific room, based on a given index, and retrieves the
 * centre point, and returns this as an object with an x and y variable.
 * For example, this method given the integer 2, would return an object
 * with an x and y indicating the centre point of the room with an id of 2.
 */
function getCenterPositionOfSpecificRoom(roomIndex) {
    let position = {
        x: 0,
        y: 0
    };

    for (let i = 0; i < dungeon.rooms.length; i++) {
        let room = dungeon.rooms[i];
        if (room.id === roomIndex) {
            position.x = room.cx;
            position.y = room.cy;
            return position;
        }
    }
    return position;
}





/*
 * The generateDungeon function uses the dungeongenerator module to create a random dungeon,
 * which is stored in the 'dungeon' variable.
 *
 * Additionally, we find a start point (this is always the centre point of the first generated room)
 * and an end point is located (this is always the centre point of the last generated room).
 */
function generateDungeon() {
    dungeon = new DungeonGenerator(
        dungeonOptions.dungeon_height,
        dungeonOptions.dungeon_width,
        dungeonOptions.number_of_rooms,
        dungeonOptions.average_room_size
    );
    console.log(dungeon);
    dungeonStart = getCenterPositionOfSpecificRoom(2);
    dungeonEnd = getCenterPositionOfSpecificRoom(dungeon._lastRoomId - 1);
}





//set initial player's position to the center of the first of the maze
function setInitialPlayerPosition(x, y, id){
    players.instance.forEach(function (_this) {
        if(_this.socketId == id){
            _this.x = x;
            _this.y = y;
        }
    });
}



/*
 * Start the server, listening on port 8081.
 * Once the server has started, output confirmation to the server's console.
 * After initial startup, generate a dungeon, ready for the first time a client connects.
 *
 */
//--------NOTE: Database settings were tested on a XAMPP mysql server
server.listen(8081, function () {
    let con;
    console.log("Dungeon server has started - connect to http://localhost:8081");
    generateDungeon();
    console.log("Initial dungeon generated!");

    //Set up database
    con = mysql.createConnection(db.credentials());
    //create databse;
    db.createDB(con);
    //stop everything and give mysql time to finish its job.
    setTimeout(function (){
        conn = mysql.createConnection(db.selectdb());
        //create tables.
        db.createTable(conn);
        timeStart = Date.now();
    }, 3000);
 });
