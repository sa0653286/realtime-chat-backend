const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ------------------ MongoDB ------------------
const dbPassword = "sa0653286@gmail";
const mongoURL = `mongodb+srv://sa0653286:${dbPassword}@sa0653286.z7tyl9v.mongodb.net/chatflow?retryWrites=true&w=majority`;

mongoose.connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("MongoDB error:", err));

// ------------------ Schemas ------------------
const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  isAdmin: { type: Boolean, default: false },
});

const User = mongoose.model("User", userSchema);

// ------------------ Routes ------------------
const JWT_SECRET = "chatflow_secret";

app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.json({ success: false, message: "All fields required" });

  const exists = await User.findOne({ email });
  if (exists) return res.json({ success: false, message: "Email already registered" });

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({ username, email, password: hashedPassword });
  res.json({ success: true, message: "Account created", user: { username: user.username, email: user.email } });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.json({ success: false, message: "All fields required" });

  const user = await User.findOne({ email });
  if (!user) return res.json({ success: false, message: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.json({ success: false, message: "Invalid credentials" });

  const token = jwt.sign({ email: user.email, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ success: true, token, user: { username: user.username, email: user.email, isAdmin: user.isAdmin } });
});

// ------------------ Socket.IO ------------------
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("send_message", (data) => {
    // emit message to all connected clients (you can add room support later)
    io.emit("receive_message", data);
  });

  socket.on("disconnect", () => console.log("User disconnected:", socket.id));
});

// ------------------ Start Server ------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));