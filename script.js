// ========================================
// QUICK TAP BATTLE
// REAL-TIME MULTIPLAYER
// ========================================

// 👇 Supabase Connect page నుంచి ఇవి రెండూ పెట్టు.
const SUPABASE_URL = "PASTE_YOUR_PROJECT_URL_HERE";
const SUPABASE_KEY = "PASTE_YOUR_PUBLISHABLE_KEY_HERE";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


// ========================================
// PLAYER STATE
// ========================================

let currentPlayer = "";
let currentRoom = "";
let playerId = crypto.randomUUID();

let isHost = false;
let channel = null;

let score = 0;
let round = 1;
let timer = 8;
let timerInterval = null;
let countdownInterval = null;
let hasTapped = false;

const totalRounds = 10;


// ========================================
// SCREEN SYSTEM
// ========================================

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.remove("active");
  });

  const screen = document.getElementById(id);

  if (screen) {
    screen.classList.add("active");
  }
}


// ========================================
// ROOM CODE
// ========================================

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}


// ========================================
// CREATE ROOM
// ========================================

async function createRoom() {

  const name = document
    .getElementById("hostName")
    .value
    .trim();

  if (!name) {
    alert("Please enter your nickname.");
    return;
  }

  currentPlayer = name;
  currentRoom = generateRoomCode();

  isHost = true;

  document.getElementById("generatedCode").textContent =
    currentRoom;

  document.getElementById("lobbyCode").textContent =
    currentRoom;

  await connectToRoom();

  showScreen("lobby");
}


// ========================================
// JOIN ROOM
// ========================================

async function joinRoom() {

  const room = document
    .getElementById("roomInput")
    .value
    .trim()
    .toUpperCase();

  const name = document
    .getElementById("playerName")
    .value
    .trim();

  if (!room || room.length !== 6) {
    alert("Enter the 6-character room code.");
    return;
  }

  if (!name) {
    alert("Please enter your nickname.");
    return;
  }

  currentRoom = room;
  currentPlayer = name;

  isHost = false;

  document.getElementById("lobbyCode").textContent =
    currentRoom;

  await connectToRoom();

  showScreen("lobby");
}


// ========================================
// CONNECT TO SUPABASE ROOM
// ========================================

async function connectToRoom() {

  // Remove old channel if there is one.
  if (channel) {
    await supabaseClient.removeChannel(channel);
  }

  channel = supabaseClient.channel(
    `quick-tap-room-${currentRoom}`
  );


  // ----------------------------------------
  // PLAYER PRESENCE
  // ----------------------------------------

  channel.on(
    "presence",
    { event: "sync" },
    () => {
      updatePlayers();
    }
  );


  channel.on(
    "presence",
    { event: "join" },
    () => {
      updatePlayers();
    }
  );


  channel.on(
    "presence",
    { event: "leave" },
    () => {
      updatePlayers();
    }
  );


  // ----------------------------------------
  // GAME EVENTS
  // ----------------------------------------

  channel.on(
    "broadcast",
    { event: "game-start" },
    ({ payload }) => {

      if (isHost) return;

      startCountdown(payload.round || 1);
    }
  );


  channel.on(
    "broadcast",
    { event: "round-start" },
    ({ payload }) => {

      startRound(
        payload.round,
        payload.x,
        payload.y
      );
    }
  );


  channel.on(
    "broadcast",
    { event: "player-score" },
    ({ payload }) => {

      if (payload.playerId === playerId) {
        return;
      }

      updateRemoteScore(
        payload.playerId,
        payload.playerName,
        payload.score
      );
    }
  );


  channel.on(
    "broadcast",
    { event: "game-finished" },
    ({ payload }) => {

      if (payload.playerId === playerId) {
        return;
      }

      showRemoteResults(payload);
    }
  );


  // ----------------------------------------
  // SUBSCRIBE
  // ----------------------------------------

  channel.subscribe(async (status, error) => {

    if (status === "SUBSCRIBED") {

      await channel.track({
        playerId: playerId,
        name: currentPlayer,
        score: 0,
        onlineAt: new Date().toISOString()
      });

      updatePlayers();

      console.log(
        `Connected to room ${currentRoom}`
      );
    }

    if (
      status === "CHANNEL_ERROR" ||
      status === "TIMED_OUT"
    ) {

      console.error(
        "Room connection error:",
        error
      );

      alert(
        "Could not connect to the room. Check your Supabase settings."
      );
    }
  });
}


// ========================================
// UPDATE PLAYER LIST
// ========================================

function updatePlayers() {

  if (!channel) return;

  const state = channel.presenceState();

  const players = [];

  Object.values(state).forEach(entries => {

    entries.forEach(player => {

      players.push(player);
    });
  });


  const container =
    document.getElementById("players");

  if (!container) return;

  container.innerHTML = "";


  players.forEach((player, index) => {

    const card = document.createElement("div");

    card.className = "player-card";

    card.innerHTML = `
      <span class="avatar">
        ${index === 0 ? "⚡" : "🎮"}
      </span>

      <span>
        ${escapeHTML(player.name)}
      </span>

      <small>
        ${index === 0 ? "HOST" : "READY"}
      </small>
    `;

    container.appendChild(card);
  });


  // Empty slots

  const maxPlayers = 8;

  for (
    let i = players.length;
    i < maxPlayers;
    i++
  ) {

    const empty = document.createElement("div");

    empty.className =
      "player-card empty";

    empty.innerHTML = `
      <span>＋</span>
      <span>Waiting...</span>
    `;

    container.appendChild(empty);
  }


  const waiting =
    document.getElementById("waitingMessage");

  if (waiting) {

    waiting.textContent =
      `${players.length} player${
        players.length === 1 ? "" : "s"
      } connected`;
  }
}


