const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIO = require('socket.io');
require('dotenv').config();

const corsOptions = {
  origin: '*'
};

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 1e8, // Set the maximum buffer size to 100MB (adjust as needed)
});

app.use(cors(corsOptions));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello from the server");
});

const socket_File_Sender_Mapping = {};


io.on('connection', (socket) => {
  console.log('A user connected', socket.id);
  socket.emit("ConnectionEstablished", socket.id);
  
  // Sent by sender to inform backend that a file has been uploaded and ready to be sent
  socket.on("fileReadyToUpload",({ fileName,fileSize,recievingLink,senderSocketId,recieverSocketId,currentIndex,totalIndexes})=>{
    socket_File_Sender_Mapping[recievingLink] = {
      fileName,fileSize,recievingLink,senderSocketId,recieverSocketId,currentIndex,totalIndexes
    }
  })

  //Sent by reciever to validate the recieverString
  socket.on("validateRecieverStringAsk",(recievingLink)=>{
    if(socket_File_Sender_Mapping[recievingLink] && socket_File_Sender_Mapping[recievingLink]["recieverSocketId"].length==0)
    {
      socket.emit("validateRecieverStringReply",{...socket_File_Sender_Mapping[recievingLink],isValid:true})
    }
    else
    {
      socket.emit("validateRecieverStringReply",{isValid:false})  
    }
  })

  //Sent by reciever to append it's socket id in recieverSocektId
  socket.on("updateRecieverSocketId",({recieverSocketId,recievingLink})=>{
    socket_File_Sender_Mapping[recievingLink]["recieverSocketId"]=recieverSocketId;
  })

  //Sent by reciever to request to start recieveing files
  socket.on("sendMeFile",({index,recievingLink})=>{
    socket_File_Sender_Mapping[recievingLink]["currentIndex"] = index; //requested for this index
    io.to(socket_File_Sender_Mapping[recievingLink]["senderSocketId"]).emit("sendFileToReciever",{
      index,recievingLink
    }) 
  })   
   
  //Sent by sender sending file data
  socket.on("sendingTheChunk",({fileData,index,recievingLink})=>{
    io.to(socket_File_Sender_Mapping[recievingLink]["recieverSocketId"]).emit("recieveTheChunk",{fileData,index,recievingLink});
  })   

  socket.on('disconnect', () => { 
    console.log(`User disconnected : ${socket.id}`);
    let keyToDelete = Object.values(socket_File_Sender_Mapping).filter((ele)=>ele.senderSocketId == socket.id)
    if(keyToDelete.length)
    {
      delete socket_File_Sender_Mapping[keyToDelete[0]["recievingLink"]]
    }
  });
}); 


const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`); 
});
