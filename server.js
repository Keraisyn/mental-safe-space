const path = require("path");
const http = require("http");
const https = require('https');
const express = require("express");
const socketio = require("socket.io");
const formatMessage = require("./utils/message");
const {userJoin, getCurrentUser, userLeave, getRoomUsers} = require("./utils/users");
const mongoose = require("mongoose");
require("dotenv").config();
const {PredictionServiceClient} = require('@google-cloud/automl').v1;
const client = new PredictionServiceClient();
const app = express();
const server = http.createServer(app);
const io = socketio(server);
mongoose.connect("mongodb+srv://Rohan:rohan@openhacks2020-hu4by.gcp.mongodb.net/test?retryWrites=true&w=majority");
const db = mongoose.connection;
db.on('error', console.error.bind(console, "connection error:"));

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

const projectId = 'able-device-278817';
const location = 'us-central1';
const modelId = 'TST3342236072485584896';
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


async function getScore(msg, doc) {
    const data = {
				"name": client.modelPath(projectId, location, modelId),
        "payload": {
            "textSnippet": {
                "content": msg,
                "mime_type": "text/plain"
            }
        }
    }
    // Calculate score with new message
		const res = await client.predict(data);
            console.log("doc:", doc);
            let score = res[0].payload[0].textSentiment.sentiment;

            const num = doc.num;
            const currentScore = doc.score;
            if (score === undefined) {
                score = 0;
            }
            console.log("score for this message:", score);

            const newScore = (currentScore * num + score) / (num + 1);
            console.log("overall score:",newScore);
            doc.score = newScore;
            doc.num = doc.num + 1;

            doc.save();
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
                if (doc == null) {
                    new Room({name: room, contents: []}).save().then(() => {
                        // Load previous messages from chat room
                        Room.findOne({name: room}, (err, doc) => {
                            if (err) {
                                console.log("hi");
                                return console.error(err);
                            }
                            console.log(doc);
                            doc.contents.forEach((msg) => {
                                socket.emit("message", msg.formattedMessage);
                            });
                        });
                    });
                } else {
									// Load previous messages from chat room
                        Room.findOne({name: room}, (err, doc) => {
                            if (err) {
                                console.log("hi");
                                return console.error(err);
                            }
                            console.log(doc);
                            doc.contents.forEach((msg) => {
                                socket.emit("message", msg.formattedMessage);
                            });
                        });
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
                io.emit("message", formatMessage(adminName, `${user.username} has left the chat`));

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
