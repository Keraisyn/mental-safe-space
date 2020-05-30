const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const formatMessage = require("./utils/message");
const {userJoin, getCurrentUser, userLeave, getRoomUsers} = require("./utils/users");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

const adminName = "Admin";

// Run when client connects
io.on("connection", socket => {
    socket.on("joinRoom", ({username, room}) => {
        const user = userJoin(socket.id, username, room);

        socket.join(user.room);

        // Welcome user
        socket.emit("message", formatMessage(adminName), "Welcome!");

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

        io.to(user.room).emit("message", formatMessage(user.username, msg));
    });

    // Runs when client disconnects
    socket.on("disconnect", () => {
        const user = userLeave(socket.id);

        if(user) {
            io.emit("message", formatMessage(adminName, `${user.username} A user has left the chat`));

            // Send users and room info
            io.to(user.room).emit("roomUsers", {
                room: user.room,
                users: getRoomUsers(user.room)
            });
        }
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
