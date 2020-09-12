// import { default as t } from "https://jspm.dev/esserializer";

// const { serialize, deserialize } = t;

const messageInputBox = document.getElementById("message");
const receiveBox = document.getElementById("receivebox");

// Functions

// Set things up, connect event listeners, etc.

messageInputBox.addEventListener(
  "keypress",
  (e) => {
    if (e.key === "Enter") sendMessage(e);
  },
  false
);

// Connect the two peers. Normally you look for and connect to a remote
// machine here, but we're just connecting two local objects, so we can
// bypass that step.

// Create the local connection and its event listeners

const localConnection = new RTCPeerConnection();

window.setAnswer = ({ answer, candidate }) => {
  const o = {
    answer,
    offer: localConnection.localDescription,
    candidate,
  };
  // console.log(JSON.stringify(JSON.stringify(o)), o);
  localConnection
    .setRemoteDescription(answer)
    .then(() => localConnection.addIceCandidate(candidate))
    .then(() =>
      console.log(JSON.stringify(JSON.stringify(o)), o, localConnection)
    )
    .catch(console.error);
};

window.applyConfig = (str) => {
  const { offer, answer, candidate } = JSON.parse(str);
  localConnection.setLocalDescription(offer);
  localConnection.setRemoteDescription(answer);
  localConnection.addIceCandidate(candidate);
};
let once = true;

// Create the data channel and establish its event listeners
const sendChannel = localConnection.createDataChannel("sendChannel");
sendChannel.onopen = handleSendChannelStatusChange;
sendChannel.onclose = handleSendChannelStatusChange;

let receiveChannel;

localConnection.ondatachannel = // Called when the connection opens and the data
  // channel is ready to be connected to the remote.

  (event) => {
    receiveChannel = event.channel;
    receiveChannel.onmessage = handleReceiveMessage;
    receiveChannel.onopen = handleReceiveChannelStatusChange;
    receiveChannel.onclose = handleReceiveChannelStatusChange;
  };

if (opener) {
  // 2. Tab

  opener.offerCreated
    .then((offer) => localConnection.setRemoteDescription(offer))
    .then(() => localConnection.createAnswer())
    .then((answer) =>
      localConnection.setLocalDescription(answer).then(() => answer)
    )
    .then((answer) => {
      localConnection.onicecandidate = ({ candidate }) => {
        if (candidate && once) {
          once = false;
          opener.setAnswer({ answer, candidate });
        }
      };
    })
    .catch(console.error);
} else {
  // 1. Tab

  window.offerCreated = localConnection
    .createOffer()
    .then((offer) =>
      localConnection.setLocalDescription(offer).then(() => offer)
    );
}

// Handles clicks on the "Send" button by transmitting
// a message to the remote peer.

function sendMessage() {
  var message = messageInputBox.value;
  sendChannel.send(message);

  // Clear the input box and re-focus it, so that we're
  // ready for the next message.

  messageInputBox.value = "";
  messageInputBox.focus();
}

// Handle status changes on the local end of the data
// channel; this is the end doing the sending of data
// in this example.

function handleSendChannelStatusChange(event) {
  if (sendChannel) {
    var state = sendChannel.readyState;

    if (state === "open") {
      messageInputBox.disabled = false;
      messageInputBox.focus();
      messageInputBox.style.borderBottomColor = "green";
    } else {
      messageInputBox.disabled = true;
      messageInputBox.style.borderBottomColor = "red";
    }
  }
}

// Handle onmessage events for the receiving channel.
// These are the data messages sent by the sending channel.

function handleReceiveMessage(event) {
  var el = document.createElement("p");
  var txtNode = document.createTextNode(event.data);

  el.appendChild(txtNode);
  receiveBox.appendChild(el);
}

// Handle status changes on the receiver's channel.

function handleReceiveChannelStatusChange(event) {
  if (receiveChannel) {
    console.log(
      "Receive channel's status has changed to " + receiveChannel.readyState
    );
  }

  // Here you would do stuff that needs to be done
  // when the channel's status changes.
}

// Close the connection, including data channels if they're open.
// Also update the UI to reflect the disconnected status.

function disconnectPeers() {
  // Close the RTCDataChannels if they're open.

  sendChannel.close();
  receiveChannel.close();

  // Close the RTCPeerConnections

  localConnection.close();
}
