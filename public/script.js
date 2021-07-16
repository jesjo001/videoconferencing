const socket = io('/')
const videoGrid = document.getElementById('video-grid')
const userGrid = document.getElementById('userAreas');

let peer = new Peer(undefined, {
    path: '/peerjs',
    host: '/',
    port: '443'
})

let newUser = username;
let userMail = userEmail;

let myVideoStream
const myVideo = document.createElement('video')
myVideo.muted = true;
const peers = {}
let videoConstraint = {
    video: true,
    audio: true
}
navigator.mediaDevices.getUserMedia(videoConstraint)
    .then(stream => {
        myVideoStream = stream;
        addVideoStream(myVideo, myVideoStream)

        peer.on('call', call => {
            call.answer(stream)
            const video = document.createElement('video')

            call.on('stream', userVideoStream => {
                addVideoStream(video, userVideoStream)
                attachUser(newUser)
            })
        })

        socket.on('user-connected', (userId) => {
            connectToNewUser(userId, myVideoStream);
            attachUser(newUser)
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
    let userId = id
    console.log("userid is ", userId)
    socket.emit('join-room', ROOM_ID, id)
    attachUser(newUser)
})

const attachUser = (newUser) => {
    console.log("user is ", newUser)
    $('.userArea').append(`<li class="user_list">${newUser} <br /> <small> ${userMail}</small> </li>`)
    // let html = `<li class="user_list">${newUser} </li>`
    // document.querySelector('.userArea').innerHTML = html;
}


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

    let html = `<i class="fas fa-comment-alt" aria-hidden="true"></i>`
    let userHtml = '<i class="fas fa-user-friends" aria-hidden="true"></i>';
    let settingIcon = '<i class="fas fa-shield-alt" aria-hidden="true"></i>';

    let chatWindow = document.querySelector(".main_right")
    let mainLeftWindow = document.querySelector(".main_left")
    let userWindow = document.querySelector('.main_right_users')
    let settingsWindow = document.querySelector(".main_right_settings")

    if (userWindow.style.display !== 'none') userWindow.style.cssText = "flex: 0; display: none"
    if (settingsWindow.style.display !== 'none') settingsWindow.style.cssText = "flex: 0; display: none"

    if (chatWindow.style.display == 'none') {
        userWindow.style.display = 'display: none'
        chatWindow.style.cssText = 'display: flex; flex: 0.2 '
        mainLeftWindow.style.cssText = 'flex: 0.8; display: flex; flex-direction: column;'

        html = `<i class="fas fa-comment-alt stop"></i>`;
        document.querySelector('.comment').innerHTML = html;
        document.querySelector(".users").innerHTML = userHtml;
        document.querySelector('.settings').innerHTML = settingIcon;
    } else {
        mainLeftWindow.style.cssText = 'flex: 1; display: flex; flex-direction: column;'
        chatWindow.style.cssText += 'flex: 0; display: none'
        document.querySelector('.comment').innerHTML = html;
        console.log("display is not none");
    }
}


const toogleUsers = () => {

    let userIconHtml = '<i class="fas fa-user-friends" aria-hidden="true"></i>';
    let chatHtml = '<i class="fas fa-comment-alt" aria-hidden="true"></i>'
    let settingIcon = '<i class="fas fa-shield-alt" aria-hidden="true"></i>';

    let chatWindow = document.querySelector(".main_right")
    let mainLeftWindow = document.querySelector(".main_left")
    let userWindow = document.getElementById('userArea')
    let settingsWindow = document.querySelector(".main_right_settings")


    if (chatWindow.style.display !== 'none') chatWindow.style.cssText = 'flex: 0; display: none'
    if (settingsWindow.style.display !== 'none') settingsWindow.style.cssText = 'flex: 0; display: none'
    if (userWindow.style.display === 'none') {
        // then activate users window
        chatWindow.style.cssText = ' display: none'
        userWindow.style.cssText = 'display: flex; '
        mainLeftWindow.style.cssText = 'flex: 0.8; display: flex; flex-direction: column;'

        userIconHtml = `<i class="fas fa-user-friends stop"></i>`;
        document.querySelector('.users').innerHTML = userIconHtml;
        document.querySelector('.comment').innerHTML = chatHtml;
        document.querySelector('.settings').innerHTML = settingIcon;

    } else {

        //deactivate Chat window and activate users window
        userWindow.style.cssText = 'flex: 0; display: none'
        mainLeftWindow.style.cssText = 'flex: 1; display: flex; flex-direction: column;'

        userIconHtml = `<i class="fas fa-user-friends"></i>`;
        document.querySelector('.users').innerHTML = userIconHtml;
        console.log("display is not none")
    }
}

const toggleSettings = () => {

    let userIconHtml = '<i class="fas fa-user-friends" aria-hidden="true"></i>';
    let chatHtml = '<i class="fas fa-comment-alt" aria-hidden="true"></i>'
    let settingIcon = '<i class="fas fa-shield-alt" aria-hidden="true"></i>';

    let chatWindow = document.querySelector(".main_right")
    let mainLeftWindow = document.querySelector(".main_left")
    let userWindow = document.querySelector('.main_right_users')

    let settingsWindow = document.querySelector(".main_right_settings")

    if (chatWindow.style.display !== 'none') chatWindow.style.cssText = 'flex: 0; display: none'
    if (userWindow.style.display !== 'none') userWindow.style.cssText = "flex: 0; display: none"


    if (settingsWindow.style.display === 'none') {
        console.log("Activating Setting area")
        userWindow.style.cssText = 'display: none'
        settingsWindow.style.cssText = 'display: flex; flex:0..2 '
        mainLeftWindow.style.cssText = 'flex: 0.8; display: flex; flex-direction: column;'

        settingIcon = '<i class="fas fa-shield-alt stop" aria-hidden="true"></i>';
        document.querySelector('.users').innerHTML = userIconHtml;
        document.querySelector('.comment').innerHTML = chatHtml;
        document.querySelector('.settings').innerHTML = settingIcon;
    } else {
        console.log()
        mainLeftWindow.style.cssText = 'flex: 1; display: flex; flex-direction: column;'
        settingsWindow.style.cssText = 'flex: 0; display: none; '

        document.querySelector('.settings').innerHTML = settingIcon;
    }
}

//Modal for username upon entering chat
// if (newUser === "user") {
//     console.log("user needs a dialog")

//     $('#settingsModal').modal({
//         keyboard: false,
//         show: true,
//         backdrop: 'static'
//     })
// }

const setSupportedConstraints = () => {
    let constraintList = document.getElementById("sendVideoResolution");
    let supportedConstraints = navigator.mediaDevices.getSupportedConstraints();

    for (let constraint in supportedConstraints) {
        if (supportedConstraints.hasOwnProperty(constraint)) {
            let elem = document.createElement("option", { value: constraint });
            const newContent = document.createTextNode(`${constraint}`);
            elem.appendChild(newContent);
            constraintList.appendChild(elem);
        }
    }

}


const changeVideoSettings = () => {
    const senderVideoSelect = document.getElementById('sendVideoResolution');
    const receiveVideoSelect = document.getElementById('receiveVideoRes')

    //get form value
    const selectedValue = senderVideoSelect.value
    //get users video track
    const videoTracks = myVideoStream.getVideoTracks()[0];
    //set constraints for user video with selected value
    let videoConstraint = { "height": parseInt(selectedValue) }
    //apply Constraint to video track
    setConstraints(videoTracks, videoConstraint)
}


const setConstraints = (videoTracks, videoConstraint) => {

    videoTracks.applyConstraints(videoConstraint)
        .then(() => {
            // Do something with the track such as using the Image Capture API.
            console.log("applied")
            console.log(videoTracks.getSettings())
        })
        .catch(e => {
            // The constraints could not be satisfied by the available devices.
            console.log("Error", e)
        });
}