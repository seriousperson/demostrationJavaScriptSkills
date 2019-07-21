/*
 * These three variables hold information about the dungeon, received from the server
 * via the "dungeon data" message. Until the first message is received, they are
 * initialised to empty objects.
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
 * - dungeonStart
 * -- x, the row at which players should start in the dungeon
 * -- y, the column at which players should start in the dungeon
 *
 * - dungeonEnd
 * -- x, the row where the goal space of the dungeon is located
 * -- y, the column where the goal space of the dungeon  is located
 */
let dungeon = {};
let dungeonStart = {};
let dungeonEnd = {};
let players = {}
let playerId;
// load a spritesheet (dungeon_tiles.png) which holds the tiles
// we will use to draw the dungeon
// Art by MrBeast. Commissioned by OpenGameArt.org (http://opengameart.org)
const tilesImage = new Image();
tilesImage.src = "dungeon_tiles.png";
//load pictures that will be used to animate characters
const character = [];
character[0] = new Image ();
character[1] = new Image ();
character[2] = new Image ();
character[3] = new Image ();
character[4] = new Image ();
character[5] = new Image ();
character[6] = new Image ();
character[7] = new Image ();
character[0].src = "pics/right1.png";
character[1].src = "pics/right2.png";
character[2].src = "pics/right3.png";
character[3].src = "pics/left1.png";
character[4].src = "pics/left2.png";
character[5].src = "pics/left3.png";
character[6].src = "pics/rest1.png";
character[7].src = "pics/rest2.png";
//load image that is usesd to uniquely identify player in its own client.
const identifier = new Image();
identifier.src = "pics/playerIdentifier.png";




/* 
 * Establish a connection to our server
 * We will need to reuse the 'socket' variable to both send messages
 * and receive them, by way of adding event handlers for the various
 * messages we expect to receive
 *
 * Replace localhost with a specific URL or IP address if testing
 * across multiple computers
 *
 * See Real-Time Servers III: socket.io and Messaging for help understanding how
 * we set up and use socket.io
 */
const socket = io.connect("http://localhost:8081");

function socketOn(){

   /*
    * This is the event handler for the 'dungeon data' message
    * When a 'dungeon data' message is received from the server, this block of code executes
    * 
    * The server is sending us either initial information about a dungeon, or,
    * updated information about a dungeon, and so we want to replace our existing
    * dungeon variables with the new information.
    *
    * We know the specification of the information we receive (from the documentation
    * and design of the server), and use this to help write this handler.
    */
    socket.on("dungeon data", function (data) {
        dungeon = data.dungeon;
        dungeonStart = data.startingPoint;
        dungeonEnd = data.endingPoint;
    });

    socket.on("getPlayers", function (data){
        players = data;
    });
   
   /*
    * This is the event handler that will remove disconnected users from the object players.
    */
    socket.on("removedPlayers", function(index){
        players.instance.splice(index, 1);
        players.counter-=1;
    });

   /*
    * This is the event handler that will replace old players's coordinates with new ones.
    */
    socket.on("updatePlayers", function (data) {
        players.instance.forEach(function (_this){
            if(_this.id == data.id){
                _this.x = data.x;
                _this.y = data.y;
                _this.isMoving = data.isMoving;
                _this.isRightDirection = data.isRightDirection;
            }
        });
    });
    
    
   /*
    * set player's id
    */
    socket.on("newId", function (data){
       playerId = data;
    });

}




/*
 * The identifySpaceType function takes an x, y coordinate within the dungeon and identifies
 * which type of tile needs to be drawn, based on which directions it is possible
 * to move to from this space. For example, a tile from which a player can move up
 * or right from needs to have walls on the bottom and left.
 *
 * Once a tile type has been identified, the necessary details to draw this
 * tile are returned from this method. Those details specifically are:
 * - tilesetX: the x coordinate, in pixels, within the spritesheet (dungeon_tiles.png) of the top left of the tile
 * - tilesetY: the y coordinate, in pixels, within the spritesheet (dungeon_tiles.png) of the top left of the tile
 * - tilesizeX: the width of the tile
 * - tilesizeY: the height of the tile
 */

