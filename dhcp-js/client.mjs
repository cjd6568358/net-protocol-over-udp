import dgram from "dgram";
import { random, strChunk } from "../util/index.mjs";
import Tools from "./tools.mjs";
import * as Options from "./options.mjs";
import Protocol from "./protocol.mjs";

const SERVER_PORT = 67;
const CLIENT_PORT = 68;

const DHCPDISCOVER = 1;
const DHCPOFFER = 2;
const DHCPREQUEST = 3;
const DHCPDECLINE = 4;
const DHCPACK = 5;
const DHCPNAK = 6;
const DHCPRELEASE = 7;
const DHCPINFORM = 8;

const INADDR_ANY = "0.0.0.0";
const INADDR_BROADCAST = "255.255.255.255";

const BOOTREQUEST = 1;
const BOOTREPLY = 2;

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

class Client {
  constructor(config) {
    this._state = { config };
  }

  onMessage(message, remoteInfo, localInfo) {
    if (this._state.config.onMessage) {
      this._state.config.onMessage(message, remoteInfo, localInfo);
    } else {
      let packet = null;
      try {
        packet = Protocol.parse(message);
      } catch (e) {
        console.error("Malformed packet", e);
        throw new Error("Malformed packet", e);
      }

      if (packet.op !== BOOTREPLY) {
        console.error("Malformed packet");
        throw new Error("Malformed packet");
      }

      if (!packet.options[53]) {
        console.error("Got message, without valid message type", packet);
        throw new Error("Got message, without valid message type", packet);
      }
      // Handle request
      switch (packet.options[53]) {
        case DHCPOFFER: // 2.
          this.handleOffer(packet);
          break;
        case DHCPACK: // 4.
        case DHCPNAK: // 4.
          this.handleAck(packet);
          break;
      }
    }
  }

  destory() {
    this.socket.close();
  }

  /**
   * 发送discover报文
   * Node端由于无法设置UDP sourceIP为0.0.0.0,导致DHCP服务器无法响应
   * @param {String} mac
   * @param {Number} transactionID
   */
  sendDiscover(mac, transactionID) {
    // 转成二进制,补齐8bit
    const op = Number(1).toString(2).padStart(8, "0");
    const htype = Number(1).toString(2).padStart(8, "0");
    const hlen = Number(6).toString(2).padStart(8, "0");
    const hops = Number(0).toString(2).padStart(8, "0");
    const xid = Number(transactionID || random(0, 65536))
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
    const chaddr = (mac || this._state.config.mac)
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

    // 标志位:用于标志后续存在options
    const magicCookie = [0x63, 0x82, 0x53, 0x63];

    const discoverOptions = [53, 1, DHCPDISCOVER];
    const macOptions = [
      61,
      8,
      ...strChunk(
        (mac || this._state.config.mac)
          .split(":")
          .map((item) => Number(`0x${item}`))
          .join("")
          .padEnd(16 * 8, "0"),
        8
      ).map((item) => Number(`0b${item}`)),
    ];

    const options = [...magicCookie, ...discoverOptions, ...macOptions, 255];
    const discoverPayload = Uint8Array.from([
      // 转成十进制
      Number(`0b${op}`),
      Number(`0b${htype}`),
      Number(`0b${hlen}`),
      Number(`0b${hops}`),
      // 分割为8bit,转成十进制
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
      ...options,
    ]);
    this._state.state = "SELECTING";
    this._state.tries = 0;
    this._send(discoverPayload);
  }

  handleOffer(packet) {
    if (packet.options[54]) {
      // Check if we already sent a request to the first appearing server
      if (this._state.state !== "REQUESTING") {
        this.sendRequest(packet);
      }
    } else {
      console.error("Offer does not have a server identifier", packet);
    }
  }

