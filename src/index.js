const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const cors = require("cors");
const users = require("./users")();
const { Server } = require("socket.io");

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
    transports: ["websocket", "polling"],
  },
  allowEIO3: true,
});

app.use(express.json());
app.use(cors());

const m = (name, text, id) => ({ name, text, id });

io.on("connection", (socket) => {
  socket.on("userJoined", (data, cb) => {
    if (!data.name || !data.room) {
      return cb("room and name is required");
    }

    socket.join(data.room);
    users.remove(socket.id);

    socket.on("typing", (data) => {
      const user = users.get(data);

      socket.broadcast
        .to(user.room)
        .emit("userTyping", { typing: true, name: user.name });

      socket.on("stopTyping", () => {
        socket.broadcast
          .to(user.room)
          .emit("stopTypings", { typing: false, name: user.name });
      });
    });

    users.add({
      id: socket.id,
      name: data.name,
      room: data.room,
    });
    cb({ userId: socket.id });
    socket.emit("connectMessage", { message: `Welcome to room: ${data.room}` });
    socket.broadcast
      .to(data.room)
      .emit("connectMessage", { message: `${data.name} has joined` });
  });
  socket.on("createMessage", (data, cb) => {
    if (!data.text) {
      return cb("message is required");
    }
    const user = users.get(data.id);
    if (user) {
      io.to(user.room).emit("newMessage", m(user.name, data.text, data.id));
    }
    cb({});
  });
});

const PORT = 5000 || process.env.PORT;
server.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
