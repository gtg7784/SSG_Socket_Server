import * as shortid from "shortid";
import { Request, Response } from "express";
import Send from "../../Module/Send";
import roomDB from "../../Module/roomDB";

export const Create = (req: Request, res: Response) => {
  const { _id, roomname, nickname, userdata, password, personnel, ip } = req.body;

  console.log('req.body', req.body);

  if(roomDB.searchAll().length > 0){
    const join = roomDB.join({
      _id,
      password,
      nickname,
      userdata,
      ip
    });
  
    console.log(join);
  
    Send(res, 200, join, join == "성공적으로 방에 입장하셨습니다" ? true : false);
  } else {
    const random: string = shortid.generate();
    //이 사이에는 방 인원수 제한등등을 구현
    roomDB.push({
      _id: random,
      roomname,
      personnel,
      connectedUsers: 1,
      passwordLock: password ? true : false,
      password,
      progress: false,
      player: [
        {
          nickname,
          master: true,
          score: 0,
          ip : ip
        }
      ]
    });
    Send(res, 200, random, true);
  }
};

export const Join = (req: Request, res: Response) => {
  const { _id, password, roomname, personnel, nickname, userdata, ip } = req.body;
  console.log('req.body', req.body);

  // const join = roomDB.join({
  //   _id,
  //   password,
  //   nickname,
  //   userdata,
  //   ip
  // });

  // console.log(join);

  // Send(res, 200, join, join == "성공적으로 방에 입장하셨습니다" ? true : false);

  if(roomDB.searchAll().length > 0){
    const roomId = roomDB.searchAll()[0]._id;
    const join = roomDB.join({
      _id: roomId,
      password,
      nickname,
      userdata,
      ip
    });
  
    console.log(join);

    res.status(200).send({ roomId: roomId, result: true }).end();
  
    // Send(res, 200, join, join == "성공적으로 방에 입장하셨습니다" ? true : false);
  } else {
    const random: string = shortid.generate();
    //이 사이에는 방 인원수 제한등등을 구현
    roomDB.push({
      _id: random,
      roomname,
      personnel,
      connectedUsers: 1,
      passwordLock: password ? true : false,
      password,
      progress: false,
      player: [
        {
          nickname,
          master: true,
          score: 0,
          ip : ip
        }
      ]
    });

    res.status(200).send({ roomId: random , result: true}).end();
  }
};

export const Leave = (req: Request, res: Response) => {
  const { _id, nickname, master } = req.body;
  const leaveMes = roomDB.leave({ _id, nickname, master });
  Send(res, 200, "방을 성공적으로 나가셨습니다", true);
};
export const Start = (req: Request, res: Response) => {
  const { _id } = req.body;
  roomDB.start({ _id });
  Send(res, 200, "게임 방 입장 성공", true);
};
export const All = (req: Request, res: Response) => {
  const list = roomDB.searchAll();
  res.status(200).send(list);
};