function identifySpaceType(x, y) {
    let returnObject = {
        spaceType: "",
        tilesetX: 0,
        tilesetY: 0,
        tilesizeX: 16,
        tilesizeY: 16,
    };

    let canMoveUp = false;
    let canMoveLeft = false;
    let canMoveRight = false;
    let canMoveDown = false;

    // check for out of bounds (i.e. this move would move the player off the edge,
    // which also saves us from checking out of bounds of the array) and, if not
    // out of bounds, check if the space can be moved to (i.e. contains a corridor/room)
    if (x - 1 >= 0 && dungeon.maze[y][x - 1] > 0) {
        canMoveLeft = true;
    }
    if (x + 1 < dungeon.w && dungeon.maze[y][x + 1] > 0) {
        canMoveRight = true;
    }
    if (y - 1 >= 0 && dungeon.maze[y - 1][x] > 0) {
        canMoveUp = true;
    }
    if (y + 1 < dungeon.h && dungeon.maze[y + 1][x] > 0) {
        canMoveDown = true;
    }

    if (canMoveUp && canMoveRight && canMoveDown && canMoveLeft) {
        returnObject.spaceType = "all_exits";
        returnObject.tilesetX = 16;
        returnObject.tilesetY = 16;
    }
    else if (canMoveUp && canMoveRight && canMoveDown) {
        returnObject.spaceType = "left_wall";
        returnObject.tilesetX = 0;
        returnObject.tilesetY = 16;
    }
    else if (canMoveRight && canMoveDown && canMoveLeft) {
        returnObject.spaceType = "up_wall";
        returnObject.tilesetX = 16;
        returnObject.tilesetY = 0;
    }
    else if (canMoveDown && canMoveLeft && canMoveUp) {
        returnObject.spaceType = "right_wall";
        returnObject.tilesetX = 32;
        returnObject.tilesetY = 16;
    }
    else if (canMoveLeft && canMoveUp && canMoveRight) {
        returnObject.spaceType = "down_wall";
        returnObject.tilesetX = 16;
        returnObject.tilesetY = 32;
    }
    else if (canMoveUp && canMoveDown) {
        returnObject.spaceType = "vertical_corridor";
        returnObject.tilesetX = 144;
        returnObject.tilesetY = 16;
    }
    else if (canMoveLeft && canMoveRight) {
        returnObject.spaceType = "horizontal_corridor";
        returnObject.tilesetX = 112;
        returnObject.tilesetY = 32;
    }
    else if (canMoveUp && canMoveLeft) {
        returnObject.spaceType = "bottom_right";
        returnObject.tilesetX = 32;
        returnObject.tilesetY = 32;
    }
    else if (canMoveUp && canMoveRight) {
        returnObject.spaceType = "bottom_left";
        returnObject.tilesetX = 0;
        returnObject.tilesetY = 32;
    }
    else if (canMoveDown && canMoveLeft) {
        returnObject.spaceType = "top_right";
        returnObject.tilesetX = 32;
        returnObject.tilesetY = 0;
    }
    else if (canMoveDown && canMoveRight) {
        returnObject.spaceType = "top_left";
        returnObject.tilesetX = 0;
        returnObject.tilesetY = 0;
    }

    return returnObject;
}

/*
 * Once our page is fully loaded and ready, we call startAnimating
 * to kick off our animation loop.
 * We pass in a value - our fps - to control the speed of our animation.
 */
