const socket = io('/')
const videoGrid = document.getElementById('video-grid')
let peer = new Peer(undefined, {
    path: '/peerjs',
    host: '/',
    port: '443'
})

let newUser = username;

let myVideoStream
const myVideo = document.createElement('video')
myVideo.muted = true;
const peers = {}
navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
}).then(stream => {
    myVideoStream = stream;
    addVideoStream(myVideo, stream)

    peer.on('call', call => {
        call.answer(stream)
        const video = document.createElement('video')

        call.on('stream', userVideoStream => {
            addVideoStream(video, userVideoStream)
        })
    })

    socket.on('user-connected', (userId) => {
        connectToNewUser(userId, stream);
    })

    let text = $('input')
    $('html').keydown((e) => {
        console.log("key down")
        if (e.which == 13 && text.val().length !== 0) {
            console.log(text.val())
            socket.emit('message', text.val());
            text.val('')
        }
    });


    socket.on('createMessage', message => {
        console.log("new message is ", message)
        $('ul').append(`<li class="message"><b>${newUser}</b><br/>${message} </li>`)
        scrollToButtom()
    })
})

socket.on('user-disconnected', userId => {
    if (peers[userId]) peers[userId].close()
})

peer.on('open', id => {
    socket.emit('join-room', ROOM_ID, id)
})

// socket.emit('join-room', ROOM_ID);
// console.log("Room ID is ",ROOM_ID)

//connect  a new user
const connectToNewUser = (userId, stream) => {
    const call = peer.call(userId, stream)
    const video = document.createElement('video')
    call.on('stream', userVideoStream => {
        addVideoStream(video, userVideoStream)
    })
    call.on('close', () => {
        video.remove()
    })

    peers[userId] = call
}

const addVideoStream = (video, stream) => {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play()
    })
    videoGrid.append(video)
}

//always scroll chat section to bottom
const scrollToButtom = () => {
    let d = $('.main_chat_window');
    d.scrollTop(d.prop("scrollHeight"));
}

//mute and unmute user audio
const muteUnmute = () => {
    const enabled = myVideoStream.getAudioTracks()[0].enabled;

    if (enabled) {
        myVideoStream.getAudioTracks()[0].enabled = false;
        setMuteButton();
    } else {
        setUnmuteButton();
        myVideoStream.getAudioTracks()[0].enabled = true;
    }
}

//Video control section 
//Play stop video

const playStop = () => {
    console.log("Got here ")
    let enabled = myVideoStream.getVideoTracks()[0].enabled;
    if (enabled) {
        myVideoStream.getVideoTracks()[0].enabled = false;
        setStopVideo()
    } else {
        setPlayVideoIcon()
        myVideoStream.getVideoTracks()[0].enabled = true;
    }
}

const setMuteButton = () => {
    //unmute
    const html = `
        <i class="unmute fas fa-microphone-slash"></i>
        <span></span>        
    `
    document.querySelector('.main_mute_button').innerHTML = html;
}

const setUnmuteButton = () => {
    //Mute
    const html = `
    <i class="fas fa-microphone"></i>
    <span></span>
  `
    document.querySelector('.main_mute_button').innerHTML = html;
}




const setStopVideo = () => {
    //Show Video
    const html = `
  <i class="stop fas fa-video-slash"></i>
    <span></span>
  `
    document.querySelector('.main_video_button').innerHTML = html;
}

const setPlayVideoIcon = () => {
    //Stop video
    const html = `
    <i class="fas fa-video"></i>
    <span></span>
  `
    document.querySelector('.main_video_button').innerHTML = html;
}


const hideChat = () => {
    let chatWindow = document.querySelector(".main_right")
    let mainLeftWindow = document.querySelector(".main_left")
    let mainChatWindow = document.querySelector(".main_chat_window")
    let mainMessageContainer = document.querySelector(".main_message_container")
    let messageInput = document.querySelector(".main_message_container input")

    if (chatWindow.style.display == 'none') {
        mainLeftWindow.style.cssText += 'flex: 0.8; display: flex; flex-direction: column;'
        chatWindow.style.cssText += 'display: flex; flex: 0.2 '
        mainChatWindow.style.cssText = 'flex-grow: 1; overflow-y: auto;'
        //messageInput.style.cssText = 'flex-grow: 1; background-color: transparent; border: none; color: #f5f5f5;'

    } else {
        mainLeftWindow.style.cssText = 'flex: 1; display: flex; flex-direction: column;'
        chatWindow.style.cssText += 'flex: 0; display: none'
    }



}