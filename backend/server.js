const http = require("http");
const easymidi = require("easymidi");
const { Server } = require("socket.io");

const server = http.createServer((req, res) => {
  if (req.url === "/api/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ status: "running", activeInput: activeInputName }),
    );
  } else {
    res.writeHead(404);
    res.end();
  }
});

let proxyOutput = new easymidi.Output("Ohm Proxy", true);
let activeInput = null;
let activeInputName = null;
let blockedCCs = [];

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

function setupMidiInput(portName) {
  if (activeInput) {
    activeInput.close();
    activeInput = null;
    activeInputName = null;
  }

  if (!portName) return;

  try {
    activeInput = new easymidi.Input(portName);
    activeInputName = portName;
    console.log(`Now listening to MIDI input: ${portName}`);

    const messageTypes = [
      "noteon",
      "noteoff",
      "poly aftertouch",
      "cc",
      "program",
      "channel aftertouch",
      "pitch",
      "position",
      "select",
      "clock",
      "start",
      "continue",
      "stop",
      "activesense",
      "reset",
    ];

    messageTypes.forEach((type) => {
      activeInput.on(type, (msg) => {
        let isBlocked = false;

        if (type === "cc") {
          for (const rule of blockedCCs) {
            if (
              rule.cc === msg.controller &&
              (rule.channel === "all" || rule.channel === msg.channel)
            ) {
              isBlocked = true;
              break;
            }
          }
        }

        if (!isBlocked && proxyOutput) {
          try {
            proxyOutput.send(type, msg);
          } catch (e) {}
        }

        io.emit("midiMessage", {
          time: Date.now(),
          type,
          msg,
          isBlocked,
        });
      });
    });
  } catch (error) {
    console.error(`Failed to open MIDI port ${portName}:`, error);
  }
}

io.on("connection", (socket) => {
  console.log("WebUI connected");

  socket.emit("state", {
    inputs: easymidi.getInputs(),
    activeInput: activeInputName,
    blockedCCs: blockedCCs,
  });

  socket.on("setBlockedCCs", (ccs) => {
    blockedCCs = ccs;
    console.log("Updated blocked CCs:", blockedCCs);
    io.emit("state", {
      inputs: easymidi.getInputs(),
      activeInput: activeInputName,
      blockedCCs: blockedCCs,
    });
  });

  socket.on("selectInput", (portName) => {
    setupMidiInput(portName);
    io.emit("state", {
      inputs: easymidi.getInputs(),
      activeInput: activeInputName,
      blockedCCs: blockedCCs,
    });
  });

  socket.on("refreshPorts", () => {
    io.emit("state", {
      inputs: easymidi.getInputs(),
      activeInput: activeInputName,
      blockedCCs: blockedCCs,
    });
  });
});

server.listen(3001, () => {
  console.log("Server is listening on http://localhost:3001");
});
