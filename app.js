var express = require('express'), 
app = express(),
http = require('http'),
socketIo = require('socket.io'),
path= require('path');

var server = http.createServer(app);
var io = socketIo.listen(server);

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));

const port = 8080;
server.listen(port);
app.use(express.static(__dirname + '/public'));
console.log("Server running on port:"+ port);

app.use(express.static(path.join(__dirname, "public")));

var users = {};
var userslst =[]; //this is just so we can keep the current structure of choosing the next player
var currJudge = 0;

var prompts = ['What do old people smell like?', 'What gets better with age?', 'Sorry everyone, I just _________.', 'White people like _______.', 'I drink to forget ________.', 'Whats that sound?', 'Why am I sticky?'];
var randNum;

function newPrompt(){
	randNum = Math.floor(Math.random()*prompts.length);
	return prompts[randNum];
}

var currPrompt = "";
var userJudging = "";

app.get('/', function(req, res) {
	res.sendFile('home.html', { root: path.join(__dirname, 'public') });
});

app.post('/', function (req, res) {
	let username = req.body.username;
	res.sendFile('game.html', { root: path.join(__dirname, 'public') });
});

var countdown = 30;
setInterval(function() {
	countdown--;
	io.sockets.emit('timer', {
		countdown: countdown
	});
	if (countdown <= 0){
		io.sockets.emit('chat message',"new judge");
		io.sockets.in(userslst[currJudge]).emit('timesUp');
		// io.sockets.emit('resetTimer');
	}
}, 1000);

io.on('connection', function (socket) {
	userslst.push(socket.id);
	var username = "";
	socket.emit('username');
	socket.on('username', function(name){
		// username = name;
		var line_history = [];
		users[socket.id] = {username: name, line_history: [], score: 0};
		console.log(users);
		// socket.emit('yourself', "Your id: " + socket.id);
		

		//joins specific room
		if(io.sockets.adapter.rooms["judge"] === undefined){
			socket.join("judge");
			io.in(socket.id).emit("chat message", "You are judging");
			currPrompt = newPrompt();
			// userJudging = socket.id;
			userJudging = users[socket.id].username;
		} else{
			socket.join("player");
			io.in(socket.id).emit("chat message", "You are playing");
		}
		userJudging = users[userslst[currJudge]].username;
		socket.emit('prompt', "Prompt: " + currPrompt);
		socket.emit("chat message", userJudging + " is judging");
		io.to('player').emit('draw');
	})
	

	//disconnect
	socket.on('disconnect', function(){
		//takes the player out of the users array
		for (var i=0; i < userslst.length; i++){
			if (userslst[i] == socket.id){
				userslst.splice(i,1);
			};
		};
		delete users[socket.id]; //is this a good way to delete? 

		//adds the next user to the judging room
		if (io.sockets.adapter.rooms["judge"] === undefined) {
			if(userslst[currJudge] === undefined){
				currJudge=0;
			}
			// socket.emit('chat message', socket.id + " is judging!");
			io.in(userslst[currJudge]).emit('new judge', userslst[currJudge]);
		};
	});

	socket.on('timesUp', function(){
		// var cj = userslst[currJudge];
		// socket.emit('chat message', 'Times Up. Current Judge is ' + cj.username);

		socket.leave('judge');
		socket.join('player');
		socket.emit('clear chat');
		io.in(userslst[currJudge]).emit('chat message', "You are playing");

		console.log('curr judge', currJudge)
		if(userslst[currJudge+1] === undefined){
				currJudge=0;
		} else{
			currJudge++;
		}
		console.log('curr judge', currJudge)
		io.in(userslst[currJudge]).emit('new judge', userslst[currJudge]);
		// socket.emit('resetTimer');
	})

	//if the current judge leaves the game, then the games moves on to the next judge and the round
	socket.on('new judge', function(name) {
		socket.leave('player');
		socket.join('judge');
		userJudging = socket.id;
		socket.emit('clear chat');
		io.in(userslst[currJudge]).emit('chat message', "You are judging");
		currPrompt = newPrompt();
		socket.emit('prompt', "Prompt: " + currPrompt);
		for(var i=0; i<userslst.length; i++){
			io.in(userslst[i]).emit('clear');
		}
		socket.emit('resetTimer');
		io.to('player').emit('chat message', 'PLAYER');
		io.to('judge').emit('chat message', 'JUDGE');
	});

	// io.emit('some event', { for: 'everyone' });
	//drawing
	//for (var i in line_history) {
	// 	// socket.emit('draw_line', { line: line_history[i] } );
	// }

	socket.on('draw_line', function (data) {
		var curr = users[socket.id].line_history;
		curr.push(data.line);
		// console.log(users[socket.id].line_history)
		// users[socket.id].line_history.push(data.line);
		io.in(socket.id).emit('draw_line', { line: data.line } );
	});

	socket.on('clear', function(){
		line_history=[];
		console.log("clear");
	});

	socket.on('resetTimer', function(data){
		countdown = 30;
		io.sockets.in(userslst[currJudge]).emit('timer', {
			countdown: countdown
		});
	});
});