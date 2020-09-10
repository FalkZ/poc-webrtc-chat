//import qrcode from "https://jspm.dev/qrcode-generator@1.4.4";

(function () {
  // Define "global" variables

  var connectButton = null;
  var disconnectButton = null;
  var sendButton = null;
  var messageInputBox = null;
  var receiveBox = null;

  var localConnection = null; // RTCPeerConnection for our "local" connection
  var remoteConnection = null; // RTCPeerConnection for the "remote"

  var sendChannel = null; // RTCDataChannel for the local (sender)
  var receiveChannel = null; // RTCDataChannel for the remote (receiver)

  const createQR = (data, prefix) => {
    const d = `${window.location.origin}?${prefix}=${encodeURI(
      JSON.stringify(data)
    )}`;
    // autodetect
    var typeNumber = 0;
    var errorCorrectionLevel = "L";
    // var qr =  qrcode(typeNumber, errorCorrectionLevel);
    // qr.addData(d);
    // qr.make();
    const a = document.createElement("a");
    a.href = d;
    a.target = "_blank";
    a.innerHTML = "click"; //qr.createImgTag();
    document.getElementById("placeholder").appendChild(a);
  };

  // Functions

  // Set things up, connect event listeners, etc.

  function startup() {
    connectButton = document.getElementById("connectButton");
    disconnectButton = document.getElementById("disconnectButton");
    sendButton = document.getElementById("sendButton");
    messageInputBox = document.getElementById("message");
    receiveBox = document.getElementById("receivebox");

    // Set event listeners for user interface widgets

    // connectButton.addEventListener("click", connectPeers, false);
    disconnectButton.addEventListener("click", disconnectPeers, false);
    sendButton.addEventListener("click", sendMessage, false);
  }

  // Connect the two peers. Normally you look for and connect to a remote
  // machine here, but we're just connecting two local objects, so we can
  // bypass that step.

  function connectPeers() {
    // Create the local connection and its event listeners

    localConnection = new RTCPeerConnection();

    // Create the data channel and establish its event listeners
    sendChannel = localConnection.createDataChannel("sendChannel");
    sendChannel.onopen = handleSendChannelStatusChange;
    sendChannel.onclose = handleSendChannelStatusChange;

    // Create the remote connection and its event listeners

    remoteConnection = new RTCPeerConnection();
    remoteConnection.ondatachannel = receiveChannelCallback;

    // Set up the ICE candidates for the two peers

    localConnection.onicecandidate = (e) => {
      if (e.candidate) {
        if (!window.location.search) {
          createQR(
            {
              remoteConnection: localConnection.localDescription,
              candidate: e.candidate,
            },
            "offer"
          );
        }
        console.log("candidate:", e.candidate);
        remoteConnection
          .addIceCandidate(e.candidate)
          .catch(handleAddCandidateError);
      }
    };

    remoteConnection.onicecandidate = (e) => {
      if (e.candidate) {
        if (window.location.search.startsWith("?offer=")) {
          createQR(
            {
              remoteConnection: remoteConnection.localDescription,
              candidate: e.candidate,
            },
            "answer"
          );
        }
        localConnection
          .addIceCandidate(e.candidate)
          .catch(handleAddCandidateError);
      }
    };

    // Now create an offer to connect; this starts the process
    if (window.location.search.startsWith("?offer=")) {
      const o = JSON.parse(
        decodeURI(window.location.search.replace("?offer=", ""))
      );

      remoteConnection.setRemoteDescription(o.remoteConnection);

      remoteConnection.createAnswer().then((answer) => {
        // console.log("answer:", answer);
        remoteConnection.setLocalDescription(answer);
      });
    } else if (window.location.search.startsWith("?answer=")) {
      const o = JSON.parse(
        decodeURI(window.location.search.replace("?answer=", ""))
      );

      localConnection.setRemoteDescription(o.remoteConnection);
    } else {
      localConnection
        .createOffer()
        .then((offer) => {
          // console.log("offer:", offer);
          localConnection.setLocalDescription(offer);
        })

        .catch(handleCreateDescriptionError);
    }
  }

  connectPeers();

  // Handle errors attempting to create a description;
  // this can happen both when creating an offer and when
  // creating an answer. In this simple example, we handle
  // both the same way.

  function handleCreateDescriptionError(error) {
    console.log("Unable to create an offer: " + error.toString());
  }

  // Handle successful addition of the ICE candidate
  // on the "local" end of the connection.

  function handleLocalAddCandidateSuccess() {
    connectButton.disabled = true;
  }

  // Handle successful addition of the ICE candidate
  // on the "remote" end of the connection.

  function handleRemoteAddCandidateSuccess() {
    disconnectButton.disabled = false;
  }

  // Handle an error that occurs during addition of ICE candidate.

  function handleAddCandidateError() {
    console.log("Oh noes! addICECandidate failed!");
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
        sendButton.disabled = false;
        disconnectButton.disabled = false;
        connectButton.disabled = true;
      } else {
        messageInputBox.disabled = true;
        sendButton.disabled = true;
        connectButton.disabled = false;
        disconnectButton.disabled = true;
      }
    }
  }

  // Called when the connection opens and the data
  // channel is ready to be connected to the remote.

  function receiveChannelCallback(event) {
    receiveChannel = event.channel;
    receiveChannel.onmessage = handleReceiveMessage;
    receiveChannel.onopen = handleReceiveChannelStatusChange;
    receiveChannel.onclose = handleReceiveChannelStatusChange;
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
    remoteConnection.close();

    sendChannel = null;
    receiveChannel = null;
    localConnection = null;
    remoteConnection = null;

    // Update user interface elements

    connectButton.disabled = false;
    disconnectButton.disabled = true;
    sendButton.disabled = true;

    messageInputBox.value = "";
    messageInputBox.disabled = true;
  }

  // Set up an event listener which will run the startup
  // function once the page is done loading.

  window.addEventListener("load", startup, false);
})();