$(document).ready(function () {
    let isPhone;
    
   /*
    * style buttons for small screens
    *
    *
    * ----- Only android support ------
    */
    if(window.ontouchstart!==undefined){
        isPhone = true;   
        $("input").css("width", "10%");
        $("input").css("background", "none");
        $("div#btnctrls").css("margin-left", "0");
        $("div#btnctrls").css("width", "98%");
        $("div#btnctrls").css("margin-top", "15%")
        $("input#rightbtn").css("height", "100px");
        $("input#rightbtn").css("position", "absolute");
        $("input#rightbtn").css("margin-left", "85%");
        $("input#rightbtn").css("margin-top", "-89px");
        $("input#leftbtn").css("height", "100px");
        $("input#leftbtn").css("margin-left", "70%");
        $("input#upbtn").css("height", "100px");
        $("input#dwnbtn").css("height", "100px");
        alert("USE THE TRANSPARENT SQUARES TO MOVE AOUND. and change your screen's orientation to landscape for a better user experience");
    }else{
        isPhone = false;
    }
    
    //hide "loading" message
    $.mobile.loading().hide();
    //listen for events
    socketOn();
    //listen for input events
    listenForEvents(isPhone);
    //start animating the game
    startAnimating(60);
});





let direction;

/*
 * This function listens for inputs from a player.
 */
function listenForEvents(isMobile)
{
    if(!isMobile){
        //listen for mouse events
        $("input").mousedown(function () {
            setDirection(this);
        });
    }
    else{
        //listen for tap events
        $("input").on("tap", function (event) {
            event.preventDefault();
            setDirection(this);
        });
    }


    //keyboard events
    $("body").off().keydown(function (event){
        if(event.key == "ArrowRight" || event.key == "ArrowLeft" || 
            event.key == "ArrowUp" || event.key == "ArrowDown"){
            event.preventDefault();
            switch(event.key){
                case "ArrowRight":
                    direction = "right";
                    break;
                case "ArrowLeft":
                    direction = "left";
                    break;
                case "ArrowUp":
                    direction = "up";
                    break;
                case "ArrowDown":
                    direction = "down";
                    break;
                default:
                    break;
            }
            handleAction();
        }
    });
}


//get the direction to which a user wants to move into
function setDirection(_this){

    switch($(_this).attr('name')){
        case "right":
            direction = "right";
            break;
        case "left":
            direction = "left";
            break;
        case "up":
            direction = "up";
            break;
        case "down":
            direction = "down";
            break;
        default:
            break;
    }
    handleAction();
}


/*
 * handleAction() tells the server that a player wants to move is a new direction.
 */
function handleAction(){
    console.log(direction);
   /*
    * To make sure players can't send fake data that can ruin the game, break the code
    * or allow them any sort of advantages, this socket.emit is the only one comunicating
    * with the server. And to further avoid potential risks, only a simple string is sent to the server.
    * This way we can be (alomst) sure that nothing that causes trouble is received by the server.
    */
    socket.emit("newCoordinates", {
        move: direction
    });
}





let fpsInterval;
let then;

/*
 * The startAnimating function kicks off our animation (see Games on the Web I - HTML5 Graphics and Animations).
 */
function startAnimating(fps) {
    fpsInterval = 1000 / fps;
    then = Date.now();
    animate();
}




/*
 * This variable is used to provide a smoother animation.
 * Characters' movements are updated only after five animate() cycles. 
 * slowDown keeps count of the number of cycles.
 */
let slowDown = 0;


/*
 * The animate function is called repeatedly using requestAnimationFrame (see Games on the Web I - HTML5 Graphics and Animations).
 */
