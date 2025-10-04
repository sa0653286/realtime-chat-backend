const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { MONGO_URI, JWT_SECRET } = require('./config');

const app = express();
app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ===== MongoDB Connection =====
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ MongoDB Error:", err));

// ===== Mongoose Schemas =====
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  contacts: [String]
});

const messageSchema = new mongoose.Schema({
  from: String,
  to: String,
  text: String,
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);
const Message = mongoose.model("Message", messageSchema);

// ===== Authentication Middleware =====
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

// ===== Routes =====

// Signup
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  if (await User.findOne({ username })) return res.json({ message: "User already exists" });
  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hashed, contacts: [] });
  await user.save();
  res.json({ message: "Signup successful" });
});

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.json({ message: "User not found" });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.json({ message: "Wrong password" });
  const token = jwt.sign({ username }, JWT_SECRET);
  res.json({ message: "Login successful", token });
});

// Get user info
app.get("/loginInfo", auth, async (req, res) => {
  res.json({ username: req.user.username });
});

// Add Contact
app.post("/contacts", auth, async (req, res) => {
  const { contact } = req.body;
  const user = await User.findOne({ username: req.user.username });
  if (!user.contacts.includes(contact)) user.contacts.push(contact);
  await user.save();
  res.json({ message: "Contact added" });
});

// Get Contacts
app.get("/contacts", auth, async (req, res) => {
  const user = await User.findOne({ username: req.user.username });
  res.json({ contacts: user.contacts });
});

// Send Message (save + emit)
app.post("/messages", auth, async (req, res) => {
  const { to, text } = req.body;
  const msg = new Message({ from: req.user.username, to, text });
  await msg.save();
  io.emit("receive_message", msg);
  res.json({ message: "Message sent" });
});

// Get Messages with a contact
app.get("/messages/:contact", auth, async (req, res) => {
  const { contact } = req.params;
  const messages = await Message.find({
    $or: [
      { from: req.user.username, to: contact },
      { from: contact, to: req.user.username }
    ]
  }).sort({ timestamp: 1 });
  res.json({ messages });
});

// ===== Socket.IO Real-time =====
io.on("connection", (socket) => {
  console.log("⚡ User connected:", socket.id);

  socket.on("join", (username) => {
    socket.username = username;
    socket.join(username);
  });

  socket.on("send_message", (data) => {
    io.to(data.to).emit("receive_message", { from: socket.username, text: data.text });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// ===== Start Server =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 ChatFlow backend running on port ${PORT}`));
