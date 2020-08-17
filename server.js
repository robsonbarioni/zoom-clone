const port = process.env.PORT || 3000;
const format = require("date-fns").format;
const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const peerServer = require("peer").ExpressPeerServer(server, { debug: true });
const { v4: uuidv4 } = require("uuid");

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.json());
app.use("/peerjs", peerServer);

app.get("/", (req, res) => {
  res.redirect(`/${uuidv4()}`);
});

app.get("/:room", (req, res) => {
  res.render("room", { roomId: req.params.room });
});

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, username, userId }) => {
    console.log(`${username} has joined the room on: ${userId}`);
    socket.join(roomId);
    socket.to(roomId).broadcast.emit("user-connected", { username, userId });

    socket.on("message", ({ text }) => {
      console.log(`${username} sent a message to room: ${userId}`);
      io.in(roomId).emit("message", {
        date: format(new Date(), "HH:mm"),
        username,
        text,
      });
    });

    socket.on("disconnect", function () {
      console.log(`${username} leave the room: ${userId}`);
      io.in(roomId).emit("disconnect", { username, userId });
    });
  });
});

server.listen(port, () => console.log(`Running on localhost:${port}`));