function animate() {
    requestAnimationFrame(animate);
    
    let now = Date.now();
    let elapsed = now - then;

    if (elapsed > fpsInterval) {
        then = now - (elapsed % fpsInterval);
        // Acquire both a canvas (using jQuery) and its associated context
        let canvas = $("canvas").get(0);
        let context = canvas.getContext("2d");

        // Calculate the width and height of each cell in our dungeon
        // by diving the pixel width/height of the canvas by the number of
        // cells in the dungeon
        let cellWidth = canvas.width / dungeon.w;
        let cellHeight = canvas.height / dungeon.h;

        // Clear the drawing area each animation cycle
        context.clearRect(0, 0, canvas.width, canvas.height);

        /* We check each one of our tiles within the dungeon using a nested for loop
         * which runs from 0 to the width of the dungeon in the x dimension
         * and from 0 to the height of the dungeon in the y dimension
         *
         * For each space in the dungeon, we check whether it is a space that can be
         * moved into (i.e. it isn't a 0 in the 2D array), and if so, we use the identifySpaceType
         * method to check which tile needs to be drawn.
         *
         * This returns an object containing the information required to draw a subset of the
         * tilesImage as appropriate for that tile.
         * See: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage
         * to remind yourself how the drawImage method works.
         */
        for (let x = 0; x < dungeon.w; x++) {
            for (let y = 0; y < dungeon.h; y++) {
                if (dungeon.maze[y][x] > 0) {
                    let tileInformation = identifySpaceType(x, y);
                    context.drawImage(tilesImage,
                        tileInformation.tilesetX,
                        tileInformation.tilesetY,
                        tileInformation.tilesizeX,
                        tileInformation.tilesizeY,
                        x * cellWidth,
                        y * cellHeight,
                        cellWidth,
                        cellHeight);
                } else {
                    context.fillStyle = "black";
                    context.fillRect(
                        x * cellWidth,
                        y * cellHeight,
                        cellWidth,
                        cellHeight
                    );
                }
            }
        }

        // The start point is calculated by multiplying the cell location (dungeonStart.x, dungeonStart.y)
        // by the cellWidth and cellHeight respectively
        // Refer to: Games on the Web I - HTML5 Graphics and Animations, Lab Exercise 2
        context.drawImage(tilesImage,
            16, 80, 16, 16,
            dungeonStart.x * cellWidth,
            dungeonStart.y * cellHeight,
            cellWidth,
            cellHeight);

        // The goal is calculated by multiplying the cell location (dungeonEnd.x, dungeonEnd.y)
        // by the cellWidth and cellHeight respectively
        // Refer to: Games on the Web I - HTML5 Graphics and Animations, Lab Exercise 2
        context.drawImage(tilesImage,
            224, 80, 16, 16,
            dungeonEnd.x * cellWidth,
            dungeonEnd.y * cellHeight,
            cellWidth,
            cellHeight);

        //determine which picture to draw
        if(players.instance !== undefined){
            //get the next player
            players.instance.forEach(function (_this) {
                //check if it is time to update its character
                if(slowDown > 5){
                    //if character is moving
                    if(_this.isMoving){
                        //see setDirection() and listenForEvents() 
                        //for more details about how the direction of a 
                        //charater is set.

                        //if character is moving towards right
                        if(_this.isRightDirection){
                            //draw pictures that point towards right.
                            if(_this.nextPicIndex < 2)
                                _this.nextPicIndex++;
                            else
                                _this.nextPicIndex = 0;
                        }else{
                            //draw pictures that point towards left.
                            if(_this.nextPicIndex < 5)
                                _this.nextPicIndex++;
                            else
                                _this.nextPicIndex = 3;
                        }
                        _this.isMoving = false;
                        slowDown = 0;
                    }else{
                        //move to where "rest" pictures start and move through them
                        if(_this.nextPicIndex < 6 || (_this.nextPicIndex+1) > 7)
                            _this.nextPicIndex = 6;
                        else
                            _this.nextPicIndex++;
                    }
                }

                //draw character
                context.drawImage(character[_this.nextPicIndex],
                    _this.x*cellWidth,
                    _this.y*cellHeight,
                    cellWidth,
                    cellHeight);

                /* draw identifier
                 * x: draw identifier "2.7 of a cell-width" on the right of the character(I.E: in the middle) 
                 * y: 1/3 of a cell-height on top of the caracter
                 * width and height = respectively 1/3 of a cell width and height
                 */
                if(_this.id == playerId){
                    context.drawImage(identifier,
                    (_this.x*cellWidth)+(cellWidth/2.7),
                    (_this.y*cellHeight)-(cellHeight/3),
                    cellWidth/3,
                    cellHeight/3);
                }
            });
        }
        slowDown++;
    }
}
