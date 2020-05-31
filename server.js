const path = require("path");
const http = require("http");
const https = require('https');
const express = require("express");
const socketio = require("socket.io");
const formatMessage = require("./utils/message");
const {userJoin, getCurrentUser, userLeave, getRoomUsers} = require("./utils/users");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketio(server);
mongoose.connect(process.env.DB_URI);
const db = mongoose.connection;
db.on('error', console.error.bind(console, "connection error:"));

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

const adminName = "Admin";

const sadSchema = new mongoose.Schema({
    name: String,
    num: Number,    // # of messages
    score: Number,  // Average score of last 100 messages?
});

const Sad = mongoose.model("Sad", sadSchema);

const roomSchema = new mongoose.Schema({
    contents: Array,
    name: String,
});

const Room = mongoose.model("Room", roomSchema);

// Room.create({name:"hi"}, function(err, doc) {
//     console.log("hi")
// });

console.log(Room);

function getScore(msg, doc) {
    const data = JSON.stringify({
        "payload": {
            "textSnippet": {
                "content": msg,
                "mime_type": "text/plain"
            }
        }
    });

    // Calculate score with new message
    const req = https.request({
        host: "automl.googleapis.com",
        path: "/v1/projects/757526254746/locations/us-central1/models/TST3342236072485584896:predict",
        method: "POST",
        headers: {
            "Authorization": "Bearer ya29.c.Ko8BzQfkJiweu-CTlpUjKbO6H33rN1R2pQ7rGMU-nYCLz72eWydzOScp58MZkHQeEYTFYAiNurZDu-F1vxGbFI_U5m2ztTi8RgOpRwOPZNCQb9WfqrCYFlBlTHE8kxiceQ7G6BO7N0DvTQMcW-xFsEgjvWZMyIov8tmUxHaSvmGaurG9ff-0enkqsFKNYl4wh2c",
            "Content-Type": "application/json",
        },
    }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            console.log(data);

            console.log("doc:", doc);
            let score = JSON.parse(data).payload[0].textSentiment.sentiment;

            const num = doc.num;
            const currentScore = doc.score;
            if (score === undefined) {
                score = 0;
            }
            console.log("score", score);

            const newScore = (currentScore * num + score) / (num + 1);
            console.log(newScore);
            doc.score = newScore;
            doc.num = doc.num + 1;

            doc.save();
        });
    });
    req.write(data);
    req.end();
}

// console.log("thing:", getScore("Hello"));

db.once('open', function () {

    // Run when client connects
    io.on("connection", socket => {

        socket.on("joinRoom", ({username, room}) => {
            // Create mongoDB document for this room if it doesn't exist
            Room.findOne({name: room}, function (err, doc) {
                if (err) {
                    Room.create({name: room, contents: []}, function () {
                    }).then(console.log("Doc created"));

                }
                if (doc === null) {
                    new Room({name: room, contents: []}).save().then(console.log("Doc created!!"));
                }
            });

            // Create mongoDB document for user if it doesn't exist
            Sad.findOne({name: username}, function (err, doc) {
                if (err) {
                    new Sad({name: username, num: 0, score: 0}).save();
                }
                if (doc === null) {
                    new Sad({name: username, num: 0, score: 0}).save();
                }
            });

            // Load previous messages from chat room
            Room.findOne({name: room}, (err, doc) => {
                if (err) {
                    console.log("hi");
                    return console.error(err);
                }
                // console.log(doc);
                doc.contents.forEach((msg) => {
                    socket.emit("message", msg.formattedMessage);
                });
            });

            const user = userJoin(socket.id, username, room);

            socket.join(user.room);

            // Welcome user
            socket.emit("message", formatMessage(adminName, "Welcome!"));

            // Broadcast when user connects
            socket.broadcast.to(user.room).emit("message", formatMessage(adminName, `${user.username} has joined the chat`));

            // Send users and room info
            io.to(user.room).emit("roomUsers", {
                room: user.room,
                users: getRoomUsers(user.room)
            });
        });

        // Listen for Message
        socket.on("chatMessage", msg => {
            const user = getCurrentUser(socket.id);

            // Emit message
            const formattedMessage = formatMessage(user.username, msg);
            io.to(user.room).emit("message", formattedMessage);

            // Save in database
            Room.findOne({name: user.room}, function (err, doc) {
                doc.contents.push({formattedMessage});
                doc.save();
                if (err) {
                    console.log(err);
                }
            });

            // Calculate new score
            Sad.findOne({name: user.username}, function (err, doc) {
                if (err) {
                    return console.error(err);
                }

                console.log(doc);

                getScore(msg, doc);

                if (doc.score < 0.25 && doc.num >= 10) {
                    socket.emit("warning");
                }

            });
        });
        // Runs when client disconnects
        socket.on("disconnect", () => {
            const user = userLeave(socket.id);

            if (user) {
                io.emit("message", formatMessage(adminName, `${user.username} A user has left the chat`));

                // Send users and room info
                io.to(user.room).emit("roomUsers", {
                    room: user.room,
                    users: getRoomUsers(user.room)
                });
            }
        });
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