  sendRequest(packet) {
    // 转成二进制,补齐8bit
    const op = Number(1).toString(2).padStart(8, "0");
    const htype = Number(1).toString(2).padStart(8, "0");
    const hlen = Number(6).toString(2).padStart(8, "0");
    const hops = Number(0).toString(2).padStart(8, "0");
    const xid = Number(packet.xid || random(0, 65536))
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
    const chaddr = this._state.config.mac
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

    // 标志位:用于标志后续存在options
    const magicCookie = [0x63, 0x82, 0x53, 0x63];

    const requestOptions = [53, 1, DHCPREQUEST];
    const macOptions = [
      61,
      8,
      ...strChunk(
        this._state.config.mac
          .split(":")
          .map((item) => Number(`0x${item}`))
          .join("")
          .padEnd(16 * 8, "0"),
        8
      ).map((item) => Number(`0b${item}`)),
    ];

    const options = [...magicCookie, ...requestOptions, ...macOptions, 255];
    const requestPayload = Uint8Array.from([
      // 转成十进制
      Number(`0b${op}`),
      Number(`0b${htype}`),
      Number(`0b${hlen}`),
      Number(`0b${hops}`),
      // 分割为8bit,转成十进制
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
      ...options,
    ]);

    this._state.server = packet.options[54];
    this._state.address = packet.yiaddr;
    this._state.state = "REQUESTING";
    this._state.tries = 0;

    this._send(requestPayload);
  }

  handleAck(packet) {
    if (packet.options[53] === DHCPACK) {
      // We now know the IP for sure

      this._state.bindTime = new Date();
      this._state.state = "BOUND";
      this._state.address = packet.yiaddr;
      this._state.options = {};

      // Lease time is available
      if (packet.options[51]) {
        this._state.leasePeriod = packet.options[51];
        this._state.renewPeriod = packet.options[51] / 2;
        this._state.rebindPeriod = packet.options[51];
      }

      // Renewal time is available
      if (packet.options[58]) {
        this._state.renewPeriod = packet.options[58];
      }

      // Rebinding time is available
      if (packet.options[59]) {
        this._state.rebindPeriod = packet.options[59];
      }

      // TODO: set renew & rebind timer

      const options = packet.options;
      this._state.options = {};

      // Map all options from request
      for (let id in options) {
        if (id === "53" || id === "51" || id === "58" || id === "59") continue;

        const conf = Options.opts[id];
        const key = conf.config || conf.attr;

        if (conf.enum) {
          this._state.options[key] = conf.enum[options[id]];
        } else {
          this._state.options[key] = options[id];
        }
      }

      // If netmask is not given, set it to a class related mask
      if (!this._state.options.netmask) {
        this._state.options.netmask = Tools.formatIp(
          Tools.netmaskFromIP(this._state.address)
        );
      }

      const cidr = Tools.CIDRFromNetmask(this._state.options.netmask);

      // If router is not given, guess one
      if (!this._state.options.router) {
        this._state.options.router = Tools.formatIp(
          Tools.gatewayFromIpCIDR(this._state.address, cidr)
        );
      }

      // If broadcast is missing
      if (!this._state.options.broadcast) {
        this._state.options.broadcast = Tools.formatIp(
          Tools.broadcastFromIpCIDR(this._state.address, cidr)
        );
      }

      if (this._state.config.onSuccess) {
        this._state.config.onSuccess(this._state);
      }
    } else {
      // We're sorry, today we have no IP for you...
    }
  }

  sendRelease(server, transactionID) {
    // 转成二进制,补齐8bit
    const op = Number(1).toString(2).padStart(8, "0");
    const htype = Number(1).toString(2).padStart(8, "0");
    const hlen = Number(6).toString(2).padStart(8, "0");
    const hops = Number(0).toString(2).padStart(8, "0");
    const xid = Number(transactionID || random(0, 65536))
      .toString(2)
      .padStart(4 * 8, "0");
    const secs = Number(0)
      .toString(2)
      .padStart(2 * 8, "0");
    const flags = `0000000000000000`;
    const ciaddr = Number(server || this._state.server || 0)
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
    const chaddr = this._state.config.mac
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

    // 标志位:用于标志后续存在options
    const magicCookie = [0x63, 0x82, 0x53, 0x63];

    const releaseOptions = [53, 1, DHCPRELEASE];
    const serverOptions = [54, 4, this._state.server.split(":")];

    const options = [...magicCookie, ...releaseOptions, ...serverOptions, 255];
    const releasePayload = Uint8Array.from([
      // 转成十进制
      Number(`0b${op}`),
      Number(`0b${htype}`),
      Number(`0b${hlen}`),
      Number(`0b${hops}`),
      // 分割为8bit,转成十进制
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
      ...options,
    ]);

    this._state.bindTime = null;
    this._state.state = "RELEASED";
    this._state.tries = 0;

    this._send(releasePayload);
  }

