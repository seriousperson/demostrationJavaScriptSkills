
let config = {
    host: "127.0.0.1",
    user: "root",
    password: "",
    port: 3306,
    database: ""
} 


let config2 = {
    host: "127.0.0.1",
    user: "root",
    password: "",
    port: "3306",
    database: "DungeonGame"
}



exports.selectdb = function selectdb (){
    return config2;
}

exports.credentials = function credentials () {
    return config;
}




exports.saveDetails = function saveDetails(data){
    sql = "INSERT INTO GameDetails (time, numplayers) VALUES ('"+data.duration+"', '"+data.playerscount+"')";
    executeQueries(data.connection, sql);
}




exports.createDB = function createDB(con){
	con.connect(function(err) {  
        if (err) throw err;  
        else
        console.log("connected")

        //create database to store details of the game
        sql = "CREATE DATABASE IF NOT EXISTS DungeonGame";
        con.query(sql);
        console.log("database was successfully created."); 
    });  	
}




exports.createTable = function createTable(con){
    con.connect(function (err){
        if(err) throw err;
        //create table if it doesnt exist
        sql = "CREATE TABLE IF NOT EXISTS GameDetails ";
        sql+= "(id INT NOT NULL PRIMARY KEY AUTO_INCREMENT, time INT NOT NULL, numplayers INT NOT NULL)";
        let res = executeQueries(con, sql);
        console.log("Table was successfully created."); 
        console.log(res);
    });
}







function executeQueries(connection, query){
    connection.query(query, function (err, res) {
        if(err) throw err;
            return res; 
    });
}
