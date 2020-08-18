navigator.mediaDevices =
  navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia;
if (!navigator.mediaDevices)
  navigator.mediaDevices = new Promise((resolve, reject) =>
    reject("Midia is not available")
  );

const videoGrid = document.getElementById("video-grid");
const defaultVideoSettings = { muted: false, volume: 0.4 };

let myStream = false;
let socketId = false;
let peerId = false;

const socket = io("/");
socket.on("connect", (client) =>
  console.log(`socketId: ${(socketId = socket.id)}`)
);

const peer = new Peer(undefined, { path: "/peerjs", host: "/", port: _Port });
peer.on("open", (id) => console.log(`peerId: ${(peerId = id)}`));

//request midia access
navigator.mediaDevices
  .getUserMedia({ video: true, audio: true })
  .then((stream) => {
    console.log(`streamId: ${(myStream = stream).id}`);
    safeStart();
  })
  .catch((err) => console.log(`Midia was rejected: ${err.message}`));

const safeStart = () => {
  if (myStream && socketId && peerId) return start(myStream);

  console.log("delayed start");
  const tid = setTimeout(safeStart, 100);
};

const start = (currentStream) => {
  //add my own video
  const myVideo = addVideoStream(myStream, {
    ...defaultVideoSettings,
    muted: true,
    className: "me",
  });

  console.log("attach events");

  //send a message
  const chatInput = document.getElementById('chat-input');
  chatInput.addEventListener('keydown', (event) => {
    if(event.which !== 13 || !chatInput.value)
      return;

    event.preventDefault();
    const message = chatInput.value;
    chatInput.value = '';

    console.log(message);
    socket.emit('message', {text:message});
  });

  //mute|unmute
  const mute = document.getElementById('btn-mute');
  mute.addEventListener('click', (event) => {
    const newState = !(currentStream.getAudioTracks()[0].enabled);
    currentStream.getAudioTracks()[0].enabled = newState;    
    mute.className = newState ? 'fas fa-microphone' : 'fas fa-microphone-slash';
  });

  //stop|start video
  const video = document.getElementById('btn-video');
  video.addEventListener('click', (event) => {
    const newState = !(currentStream.getVideoTracks()[0].enabled);
    currentStream.getVideoTracks()[0].enabled = newState;    
    video.className = newState ? 'fas fa-video' : 'fas fa-video-slash';
  });

  //respond to a peer calling
  peer.on("call", (call) => {
    console.log("answer a new call");
    call.answer(currentStream);
    receivingStream(call);
  });

  //stream my video to the others
  socket.on("user-connected", ({ username, userId }) => {
    console.log(`${username} has joined the room on: ${userId}`);

    //make a call to send my video
    const call = peer.call(userId, currentStream);
    receivingStream(call);
  });

  //receive a message
  const chatMessages = document.getElementById('chat-messages');
  socket.on('message', ({date, username, text}) => {
    console.log('msg',date, username, text);
    chatMessages.innerHTML += `
      <li>
        <em>${date}</em>
        <span>${username}</span>
        <p>${text}</p>
      </li>
    `;

    chatMessages.scrollTop = chatMessages.scrollHeight;
  });

  //member leave
  socket.on('disconnect', ({username, userId}) => {
    console.log(`${username} leaves the room: ${userId}`);
    const video = document.getElementById(userId);
    video && video.remove();
  });

  //join to the room
  console.log("join the room");
  socket.emit("join-room", {
    roomId: _RoomId,
    username: _UserName,
    userId: peerId,
  });
};

const addVideoStream = (stream, settings) => {
  let video = document.getElementById(settings.id);
  if (video) return video;

  console.log("add a new video");
  video = document.createElement("video");
  Object.entries({ ...settings, srcObject: stream }).forEach(
    ([key, value]) => (video[key] = value)
  );
  video.addEventListener("loadedmetadata", () => video.play());
  videoGrid.append(video);

  return video;
};

const receivingStream = (call) => {
  //receive their video when they answer to a call
  call.on("stream", (userStream) => {
    console.log("receiving a new stream", call.peer);
    addVideoStream(userStream, { ...defaultVideoSettings, id: call.peer });
  });
};