// ========================================
// START GAME
// ========================================

async function startGame() {

  // Only host controls the game.
  if (!isHost) {

    alert(
      "Only the host can start the battle."
    );

    return;
  }

  score = 0;
  round = 1;

  document.getElementById("score").textContent =
    "0";


  await channel.send({
    type: "broadcast",
    event: "game-start",
    payload: {
      round: 1
    }
  });


  startCountdown(1);
}


// ========================================
// COUNTDOWN
// ========================================

function startCountdown(startRoundNumber) {

  showScreen("countdown");

  let count = 3;

  document.getElementById("countNumber")
    .textContent = count;

  clearInterval(countdownInterval);

  countdownInterval = setInterval(() => {

    count--;

    if (count > 0) {

      document.getElementById("countNumber")
        .textContent = count;

    } else {

      clearInterval(countdownInterval);

      if (isHost) {
        broadcastRound(startRoundNumber);
      }
    }

  }, 1000);
}


// ========================================
// HOST STARTS ROUND
// ========================================

async function broadcastRound(roundNumber) {

  const x =
    10 + Math.random() * 80;

  const y =
    12 + Math.random() * 76;


  await channel.send({

    type: "broadcast",

    event: "round-start",

    payload: {
      round: roundNumber,
      x: x,
      y: y
    }

  });


  // Host also receives the game state locally.
  startRound(
    roundNumber,
    x,
    y
  );
}


// ========================================
// START ROUND
// ========================================

function startRound(
  roundNumber,
  x,
  y
) {

  round = roundNumber;

  hasTapped = false;

  timer = 8;

  showScreen("game");


  document.getElementById("roundNumber")
    .textContent =
    `${round} / ${totalRounds}`;

  document.getElementById("timer")
    .textContent =
    timer.toFixed(1);


  const target =
    document.getElementById("target");

  target.textContent = "🎯";

  target.style.left = `${x}%`;

  target.style.top = `${y}%`;


  clearInterval(timerInterval);


  const startTime = Date.now();


  timerInterval = setInterval(() => {

    const elapsed =
      (Date.now() - startTime) / 1000;

    timer =
      Math.max(0, 8 - elapsed);


    document.getElementById("timer")
      .textContent =
      timer.toFixed(1);


    if (timer <= 0) {

      endRound();

    }

  }, 50);
}


// ========================================
// TAP TARGET
// ========================================

async function tapTarget() {

  if (hasTapped) return;

  hasTapped = true;

  clearInterval(timerInterval);


  const points =
    Math.max(
      25,
      Math.round(100 * (timer / 8))
    );


  score += points;


  document.getElementById("score")
    .textContent = score;


  const target =
    document.getElementById("target");

  target.textContent = "✓";


  // Tell everyone the updated score.
  await channel.send({

    type: "broadcast",

    event: "player-score",

    payload: {
      playerId: playerId,
      playerName: currentPlayer,
      score: score
    }

  });


  setTimeout(() => {

    endRound();

  }, 400);
}


// ========================================
// END ROUND
// ========================================

function endRound() {

  clearInterval(timerInterval);


  if (!hasTapped) {

    document.getElementById("target")
      .textContent = "⏰";
  }


  setTimeout(() => {

    if (round >= totalRounds) {

      finishGame();

    } else {

      round++;

      if (isHost) {

        startCountdown(round);

      }

    }

  }, 700);
}


// ========================================
// FINISH GAME
// ========================================

async function finishGame() {

  clearInterval(timerInterval);

  showResults();


  await channel.send({

    type: "broadcast",

    event: "game-finished",

    payload: {
      playerId: playerId,
      playerName: currentPlayer,
      score: score
    }

  });
}


// ========================================
// SHOW RESULTS
// ========================================

function showResults() {

  document.getElementById("winnerName")
    .textContent = currentPlayer;

  document.getElementById("finalScore")
    .textContent =
    `${score} POINTS`;

  document.getElementById("resultPlayer")
    .textContent = currentPlayer;

  document.getElementById("resultScore")
    .textContent = score;


  showScreen("results");
}


// ========================================
// REMOTE RESULT
// ========================================

function showRemoteResults(payload) {

  const winner =
    document.getElementById("winnerName");

  const finalScore =
    document.getElementById("finalScore");


  winner.textContent =
    payload.playerName;

  finalScore.textContent =
    `${payload.score} POINTS`;


  showScreen("results");
}


// ========================================
// REMOTE SCORE DISPLAY
// ========================================

function updateRemoteScore(
  remotePlayerId,
  playerName,
  remoteScore
) {

  console.log(
    `${playerName}: ${remoteScore}`
  );

  // The full leaderboard will be added
  // in the next polish step.
}


// ========================================
// PLAY AGAIN
// ========================================

function playAgain() {

  if (!isHost) {

    alert(
      "Ask the host to start another battle."
    );

    return;
  }

  score = 0;

  round = 1;

  document.getElementById("score")
    .textContent = "0";


  startCountdown(1);
}


// ========================================
// SAFE PLAYER NAME
// ========================================

function escapeHTML(text) {

  const div =
    document.createElement("div");

  div.textContent = text;

  return div.innerHTML;
}


// ========================================
// CONNECTION CLEANUP
// ========================================

window.addEventListener(
  "beforeunload",
  () => {

    if (channel) {

      channel.untrack();

      supabaseClient
        .removeChannel(channel);
    }
  }
);
