import roomDB from "./roomDB";
import User from "../Model/account";
import { disconnect } from "cluster";
import { debuglog } from "util";
import { json } from "express";
function socket(io) {
  io.sockets.on("connection", socket => {
    console.log("socket 서버 접속 완료 ");
    socket.on("SendServer", data => {
      socket.emit("sendClient", data);
    });

    socket.on("Join", (_id) => {
      // Join part
      socket.join(_id);
      let rooms = roomDB.searchAll();
      let room = rooms.filter(value => value._id == _id);
      io.sockets.in(_id).emit("RoomLoad", room[0]);
      var MainLoad = [];
      roomDB.searchAll().forEach((data, index) => {
        MainLoad[index] = {
          _id: data._id,
          roomname: data.roomname,
          personnel: data.personnel,
          connectedUsers: data.connectedUsers,
          passwordLock: data.passwordLock,
          progress: data.progress
        };
      });

      socket.emit("sendMainRoom", MainLoad[0]);
    });

    socket.on("GameStart", (data) => {
      socket.join(data);
      var playersSpawn: Array<any> = [];
      //방 정보를 찾음
      console.log("GameStart",data)
      roomDB.searchAll().forEach((v) => {
        if(v._id == data) {
          //방에 있는 플레이어를 찾음
          v.player.forEach((p, index) => {
            //플레이어가 가지고 있는 type을 찾음
            User.findOne({nickname : p.nickname}, function(error, result) {
              if(error) throw error;
              playersSpawn[index] = {
                nickname : p.nickname,
                spawnPoint : index,
                type : result.userdata
              };

              console.log("Create Player " + playersSpawn);
              io.sockets.in(data).emit("CreatePlayers", {value : playersSpawn[index]});
            });
          });
        }
      });
    });

    socket.on("MainLoad", data => {
      var MainLoad = [];
      roomDB.searchAll().forEach((data, index) => {
        MainLoad[index] = {
          _id: data._id,
          roomname: data.roomname,
          personnel: data.personnel,
          connectedUsers: data.player.length,
          passwordLock: data.passwordLock,
          progress: data.progress
        };
      });
      socket.emit("sendMainRoom", { value: MainLoad });
    });

    socket.on("sendMessage", data => {
      var tmp = JSON.parse(data);
      console.log(tmp);
      console.log(tmp.id);
      io.sockets.in(tmp.id).emit("getMessage", data);
    });

    socket.on("RoomLeave", data => {
      var _d = JSON.parse(data);
      LeaveRoom(_d.id, _d.nickname, _d.master);
    });

    socket.on("LeavePlayer", (data) => {
      var _d = JSON.parse(data);
      io.sockets.in(_d._id).emit("LeavePlayers", data);
    });

    //Old Ver
    // socket.on("SendStart", data => {
    //   console.log(data);
    //   io.sockets.in(data).emit("GetStart", true);
    // });
    // socket.on("SendScore", data => {
    //   const dataArray = data.split("/");
    //   let getArray = [];
    //   getArray = roomDB.score(dataArray);
    //   io.sockets.in(dataArray[0]).emit("GetScore", { value: getArray });
    // });

    // socket.on("SendPlayerState", data => {
    //   const dataArray = data.split("/");
    //   io.sockets.in(dataArray[0]).emit("GetPlayerState", dataArray[1]);
    // });
    // socket.on("SendGameTime", data => {
    //   const dataArray = data.split("/");
    //   io.sockets.in(dataArray[0]).emit("GetGameTime", dataArray[1]);
    // });
    // socket.on("GameOver", data => {
    //   const password = roomDB.password(data);
    //   io.sockets.in(data).emit("GetGameOver", true);
    // });
    // socket.on("SendSpawnObj", data => {
    //   const dataArray = data.split("/");
    //   io.sockets.in(dataArray[0]).emit("GetSpawnObj", dataArray[1]);
    // });
    // socket.on("PlayerSpawnPoint", data => {
    //   const dataArray = data.split("/");
    //   io.sockets.in(dataArray[0]).emit("GetPlayersData", dataArray[1]);
    // });

    //GameStart
    //client -> data(Room ID) / server -> Users Spawn Point

    //PlayerState
    socket.on("PlayerState", (data) => {
      var _d = JSON.parse(data);
      io.sockets.in(_d._id).emit("PlayersState", data);
    });

    //CreateBullet
    socket.on("CreateBullet", (data) => {
      var _d = JSON.parse(data);
      console.log(_d.bulletID);
      io.sockets.in(_d._id).emit("CreatedBullet", data);
    });

    //DestroyBullet
    socket.on("DestroyBullet", (data) => {
      var _d = JSON.parse(data);
      io.sockets.in(_d._id).emit("DestroyedBullet", data);
    });

    //DeathPlayer
    socket.on("DeathPlayer", (data) => {
      var _d = JSON.parse(data);
      var score;
      //스코어 처리
      if(!(_d.who === _d.whoKill))
         score = roomDB.score(_d);
      else
        score = roomDB.getScore(_d);
      //who : 죽은 사람, whoKill : 죽인 사람, spawnPoint : 다시 부활할 위치, score : 현재 스코어
      var send = {
        _id : _d._id,
        who : _d.who,
        spawnPoint : Math.floor(Math.random() * (4 - 1)) + 1,
        score : score 
      };

      //게임 종료시 최종 스코어 전송
      if(Check_GameOver(send))
        io.sockets.in(send._id).emit("GameOver", score);
      else
        io.sockets.in(send._id).emit("DeathPlayers", send);
    });

    //Timer
    socket.on("GameTimer", (data) => {
      var _d = JSON.parse(data);

      if(Check_GameOver(_d))
        io.sockets.in(_d._id).emit("GameOver", roomDB.getScore(_d._id));
      else
        io.sockets.in(_d._id).emit("CurrentGameTimer", data);
    });

    socket.on("disconnect", data => {
      var _ip = socket.handshake.address;
      
      var room_id = "";
      var _nick = "";
      var _master = false;

      console.log("Socket Disconnected / " + _ip);
      roomDB.searchAll().forEach((value) => {
        console.log(value._id);

        value.player.forEach(p => {
          if(p.ip == _ip) {
            room_id = value._id;
            _nick = p.nickname;
            _master = p.master;
          }
        });

        console.log(room_id + " / " + _nick + " audo leave room . . .");

        LeaveRoom(room_id, _nick, _master);
      });
    });

    function LeaveRoom(_id, _nick, _master) {
      roomDB.leave({_id:_id, nickname : _nick, master : _master});

      io.sockets.in(_id).emit("LeavePlayers", {_id : _id, id : _id, nickname : _nick});
      
      io.sockets.in(_id).emit("getLeaveMessage", _nick);
          socket.leave(_id);
          const room = roomDB
            .searchAll()
            .filter(value => value._id == _id);
    
          io.sockets.in(_id).emit("RoomLoad", room[0]);
          var MainLoadAll = MainLoad();
          socket.emit("sendMainRoom", MainLoadAll);
      }
  });
}

function MainLoad() {
  var MainLoad = [];
  roomDB.searchAll().forEach((data, index) => {
    MainLoad[index] = {
      _id: data._id,
      roomname: data.roomname,
      personnel: data.personnel,
      connectedUsers: data.connectedUsers,
      passwordLock: data.passwordLock,
      progress: data.progress
    };
  });
  return MainLoad;
}

function Check_GameOver(data) {
  //Check Score
  if(data.score) {
    var score = data.score;
    for(var i = 0; i < score.length; i++) {
      if(score[i].score >= 5) {
        console.log("GameOver / " + data + " / Max Score");
        return true;
      }
    }

    return false; 
  }

  //Check Time
  if(data.timer) {
    if(data.timer <= 0) {
      console.log("GameOver / " + data + " / Time Over");
      return true;
    }
    else {
      //console.log(data);
      return false;
    }
  }

  //Data Error
  else{
    console.log("Data Error / " + data);
    return false;
  }
}

export default socket;
