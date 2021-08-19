import { opts as Options } from "./options.mjs";

function trimZero(str) {
  const pos = str.indexOf("\x00");
  return pos === -1 ? str : str.substr(0, pos);
}

function SeqBuffer(buf, len = 1500) {
  this._dataView =
    buf instanceof DataView
      ? buf
      : new DataView((buf && buf.buffer) || buf || new ArrayBuffer(len)); //  fills the buffer with '0'
}

SeqBuffer.prototype = {
  _data: null,
  _r: 0, //读取指针
  _w: 0, //写入指针

  addUInt8: function (val) {
    this._dataView.setUint8(val, this._w++);
  },
  getUInt8: function () {
    return this._dataView.getUint8(this._r++);
  },
  //
  addInt8: function (val) {
    this._dataView.setInt8(val, this._w++);
  },
  getInt8: function () {
    return this._dataView.getInt8(this._r++);
  },
  //
  addUInt16: function (val) {
    this._dataView.setUint16(val, (this._w += 2));
  },
  getUInt16: function () {
    return this._dataView.getUint16((this._r += 2) - 2);
  },
  //
  addInt16: function (val) {
    this._dataView.setInt16(val, (this._w += 2));
  },
  getInt16: function () {
    return this._dataView.getInt16((this._r += 2) - 2);
  },
  //
  addUInt32: function (val) {
    this._dataView.setUint32(val, (this._w += 4));
  },
  getUInt32: function () {
    return this._dataView.getUint32((this._r += 4) - 4);
  },
  //
  addInt32: function (val) {
    this._dataView.setInt32(val, (this._w += 4));
  },
  getInt32: function () {
    return this._dataView.getInt32((this._r += 4) - 4);
  },
  //
  addUTF8: function (val) {
    let uint8array = Uint8Array.from(new TextEncoder("utf-8").encode(val));
    for (let index = 0; index < uint8array.length; index++) {
      this.addUInt8(uint8array[index]);
    }
  },
  addUTF8Pad: function (val, fixLen) {
    let uint8array = Uint8Array.from(new TextEncoder("utf-8").encode(val));
    for (let index = 0; index < fixLen; index++) {
      this.addUInt8(uint8array[index] || 0);
    }
  },
  getUTF8: function (len) {
    let uint8array = this._dataView.buffer.slice(this._r, (this._r += len));
    return trimZero(new TextDecoder("utf-8").decode(uint8array));
  },
  //
  addASCII: function (val) {
    this.addUInt8(val);
  },
  addASCIIPad: function (val, fixLen) {
    this.addUInt8(val);
    for (let index = 0; index < fixLen - 1; index++) {
      this.addUInt8(0);
    }
  },
  getASCII: function (len) {
    let uint8array = this._dataView.buffer.slice(this._r, (this._r += len));
    // 不知道为什么node不支持new TextDecoder("ascii"),使用utf-8兼容
    return trimZero(new TextDecoder("utf-8").decode(uint8array));
  },
  //
  addIP: function (ip) {
    const self = this;
    const octs = ip.split(".");

    if (octs.length !== 4) {
      throw new Error("Invalid IP address " + ip);
    }

    for (let val of octs) {
      val = parseInt(val, 10);
      if (0 <= val && val < 256) {
        self.addUInt8(val);
      } else {
        throw new Error("Invalid IP address " + ip);
      }
    }
  },
  getIP: function () {
    return (
      this.getUInt8() +
      "." +
      this.getUInt8() +
      "." +
      this.getUInt8() +
      "." +
      this.getUInt8()
    );
  },
  //
  addIPs: function (ips) {
    if (ips instanceof Array) {
      for (let ip of ips) {
        this.addIP(ip);
      }
    } else {
      this.addIP(ips);
    }
  },
  getIPs: function (len) {
    const ret = [];
    for (let i = 0; i < len; i += 4) {
      ret.push(this.getIP());
    }
    return ret;
  },
  //
  addMac: function (mac) {
    const octs = mac.split(/[-:]/);

    if (octs.length !== 6) {
      throw new Error("Invalid Mac address " + mac);
    }

    for (let val of octs) {
      val = parseInt(val, 16);
      if (0 <= val && val < 256) {
        this.addUInt8(val);
      } else {
        throw new Error("Invalid Mac address " + mac);
      }
    }

    // Add 10 more byte to pad 16 byte
    this.addUInt32(0);
    this.addUInt32(0);
    this.addUInt16(0);
  },
  getMAC: function (htype, hlen) {
    if (htype !== 1 || hlen !== 6) {
      throw new Error(
        "Invalid hardware address (len=" + hlen + ", type=" + htype + ")"
      );
    }
    let mac = [];
    for (let i = 0; i < hlen; i++) {
      mac.push(Number(this.getUInt8()).toString(16));
    }
    this._r += 10; // + 10 since field is 16 byte and only 6 are used for htype=1
    return mac.join("-").toUpperCase();
  },
  //
  addBool: function () {
    /* void */
  },
  getBool: function () {
    return true;
  },
  //
  addOptions: function (opts) {
    Object.keys(opts).forEach((key) => {
      const opt = Options[key];
      let len = 0;
      let val = opts[i];

      if (val === null) {
        return;
      }

      switch (opt.type) {
        case "UInt8":
        case "Int8":
          len = 1;
          break;
        case "UInt16":
        case "Int16":
          len = 2;
          break;
        case "UInt32":
        case "Int32":
        case "IP":
          len = 4;
          break;
        case "IPs":
          len = val instanceof Array ? 4 * val.length : 4;
          break;
        case "ASCII":
          len = val.length;
          if (len === 0) return; // Min length has to be 1
          if (len > 255) {
            console.error(val + " too long, truncating...");
            val = val.slice(0, 255);
            len = 255;
          }
          break;
        case "UTF8":
          let len = Uint8Array.from(
            new TextEncoder("utf-8").encode(val)
          ).length;
          if (len === 0) return; // Min length has to be 1
          for (let n = 0; len > 255; n++) {
            val = val.slice(0, 255 - n); // Truncate as long as character length is > 255
            len = len = Uint8Array.from(
              new TextEncoder("utf-8").encode(val)
            ).length;
          }
          break;
        case "Bool":
          if (
            !(
              val === true ||
              val === 1 ||
              val === "1" ||
              val === "true" ||
              val === "TRUE" ||
              val === "True"
            )
          )
            return;
          // Length must be zero, so nothing to do here
          break;
        case "UInt8s":
          len = val instanceof Array ? val.length : 1;
          break;
        case "UInt16s":
          len = val instanceof Array ? 2 * val.length : 2;
          break;
        default:
          throw new Error("No such type " + opt.type);
      }

      // Write code
      this.addUInt8(i);

      // Write length
      this.addUInt8(len);

      // Write actual data
      this["add" + opt.type](val);
    });
  },
  getOptions: function () {
    const options = {};
    const buf = this._dataView.buffer;

    while (this._r < buf.byteLength) {
      let opt = this.getUInt8();

      if (opt === 0xff) {
        // End type
        break;
      } else if (opt === 0x00) {
        // Pad type
        this._r++; // NOP
      } else {
        let len = this.getUInt8();

        if (opt in Options) {
          options[opt] = this["get" + Options[opt].type](len);
        } else {
          this._r += len;
          console.error("Option " + opt + " not known");
        }
      }
    }
    return options;
  },
  //
  addUInt8s: function (arr) {
    if (arr instanceof Array) {
      for (let i = 0; i < arr.length; i++) {
        this.addUInt8(arr[i]);
      }
    } else {
      this.addUInt8(arr);
    }
  },
  getUInt8s: function (len) {
    const ret = [];
    for (let i = 0; i < len; i++) {
      ret.push(this.getUInt8());
    }
    return ret;
  },
  addUInt16s: function (arr) {
    if (arr instanceof Array) {
      for (let i = 0; i < arr.length; i++) {
        this.addUInt16(arr[i]);
      }
    } else {
      this.addUInt16(arr);
    }
  },
  getUInt16s: function (len) {
    const ret = [];
    for (let i = 0; i < len; i += 2) {
      ret.push(this.getUInt16());
    }
    return ret;
  },
  //
  getHex: function (len) {
    let result = "";
    for (let i = 0; i < len; i++) {
      result += Number(this.getUInt8()).toString(16);
    }
    return result;
  },
};

export default SeqBuffer;
