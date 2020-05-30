const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

// Run when client connects
io.on("connection", socket => {
    socket.emit("message", "Welcome to the chat app!");

    // Broadcast when user connects
    socket.broadcast.emit("message", "A user has joined the chat");

    // Runs when client disconnects
    socket.on("disconnect", () => {
        io.emit("message", "A user has left the chat");
    });

    // Listen for Message
    socket.on("chatMessage", msg => {
        io.emit("message", msg);
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

