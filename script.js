// QUICK TAP BATTLE — real-time multiplayer browser game
// Supabase Realtime is used for room presence and game events.
const SUPABASE_URL = "https://edcbsnurayxhzdhcugcz.supabase.co";
const SUPABASE_KEY = "sb_publishable_MrQ_wbVmZ1wYlMpqF1jrjA_6y1aix6S";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const TOTAL_ROUNDS = 10, ROUND_SECONDS = 8, MAX_PLAYERS = 8;
let currentPlayer="", currentRoom="", playerId=crypto.randomUUID(), isHost=false, channel=null;
let score=0, round=1, timer=ROUND_SECONDS, timerInterval=null, countdownInterval=null, roundTransitionTimeout=null;
let hasTapped=false, gameActive=false, scoreBoard={};

function showScreen(id){document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));document.getElementById(id)?.classList.add("active");}
function generateRoomCode(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";return Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join("");}
function setStatus(message){const el=document.getElementById("actionStatus");if(el)el.textContent=message;}
function getPresencePlayers(){if(!channel)return[];const players=[];Object.values(channel.presenceState()).forEach(entries=>entries.forEach(p=>{if(p.playerId)players.push({playerId:p.playerId,name:p.name||"Player",score:Number(p.score)||0,isHost:Boolean(p.isHost)});}));return players;}
function updatePlayers(){
 const container=document.getElementById("players");if(!container)return;const players=getPresencePlayers();container.innerHTML="";
 players.forEach(p=>{const card=document.createElement("div");card.className="player-card";const avatar=document.createElement("span");avatar.className="avatar";avatar.textContent=p.isHost?"⚡":"🎮";const name=document.createElement("span");name.textContent=p.name;const role=document.createElement("small");role.textContent=p.isHost?"HOST":"READY";card.append(avatar,name,role);container.appendChild(card);});
 for(let i=players.length;i<MAX_PLAYERS;i++){const empty=document.createElement("div");empty.className="player-card empty";empty.innerHTML="<span>＋</span><span>Waiting...</span>";container.appendChild(empty);}
 const waiting=document.getElementById("waitingMessage");if(waiting)waiting.textContent=`${players.length}/${MAX_PLAYERS} players connected`;
}
function updateScoreBoard(id,name,value){scoreBoard[id]={playerId:id,name:name||"Player",score:Number(value)||0};renderLeaderboard();}
function renderLeaderboard(final=false){
 const container=document.getElementById("leaderboardRows");if(!container)return;const rows=Object.values(scoreBoard).sort((a,b)=>b.score-a.score);if(!rows.length)return;container.innerHTML="";
 rows.forEach((p,i)=>{const row=document.createElement("div");row.className="leader-row";const rank=document.createElement("span");rank.className="rank";rank.textContent=["🥇","🥈","🥉"][i]||`#${i+1}`;const name=document.createElement("span");name.className="leader-name";name.textContent=p.name;const points=document.createElement("b");points.className="leader-score";points.textContent=String(p.score);row.append(rank,name,points);container.appendChild(row);});
 const title=document.querySelector(".leaderboard-title span");if(title)title.textContent=final?"FINAL LEADERBOARD":"PLAYER SCORES";
}
async function connectToRoom(){
 if(channel){await supabaseClient.removeChannel(channel);channel=null;}scoreBoard={};
 channel=supabaseClient.channel(`quick-tap-room-${currentRoom}`,{config:{presence:{key:playerId}}});
 channel.on("presence",{event:"sync"},()=>{updatePlayers();getPresencePlayers().forEach(p=>{if(!(p.playerId in scoreBoard))updateScoreBoard(p.playerId,p.name,p.score);});});
 channel.on("presence",{event:"join"},updatePlayers);channel.on("presence",{event:"leave"},updatePlayers);
 channel.on("broadcast",{event:"game-start"},({payload})=>{if(!isHost){score=0;round=1;scoreBoard={};updateScoreBoard(playerId,currentPlayer,0);startCountdown(payload.round||1);}});
 channel.on("broadcast",{event:"round-start"},({payload})=>{if(!isHost)startRound(payload.round,payload.x,payload.y);});
 channel.on("broadcast",{event:"player-score"},({payload})=>{updateScoreBoard(payload.playerId,payload.playerName,payload.score);if(payload.playerId!==playerId)setStatus(`${payload.playerName} scored ${payload.score} points`);});
 channel.on("broadcast",{event:"game-finished"},({payload})=>{if(!isHost)showResults(payload);});
 return new Promise((resolve,reject)=>{let settled=false;channel.subscribe(async(status,error)=>{
  if(status==="SUBSCRIBED"){try{await channel.track({playerId,name:currentPlayer,score,isHost,onlineAt:new Date().toISOString()});updatePlayers();updateScoreBoard(playerId,currentPlayer,score);if(!settled){settled=true;resolve();}}catch(e){if(!settled){settled=true;reject(e);}}}
  else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"){if(!settled){settled=true;reject(error||new Error("Room connection failed"));}}
 });});
}
async function createRoom(){
 const name=document.getElementById("hostName").value.trim();if(!name)return alert("Please enter your nickname.");
 currentPlayer=name;currentRoom=generateRoomCode();isHost=true;score=0;
 document.getElementById("generatedCode").textContent=currentRoom;document.getElementById("lobbyCode").textContent=currentRoom;
 try{await connectToRoom();showScreen("lobby");}catch(e){console.error(e);alert("Could not connect to the game service. Please try again.");}
}
async function joinRoom(){
 const room=document.getElementById("roomInput").value.trim().toUpperCase(),name=document.getElementById("playerName").value.trim();
 if(!/^[A-HJ-NP-Z2-9]{6}$/.test(room))return alert("Enter a valid 6-character room code.");if(!name)return alert("Please enter your nickname.");
 currentRoom=room;currentPlayer=name;isHost=false;score=0;document.getElementById("lobbyCode").textContent=currentRoom;
 try{await connectToRoom();const players=getPresencePlayers();if(!players.some(p=>p.isHost)){await leaveRoom(false);return alert("Room not found. Check the code and ask the host to create it again.");}if(players.length>MAX_PLAYERS){await leaveRoom(false);return alert("This room is full. Maximum 8 players are allowed.");}showScreen("lobby");}
 catch(e){console.error(e);alert("Could not join this room. Check your connection and try again.");}
}
async function leaveRoom(returnToMenu=true){clearInterval(timerInterval);clearInterval(countdownInterval);clearTimeout(roundTransitionTimeout);gameActive=false;if(channel){await supabaseClient.removeChannel(channel);channel=null;}if(returnToMenu)showScreen("menu");}
async function startGame(){
 if(!isHost)return alert("Only the host can start the battle.");const players=getPresencePlayers();if(players.length<2)return alert("Invite at least one friend before starting.");
 score=0;round=1;gameActive=true;scoreBoard={};players.forEach(p=>updateScoreBoard(p.playerId,p.name,0));updateScoreBoard(playerId,currentPlayer,0);
 await channel.track({playerId,name:currentPlayer,score:0,isHost:true});await channel.send({type:"broadcast",event:"game-start",payload:{round:1}});startCountdown(1);
}
function startCountdown(startRoundNumber){
 clearInterval(countdownInterval);clearInterval(timerInterval);clearTimeout(roundTransitionTimeout);gameActive=true;showScreen("countdown");let count=3;document.getElementById("countNumber").textContent=count;
 countdownInterval=setInterval(()=>{count--;if(count>0){document.getElementById("countNumber").textContent=count;return;}clearInterval(countdownInterval);if(isHost)broadcastRound(startRoundNumber);},1000);
}
async function broadcastRound(roundNumber){const x=12+Math.random()*76,y=15+Math.random()*70;await channel.send({type:"broadcast",event:"round-start",payload:{round:roundNumber,x,y}});startRound(roundNumber,x,y);}
function startRound(roundNumber,x,y){
 round=roundNumber;hasTapped=false;timer=ROUND_SECONDS;showScreen("game");document.getElementById("roundNumber").textContent=`${round} / ${TOTAL_ROUNDS}`;document.getElementById("timer").textContent=timer.toFixed(1);
 document.getElementById("roundTitle").textContent="TAP RUSH";document.getElementById("roundInstruction").textContent="Tap the target as fast as you can!";
 const target=document.getElementById("target");target.textContent="🎯";target.style.left=`${x}%`;target.style.top=`${y}%`;setStatus("TAP THE TARGET!");
 clearInterval(timerInterval);const started=Date.now();timerInterval=setInterval(()=>{timer=Math.max(0,ROUND_SECONDS-(Date.now()-started)/1000);document.getElementById("timer").textContent=timer.toFixed(1);if(timer<=0)endRound();},50);
}
async function tapTarget(){
 if(hasTapped||!gameActive)return;hasTapped=true;clearInterval(timerInterval);const points=Math.max(0,Math.round(100*(timer/ROUND_SECONDS)));score+=points;
 document.getElementById("score").textContent=String(score);document.getElementById("target").textContent="✓";setStatus(`+${points} POINTS`);updateScoreBoard(playerId,currentPlayer,score);
 try{await channel.track({playerId,name:currentPlayer,score,isHost});await channel.send({type:"broadcast",event:"player-score",payload:{playerId,playerName:currentPlayer,score}});}catch(e){console.error("Score sync failed:",e);}
 roundTransitionTimeout=setTimeout(endRound,450);
}
function endRound(){
 clearInterval(timerInterval);if(!hasTapped){hasTapped=true;document.getElementById("target").textContent="⏰";setStatus("TIME'S UP!");}
 if(!isHost||!gameActive)return;clearTimeout(roundTransitionTimeout);roundTransitionTimeout=setTimeout(()=>{if(round>=TOTAL_ROUNDS)finishGame();else startCountdown(round+1);},700);
}
async function finishGame(){
 if(!isHost||!gameActive)return;gameActive=false;clearInterval(timerInterval);
 getPresencePlayers().forEach(p=>{if(scoreBoard[p.playerId])scoreBoard[p.playerId].score=Math.max(scoreBoard[p.playerId].score,p.score);else updateScoreBoard(p.playerId,p.name,p.score);});
 const leaderboard=Object.values(scoreBoard).sort((a,b)=>b.score-a.score);const winner=leaderboard[0]||{name:currentPlayer,score};
 const result={leaderboard,winnerName:winner.name,winnerScore:winner.score};showResults(result);await channel.send({type:"broadcast",event:"game-finished",payload:result});
}
function showResults(payload={}){
 gameActive=false;clearInterval(timerInterval);clearInterval(countdownInterval);const leaderboard=Array.isArray(payload.leaderboard)?payload.leaderboard:Object.values(scoreBoard);leaderboard.sort((a,b)=>b.score-a.score);
 const winner=payload.winnerName?{name:payload.winnerName,score:payload.winnerScore||0}:leaderboard[0]||{name:currentPlayer,score};
 document.getElementById("winnerName").textContent=winner.name;document.getElementById("finalScore").textContent=`${winner.score} POINTS`;
 scoreBoard={};leaderboard.forEach(p=>updateScoreBoard(p.playerId||p.name,p.name,p.score));renderLeaderboard(true);showScreen("results");
}
function playAgain(){
 if(!isHost)return alert("Ask the host to start another battle.");score=0;round=1;gameActive=true;scoreBoard={};
 getPresencePlayers().forEach(p=>updateScoreBoard(p.playerId,p.name,0));updateScoreBoard(playerId,currentPlayer,0);document.getElementById("score").textContent="0";
 channel.track({playerId,name:currentPlayer,score:0,isHost:true});channel.send({type:"broadcast",event:"game-start",payload:{round:1}});startCountdown(1);
}
window.addEventListener("beforeunload",()=>{if(channel){channel.untrack();supabaseClient.removeChannel(channel);}});