  sendRenew(server, transactionID) {
    // 转成二进制,补齐8bit
    const op = Number(1).toString(2).padStart(8, "0");
    const htype = Number(1).toString(2).padStart(8, "0");
    const hlen = Number(6).toString(2).padStart(8, "0");
    const hops = Number(0).toString(2).padStart(8, "0");
    const xid = Number(transactionID || random(0, 65536))
      .toString(2)
      .padStart(4 * 8, "0");
    const secs = Number(0)
      .toString(2)
      .padStart(2 * 8, "0");
    const flags = `0000000000000000`;
    const ciaddr = Number(server || this._state.server || 0)
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
    const chaddr = this._state.config.mac
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

    // 标志位:用于标志后续存在options
    const magicCookie = [0x63, 0x82, 0x53, 0x63];

    const addressOptions = [50, 4, this._state.address.split(":")];
    const requestOptions = [53, 1, DHCPREQUEST];
    const serverOptions = [54, 4, this._state.server.split(":")];

    const options = [
      ...magicCookie,
      ...addressOptions,
      ...requestOptions,
      ...serverOptions,
      255,
    ];
    const renewPayload = Uint8Array.from([
      // 转成十进制
      Number(`0b${op}`),
      Number(`0b${htype}`),
      Number(`0b${hlen}`),
      Number(`0b${hops}`),
      // 分割为8bit,转成十进制
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
      ...options,
    ]);

    this._state.state = "RENEWING";
    this._state.tries = 0;

    this._send(renewPayload);
  }

  sendRebind(server, transactionID) {
    // 转成二进制,补齐8bit
    const op = Number(1).toString(2).padStart(8, "0");
    const htype = Number(1).toString(2).padStart(8, "0");
    const hlen = Number(6).toString(2).padStart(8, "0");
    const hops = Number(0).toString(2).padStart(8, "0");
    const xid = Number(transactionID || random(0, 65536))
      .toString(2)
      .padStart(4 * 8, "0");
    const secs = Number(0)
      .toString(2)
      .padStart(2 * 8, "0");
    const flags = `0000000000000000`;
    const ciaddr = Number(server || this._state.server || 0)
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
    const chaddr = this._state.config.mac
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

    // 标志位:用于标志后续存在options
    const magicCookie = [0x63, 0x82, 0x53, 0x63];

    const addressOptions = [50, 4, this._state.address.split(":")];
    const requestOptions = [53, 1, DHCPREQUEST];
    const serverOptions = [54, 4, this._state.server.split(":")];

    const options = [
      ...magicCookie,
      ...addressOptions,
      ...requestOptions,
      ...serverOptions,
      255,
    ];
    const rebindPayload = Uint8Array.from([
      // 转成十进制
      Number(`0b${op}`),
      Number(`0b${htype}`),
      Number(`0b${hlen}`),
      Number(`0b${hops}`),
      // 分割为8bit,转成十进制
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
      ...options,
    ]);

    this._state.state = "REBINDING";
    this._state.tries = 0;

    this._send(rebindPayload);
  }
}

class NodeClient extends Client {
  constructor(options) {
    super(options);
    const socket = dgram.createSocket("udp4");

    socket.on("error", (errMsg) => {
      console.log(`dhcp error:` + errMsg.stack);
      this.destory();
    });

    socket.on("message", super.onMessage.bind(this));

    socket.bind(
      {
        address: INADDR_ANY,
        port: CLIENT_PORT,
        exclusive: true,
      },
      () => {
        socket.setBroadcast(true);
      }
    );

    this.socket = socket;
  }

  _send(payload) {
    this.socket.send(payload, SERVER_PORT, INADDR_BROADCAST);
  }
}

class MPClient extends Client {
  constructor(options) {
    super(options);
    const socket = wx.createUDPSocket();

    socket.onError((errMsg) => {
      console.log(`dhcp error:` + errMsg.stack);
      this.destory();
    });

    socket.onMessage(({ message, remoteInfo, localInfo }) =>
      super.onMessage(message, remoteInfo, localInfo)
    );

    socket.bind(CLIENT_PORT);

    this.socket = socket;
  }

  _send(payload) {
    this.socket.send({
      message: payload,
      port: SERVER_PORT,
      address: INADDR_BROADCAST,
    });
  }
}

// let client = new NodeClient({ mac: "FF:BB:FF:3B:FF:70" });
// client.sendDiscover();
// console.log(client);

export { NodeClient, MPClient, Tools, Options, Protocol };
