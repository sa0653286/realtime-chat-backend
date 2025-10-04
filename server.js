// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
const mongoURL = 'mongodb+srv://sa0653286:sa0653286@gmail@sa0653286.z7tyl9v.mongodb.net/chatflow?retryWrites=true&w=majority';
mongoose.connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

// User Schema
const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  contacts: [{ name: String, email: String }]
});
const User = mongoose.model("User", userSchema);

// Signup
app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  if(!username || !email || !password) return res.json({ error: "Please fill all fields" });

  const existing = await User.findOne({ email });
  if(existing) return res.json({ error: "Email already exists" });

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ username, email, password: hashedPassword });
  await user.save();
  res.json({ success: true });
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if(!email || !password) return res.json({ error: "Please fill all fields" });

  const user = await User.findOne({ email });
  if(!user) return res.json({ error: "Invalid email or password" });

  const match = await bcrypt.compare(password, user.password);
  if(!match) return res.json({ error: "Invalid email or password" });

  res.json({ success: true, username: user.username, email: user.email, contacts: user.contacts });
});

// Real-time chat with Socket.IO
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("send_message", (data) => {
    io.emit("receive_message", data);
  });

  socket.on("disconnect", () => console.log("User disconnected:", socket.id));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));