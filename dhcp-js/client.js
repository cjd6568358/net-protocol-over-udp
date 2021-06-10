const { random, strChunk } = require("../util/index");
const SERVER_PORT = 67;
const CLIENT_PORT = 68;

// op       8bit 1：请求报文 2：应答报文
// htype    8bit DHCP客户端的MAC地址类型。MAC地址类型其实是指明网络类型。htype值为1时表示为最常见的以太网MAC地址类型。
// hlen     8bit DHCP客户端的MAC地址长度。以太网MAC地址长度为6个字节，即以太网时hlen值为6。
// hops     8bit DHCP报文经过的DHCP中继的数目，默认为0。DHCP请求报文每经过一个DHCP中继，该字段就会增加1。没有经过DHCP中继时值为0。(若数据包需经过router传送，每站加1，若在同一网内，为0。)
// xid      4*8bit 客户端通过DHCP Discover报文发起一次IP地址请求时选择的随机数，相当于请求标识。用来标识一次IP地址请求过程。在一次请求中所有报文的Xid都是一样的。
// secs     2*8bit DHCP客户端从获取到IP地址或者续约过程开始到现在所消耗的时间，以秒为单位。在没有获得IP地址前该字段始终为0。(DHCP客户端开始DHCP请求后所经过的时间。目前尚未使用，固定为0。)
// flags    2*8bit 标志位，只使用第0比特位，是广播应答标识位，用来标识DHCP服务器应答报文是采用单播还是广播发送，0表示采用单播发送方式，1表示采用广播发送方式。其余位尚未使用。(即从0-15bits，最左1bit为1时表示server将以广播方式传送封包给client。)
// ciaddr   4*8bit DHCP客户端的IP地址。仅在DHCP服务器发送的ACK报文中显示，因为在得到DHCP服务器确认前，DHCP客户端是还没有分配到IP地址的。在其他报文中均显示，只有客户端是Bound、Renew、Rebinding状态，并且能响应ARP请求时，才能被填充。
// yiaddr   4*8bit DHCP服务器分配给客户端的IP地址。仅在DHCP服务器发送的Offer和ACK报文中显示，其他报文中显示为0。
// siaddr   4*8bit 下一个为DHCP客户端分配IP地址等信息的DHCP服务器IP地址。仅在DHCP Offer、DHCP ACK报文中显示，其他报文中显示为0。(用于bootstrap过程中的IP地址)
// giaddr   4*8bit DHCP客户端发出请求报文后经过的第一个DHCP中继的IP地址。如果没有经过DHCP中继，则显示为0。(转发代理（网关）IP地址)
// chaddr   16*8bit DHCP客户端的MAC地址。在每个报文中都会显示对应DHCP客户端的MAC地址。
// sname    64*8bit 为DHCP客户端分配IP地址的DHCP服务器名称（DNS域名格式）。在Offer和ACK报文中显示发送报文的DHCP服务器名称，其他报文显示为0。
// file     128*8bit DHCP服务器为DHCP客户端指定的启动配置文件名称及路径信息。仅在DHCP Offer报文中显示，其他报文中显示为空。
// options  可选项字段，长度可变，格式为"代码(8bit)+长度(8bit)+数据"。

/**
 * 发现报文
 */
const discoverMsg = (clientMAC, transactionID) => {
  const op = Number(1).toString(2).padStart(8, "0");
  const htype = Number(1).toString(2).padStart(8, "0");
  const hlen = Number(6).toString(2).padStart(8, "0");
  const hops = Number(0).toString(2).padStart(8, "0");
  const xid = Number(transactionID)
    .toString(2)
    .padStart(4 * 8, "0");
  const secs = Number(0)
    .toString(2)
    .padStart(2 * 8, "0");
  const flags = `0000000000000000`;
  const ciaddr = Number(0)
    .toString(2)
    .padStart(4 * 8, "0");
  const yiaddr = Number(0)
    .toString(2)
    .padStart(4 * 8, "0");
  const siaddr = Number(0)
    .toString(2)
    .padStart(4 * 8, "0");
  const giaddr = Number(0)
    .toString(2)
    .padStart(4 * 8, "0");
  const chaddr = clientMAC
    .split(":")
    .map((item) => Number(`0x${item}`).toString(2).padStart(8, "0"))
    .join("")
    .padEnd(16 * 8, "0");
  const sname = Number(0)
    .toString(2)
    .padStart(64 * 8, "0");
  const file = Number(0)
    .toString(2)
    .padStart(128 * 8, "0");
  const magicCookie = [Number(0x63), Number(0x82), Number(0x53), Number(0x63)];
  const options = [53, 01, 03, 255];
  return [
    Number(`0b${op}`),
    Number(`0b${htype}`),
    Number(`0b${hlen}`),
    Number(`0b${hops}`),
    ...strChunk(xid, 8).map((item) => Number(`0b${item}`)),
    ...strChunk(secs, 8).map((item) => Number(`0b${item}`)),
    ...strChunk(flags, 8).map((item) => Number(`0b${item}`)),
    ...strChunk(ciaddr, 8).map((item) => Number(`0b${item}`)),
    ...strChunk(yiaddr, 8).map((item) => Number(`0b${item}`)),
    ...strChunk(siaddr, 8).map((item) => Number(`0b${item}`)),
    ...strChunk(giaddr, 8).map((item) => Number(`0b${item}`)),
    ...strChunk(chaddr, 8).map((item) => Number(`0b${item}`)),
    ...strChunk(sname, 8).map((item) => Number(`0b${item}`)),
    ...strChunk(file, 8).map((item) => Number(`0b${item}`)),
    ...magicCookie,
    ...options,
  ];
};

const dhcpByNode = ({ timeout = 5000 }) => {
  let timer = null;
  let resBuffer = null;
  let transactionID = random(0, 65536);
  let discoverPayload = Uint8Array.from(
    discoverMsg("8C:AB:8E:3B:31:70", transactionID)
  );
  console.log("req ", discoverPayload);
  const dgram = require("dgram");
  const client = dgram.createSocket("udp4");
  client.on("error", (errMsg) => {
    console.log(`dhcp error:` + errMsg.stack);
    client.close();
    // reject("dhcp error: " + errMsg.stack);
    if (timer) {
      clearTimeout(timer);
    }
  });
  client.on("message", (message, remoteInfo) => {
    console.log("res ", Array.from(message));
    // resBuffer = Array.from(message);
    // let { code, msg, data } = verifyResBuffer(
    //   randomID,
    //   reqBuffer.length,
    //   resBuffer
    // );
    // if (code) {
    //   reslove(data);
    // } else {
    //   reject(msg);
    // }
    client.close();
    // reslove([]);
    if (timer) {
      clearTimeout(timer);
    }
  });
  client.bind(68, "0.0.0.0", () => {
    client.setBroadcast(true);
  });
  client.send(discoverPayload, SERVER_PORT, "255.255.255.255", (err) => {
    if (err) {
      console.log(err);
      client.close();
      // reject("dhcp error: send" + err.stack);
      if (timer) {
        clearTimeout(timer);
      }
    }
  });
  // timer = setTimeout(() => {
  //   if (!resBuffer) {
  //     client.close();
  //     // reject("dhcp error: timeout");
  //   }
  // }, timeout);
};

dhcpByNode({});
module.exports = { discoverMsg };
