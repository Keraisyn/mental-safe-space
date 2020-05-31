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
mongoose.connect(process.env.DB_URI, {useNewUrlParser: true});
const db = mongoose.connection;
db.on('error', console.error.bind(console, "connection error:"));

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

const adminName = "Admin";

const roomSchema = new mongoose.Schema({
    contents: Array,
    name: String,
});

const Room = mongoose.model("Room", roomSchema);

db.once('open', function () {

    // Run when client connects
    io.on("connection", socket => {
        socket.on("joinRoom", ({username, room}) => {
            // Create mongoDB document for this room if it doesn't exist
            new Room({name: room, contents: []}).save();

            // Load previous messages from chat room
            Room.findOne({name: room}, (err, doc) => {
                doc.contents.forEach((msg) => {
                   socket.emit("message", msg.formattedMessage);
                });

                if (err) {
                    console.log(err);
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
            })
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
