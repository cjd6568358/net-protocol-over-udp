import dgram from 'dgram'
import { strChunk } from "../util/index.mjs";

const SERVER_PORT = 69;

const codeMap = {
  RRQ: 1,
  WRQ: 2,
  DATA: 3,
  ACK: 4,
  ERROR: 5,
  LOADINGACK: 6, //等待客户端上传文件
};

const getBlockId = (arr) => {
  return Number(
    `0b${arr.map((item) => Number(item).toString(2).padStart(8, 0)).join("")}`
  );
};

class Client {
  constructor(config) {
    this._state = { config, fileArray: new Uint8Array() };
  }

  async onMessage(message, remoteInfo) {
    // console.log("message ", Array.from(message), remoteInfo);
    if (this._state.config.onMessage) {
      this._state.config.onMessage(message, remoteInfo);
    }
    let { resolve, reject } = this._state;
    let result = {};
    let blockId = 0;
    result.opcode = message[1];
    switch (result.opcode) {
      case codeMap.DATA:
        this._state.SERVER_PORT = remoteInfo.port;
        this._state.fileArray = Uint8Array.from([
          ...this._state.fileArray,
          ...message.slice(4),
        ]);
        blockId = getBlockId(message.slice(2, 4));
        // send ACK
        let payload = Uint8Array.from([0, codeMap.ACK, ...message.slice(2, 4)]);
        await this._send(payload);
        // 数据包如果小于512+2+2 说明是最后一个
        if (message.byteLength < 516) {
          resolve(this._state.fileArray);
          this.destory();
        }
        break;
      case codeMap.ACK:
        this._state.SERVER_PORT = remoteInfo.port;
        blockId = getBlockId(message.slice(2, 4));
        this._sendFileBlock(blockId + 1);
        break;
      case codeMap.LOADINGACK:
        this._state.SERVER_PORT = remoteInfo.port;
        result.options = {};
        let zeroCount = 0;
        let key = "";
        for (let i = 2; i < message.length - 1; i++) {
          if (message[i] === 0) {
            zeroCount++;
            if (zeroCount % 2 === 0) {
              key = "";
            }
          } else {
            if (zeroCount !== 0 && zeroCount % 2) {
              if (!result.options[key]) {
                result.options[key] = "";
              }
              result.options[key] += String.fromCharCode(message[i]);
            } else {
              key += String.fromCharCode(message[i]);
            }
          }
        }
        this._sendFileBlock();
        break;
      case codeMap.ERROR:
        result.errCode = Number(
          `0b${message
            .slice(2, 4)
            .map((item) => Number(item).toString(2).padStart(8, 0))
            .join("")}`
        );
        result.errMsg = message
          .slice(4, message.length - 1)
          .map((code) => String.fromCharCode(code))
          .join("");
        this.destory();
        reject(result);
        break;
    }
  }

  destory() {
    this.socket.close();
  }

  sendFile({ fileName, fileArray }) {
    return new Promise((resolve, reject) => {
      let opcode = [0, codeMap.WRQ];
      let fName = fileName.split("").map((char) => char.charCodeAt());
      let transferType = "octet".split("").map((char) => char.charCodeAt());
      let transferSize = [
        ..."tsize".split("").map((char) => char.charCodeAt()),
        0,
        String(fileArray.byteLength)
          .split("")
          .map((char) => char.charCodeAt()),
      ];

      Object.assign(this._state, { fileArray, resolve, reject });
      let payload = Uint8Array.from([
        ...opcode,
        ...fName,
        0,
        ...transferType,
        0,
        ...transferSize,
        0,
      ]);
      this._send(payload);
    });
  }

  _sendFileBlock(blockId = 1) {
    let { fileArray, resolve } = this._state;
    let payload = [
      0,
      codeMap.DATA,
      ...strChunk(
        Number(blockId)
          .toString(2)
          .padStart(2 * 8, "0"),
        8
      ).map((item) => Number(`0b${item}`)),
    ];
    if (fileArray.byteLength >= 512 * blockId) {
      payload = [
        ...payload,
        ...fileArray.slice(512 * (blockId - 1), 512 * blockId),
      ];
      this._send(Uint8Array.from(payload));
    } else if (blockId === 1 || 512 * blockId - fileArray.byteLength < 512) {
      payload = [...payload, ...fileArray.slice(512 * (blockId - 1))];
      this._send(Uint8Array.from(payload));
    } else {
      resolve();
      this.destory();
    }
  }

  receiveFile({ fileName }) {
    return new Promise((resolve, reject) => {
      let opcode = [0, codeMap.RRQ];
      let fName = fileName.split("").map((char) => char.charCodeAt());
      let transferType = "octet".split("").map((char) => char.charCodeAt());

      Object.assign(this._state, { resolve, reject });
      let payload = Uint8Array.from([
        ...opcode,
        ...fName,
        0,
        ...transferType,
        0,
      ]);
      this._send(payload);
    });
  }
}

class NodeClient extends Client {
  constructor(options) {
    super(options);
    const socket = dgram.createSocket("udp4");

    socket.on("error", (errMsg) => {
      console.log(`tftp error:` + errMsg.stack);
      this.destory();
    });

    socket.on("message", super.onMessage.bind(this));

    socket.bind();

    this.socket = socket;
  }

  async _send(payload) {
    return new Promise((resolve) => {
      this.socket.send(
        payload,
        this._state.SERVER_PORT || SERVER_PORT,
        this._state.config.SERVER_ADDRESS,
        resolve
      );
    });
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

    socket.onMessage(super.onMessage.bind(this));

    socket.bind();

    this.socket = socket;
  }

  async _send(payload) {
    return new Promise((resolve) => {
      this.socket.send(
        payload,
        this._state.SERVER_PORT || SERVER_PORT,
        this._state.config.SERVER_ADDRESS,
        resolve
      );
    });
  }
}

export { NodeClient, MPClient };