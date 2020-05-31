const path = require("path");
const http = require("http");
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

const Sad = db.model("Sad", sadSchema);

const roomSchema = new mongoose.Schema({
    contents: Array,
    name: String,
});

const Room = db.model("Room", roomSchema);

function getScore(msg) {
    // Calculate score with new message
    const req = http.request({
        host: "automl.googleapis.com",
        path: "/v1/projects/757526254746/locations/us-central1/models/TST3342236072485584896:predict",
        method: "POST",
        headers: {
            "payload": {
                "textSnippet": {
                    "content": msg,
                    "mime_type": "text/plain"
                }
            }
        }
    }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            return JSON.parse(data).explanation;
        });
    });
}

db.once('open', function () {

    // Run when client connects
    io.on("connection", socket => {

        socket.on("joinRoom", ({username, room}) => {
            // Create mongoDB document for this room if it doesn't exist
            Room.findOne({name: room}, function (err, doc) {
                if (err) {
                    new Room({name: room, contents: []}).save().then(console.log("Doc created"));
                    console.log("new room");
                }
                if (doc===null) {
                    new Room({name: room, contents: []}).save().then(console.log("Doc created!!"));
                }
            });

            // Create mongoDB document for user if it doesn't exist
            Sad.findOne({name: username}, function (err, doc) {
                if (err) {
                    new Sad({name: username, num: 0, score: 0}).save();
                }
            });

            // Load previous messages from chat room
            Room.findOne({name: room}, (err, doc) => {
                if (err) {
                    console.log("hi");
                    return console.error(err);
                }
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
                    console.log(err);
                }
                const score = getScore(msg);

                const {num, currentScore} = doc;

                const newScore = (currentScore * num + score) / (num + 1);

                doc.score = newScore;
                console.log(newScore);

                doc.save();

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
