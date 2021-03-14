const dgram = require("dgram");
const server = dgram.createSocket("udp4");

const hosts = {
  //声明host
  "a.b.com": "127.0.0.1", //自定义
};

const fbSer = "114.114.114.114"; //默认DNS服务器

function forward(msg, rinfo) {
  const client = dgram.createSocket("udp4");
  client.on("error", (err) => {
    console.log(`client error:` + err.stack);
    client.close();
  });
  client.on("message", (fMsg, fbRinfo) => {
    server.send(fMsg, rinfo.port, rinfo.address, (err) => {
      err && console.log(err);
    });
    client.close();
  });
  console.log('forward:', msg)
  client.send(msg, 53, fbSer, (err) => {
    if (err) {
      console.log(err);
      client.close();
    }
  });
}

function parseHost(msg) {
  //转换域名
  let num = msg[0];
  let offset = 1;
  let host = "";
  while (num !== 0) {
    host += msg.slice(offset, offset + num).toString();
    offset += num;
    num = msg[offset] || 0;
    offset += 1;
    if (num !== 0) host += ".";
  }
  return host;
}

function resolve(ip, msg, rinfo) {
  //响应
  let len = msg.length;
  let template = [192, 12, 0, 1, 0, 1, 0, 0, 0, 218, 0, 4].concat(
    ip.split(".").map((i) => Number(i))
  ); //<===可以自定义
  const response = new ArrayBuffer(len + 16);
  var bufView = new Uint8Array(response);
  for (let i = 0; i < msg.length; i++) bufView[i] = msg[i];
  for (let i = 0; i < template.length; i++) bufView[msg.length + i] = template[i];
  bufView[2] = 129;
  bufView[3] = 128;
  bufView[7] = 1;
  console.log("resolve bufView:", bufView, ip);
  server.send(bufView, rinfo.port, rinfo.address, (err) => {
    if (err) {
      console.log(err);
      server.close();
    }
  });
}

server.on("message", (msg, rinfo) => {
  console.log("msg========================", msg, rinfo);
  let host = parseHost(msg.slice(12));
  let ip = hosts[host];
  console.log("host:" + host, JSON.stringify(msg));
  if (ip) {
    resolve(ip, msg, rinfo); //解析与响应
  } else {
    forward(msg, rinfo); //转发
  }
});

server.on("error", (err) => {
  console.log("server error:" + err.stack);
  server.close();
});
server.on("listening", () => {
  const addr = server.address();
  console.log(`run ${addr.address}:${addr.port}`);
});
server.bind(53);
