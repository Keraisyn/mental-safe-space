const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');
// Get Username and Room from URL
const {username, room} = Qs.parse(location.search, {
  ignoreQueryPrefix: true
})
document.title = "Mental SafeSpace" + room;
const socket = io();
//Join chatroom
socket.emit('joinRoom', {username, room});

//Get room and users
socket.on('roomUsers', ({room, users}) =>{
  outputRoomName(room);
  outputUsers(users);
});
// Message from server
socket.on('message', message => {
  console.log(message);
  outputMessage(message);

  //Scroll down
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('warning', () => {
  var container = document.createElement("div");
  container.style.background = "linear-gradient(-45deg, #3Ba378,#7Be3b8)" 
  container.style.borderRadius = "20px";
  container.style.width = "50%";
  container.style.padding = "15px";
  container.style.marginBottom = "20px";
  container.style.boxShadow = "4px 4px 8px #999";
  container.id = "warning-box";
  container.innerHTML = '<p class="text-dark">You seem to be sending a lot of negative messages that seem to indicate you are experiencing mental health issues.<br><a href=https://www.mhfa.ca/en/general-resources>Here are some resources</a> that you can use to get help. Dont feel ashamed to ask for help!</p>'
  if (document.getElementById('warning-box') == undefined){
    document.getElementById("chat-messages").appendChild(container);
  }
});

//Message submit
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  //Get message text
  const msg = e.target.elements.msg.value;
  // Emit message to server
  socket.emit('chatMessage', msg);

  //Clear input
  e.target.elements.msg.value = '';
  e.target.elements.msg.focus();
})

// Output message to DOM
function outputMessage(message) {
  const div = document.createElement('div');
  div.classList.add('message');
  div.innerHTML = `<p class="meta"> ${message.username} <span>${message.time}</span></p>
  <p class="text"> ${message.text}
  </p>`;
  console.log(document.querySelector('.chat-messages').lastChild)
  if (document.querySelector('.chat-messages').children.length > 0 && document.querySelector('.chat-messages').lastChild.id == "warning-box") {
    document.querySelector('.chat-messages').insertBefore(div, document.querySelector('.chat-messages').lastChild);
  } else {
    document.querySelector('.chat-messages').appendChild(div);
  }
}

//Add room name to DOM
function outputRoomName(room){
  roomName.innerText = room;

}
// Add users to DOM
function outputUsers(users){
  userList.innerHTML = `
  ${users.map(user => `<li>${user.username}</li>`).join('')}
  `;
}