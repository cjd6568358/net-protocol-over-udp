// RCODE字典
const RCODE_MAP = {
  0: '没有错误。',
  1: '报文格式错误(Format error) - 服务器不能理解请求的报文;',
  2: '服务器失败(Server failure) - 因为服务器的原因导致没办法处理这个请求;',
  3: '名字错误(Name Error) - 只有对授权域名解析服务器有意义，指出解析的域名不存在;',
  4: '没有实现(Not Implemented) - 域名服务器不支持查询类型;',
  5: '拒绝(Refused) - 服务器由于设置的策略拒绝给出应答.比如，服务器不希望对某些请求者给出应答，或者服务器不希望进行某些操作（比如区域传送zone transfer）;'
  //[6,15] : 保留值，暂未使用。
}

// 查询类型字典
const QTYPE_MAP = {
  1: "A	由域名获得IPv4地址，一般是这个",
  2: "NS	查询域名服务器",
  5: "CNAME	查询规范名称",
  6: "SOA	开始授权",
  11: "WKS	熟知服务",
  12: "PTR	把IP地址转换成域名",
  13: "HINFO	主机信息",
  15: "MX	邮件交换",
  28: "AAAA	由域名获得IPv6地址",
  252: "AXFR	传送整个区的请求",
  255: "ANY	对所有记录的请求",
}

/**
 * 获取随机数
 * @param {Number} min
 * @param {Number} max
 * @returns Number
 */
const random = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * 
 * @param {Uint16Array} bufferViewer 
 */
const Uint16ArrayToUint8Array = (bufferViewer) => {
  data_8 = new Uint8Array(bufferViewer.buffer, bufferViewer.byteOffset, bufferViewer.byteLength)
}

const arrayBufferToHost = (buffer, fullBuffer) => {
  let num = buffer[0];
  let offset = 1;
  let host = "";
  while (num !== 0) {
    if (num == 192) {
      host += arrayBufferToHost(fullBuffer.slice(offset), fullBuffer);
      offset += 1;
    } else {
      host += buffer.slice(offset, offset + num).map(item => String.fromCharCode(item)).join("");
      offset += num;
    }
    num = buffer[offset] || 0;
    offset += 1;
    if (num !== 0) host += ".";
  }
  return host;
}

/**
 * 解析域名
 * @param {String} hostName
 * @returns Array
 */
const hostToArrayBuffer = (hostName = "") => {
  // 因为域名是可变的,所以需要先将域名以.拆分成数组域
  let arr = hostName.split(".");
  arr = arr.map((item) => {
    // 每个域以计数开头
    return Array.from([
      item.length,
      ...item.split("").map((str) => {
        // 转换成ASCII码
        return str.charCodeAt();
      }),
    ]);
  });
  // 最后一个字符为0
  arr.push(0);
  // 打平
  return arr.join().split(",");
};

const createHeaderPart = (randomID) => {
  // 会话标识(2字节)
  let ID = randomID.toString(16).padStart(4, '0').split("");

  // FLAGS(2字节)
  const QR = 0; // (1bit) 0表示查询报文，1表示响应报文;
  const opcode = Number(0).toString(16).padStart(4, '0'); // (4bit) 通常值为0（标准查询），其他值为1（反向查询）和2（服务器状态请求）,[3,15]保留值;
  const AA = 0; // (1bit) 表示授权回答（authoritative answer）-- 这个比特位在应答的时候才有意义，指出给出应答的服务器是查询域名的授权解析服务器;
  const TC = 0; // (1bit) 表示可截断的（truncated）--用来指出报文比允许的长度还要长，导致被截断;
  const RD = 1; // (1bit) 表示期望递归(Recursion Desired) -- 这个比特位被请求设置，应答的时候使用的相同的值返回。如果设置了RD，就建议域名服务器进行递归解析，递归查询的支持是可选的;
  const RA = 0; // (1bit) 表示支持递归(Recursion Available) -- 这个比特位在应答中设置或取消，用来代表服务器是否支持递归查询;
  const Z = Number(0).toString(16).padStart(3, '0'); // (3bit) 保留值，暂未使用;
  const RCODE = Number(0).toString(16).padStart(4, '0');// (4bit) 

  const QDCOUNT = Number(1).toString(16).padStart(4, '0').split(""); // (2字节) 表示报文请求段中的问题记录数。

  const ANCOUNT = Number(0).toString(16).padStart(4, '0').split(""); // (2字节) 表示报文回答段中的回答记录数。

  const NSCOUNT = Number(0).toString(16).padStart(4, '0').split(""); // (2字节) 表示报文授权段中的授权记录数。

  const ARCOUNT = Number(0).toString(16).padStart(4, '0').split(""); // (2字节) 表示报文附加段中的附加记录数。

  const FLAG1 = `0b${QR}${opcode}${AA}${TC}${RD}`;
  const FLAG2 = `0b${RA}${Z}${RCODE}`;

  return [
    Number(`0x${ID.splice(0, 2).join("")}`),
    Number(`0x${ID.join("")}`),
    Number(FLAG1).toString(8),
    Number(FLAG2).toString(8),
    QDCOUNT.splice(0, 2).join(""),
    QDCOUNT.join(""),
    ANCOUNT.splice(0, 2).join(""),
    ANCOUNT.join(""),
    NSCOUNT.splice(0, 2).join(""),
    NSCOUNT.join(""),
    ARCOUNT.splice(0, 2).join(""),
    ARCOUNT.join("")]
};

const createQuestionPart = (hostName) => {
  const QNAME = hostToArrayBuffer(hostName) //域名
  const QTYPE = Number(1).toString(16).padStart(4, '0').split(""); //协议类型 (2字节)
  // 1	A	由域名获得IPv4地址，一般是这个
  // 2	NS	查询域名服务器
  // 5	CNAME	查询规范名称
  // 6	SOA	开始授权
  // 11	WKS	熟知服务
  // 12	PTR	把IP地址转换成域名
  // 13	HINFO	主机信息
  // 15	MX	邮件交换
  // 28	AAAA	由域名获得IPv6地址
  // 252	AXFR	传送整个区的请求
  // 255	ANY	对所有记录的请求
  const QCLASS = Number(1).toString(16).padStart(4, '0').split(""); //查询的类 (2字节)
  return Array.from([
    ...QNAME,
    QTYPE.splice(0, 2).join(""),
    QTYPE.join(""),
    QCLASS.splice(0, 2).join(""),
    QCLASS.join("")
  ])
};

const createReqBuffer = (hostName, randomID) => {
  return Uint8Array.from([...createHeaderPart(randomID), ...createQuestionPart(hostName)]);
};

const parseBuffer = (reqLen, buffer) => {
  let newBuffer = buffer.slice(reqLen)
  // console.log('buffer========>', buffer)
  // console.log('newBuffer========>', newBuffer)
  let result = []
  while (newBuffer.length > 0) {
    let offset = newBuffer[11]
    let answerArr = newBuffer.splice(0, 12 + offset)
    if (answerArr[3] === 1) {
      result.push({
        QType: "A",
        data: answerArr.slice(-4).join(".")
      })
    } else if (answerArr[3] === 5) {
      answerArr = answerArr.splice(12)
      let data = arrayBufferToHost(answerArr, buffer)
      result.push({
        QType: "CNAME",
        data
      })
    }
  }
  return result
}

const verifyResBuffer = (ID, reqLen, buffer) => {
  // 会话标识
  if (ID != Number(`0x${Number(buffer[0]).toString(16)}${Number(buffer[1]).toString(16)}`)) {
    return {
      code: 0,
      msg: "ID不匹配"
    }
  }
  // FLAGS
  let FLAGS = `${Number(buffer[2]).toString(2)}${Number(buffer[3]).toString(2)}`
  // 响应标志QR
  const QR = FLAGS[0]
  if (QR == 0) {
    return {
      code: 0,
      msg: "响应标志QR不匹配:" + QR
    }
  }
  // 返回码RCODE
  const RCODE = Number(`0x${FLAGS.substr(12)}`)
  if (RCODE != 0) {
    return {
      code: 0,
      msg: RCODE_MAP[RCODE]
    }
  }
  return {
    code: 1,
    msg: 'success',
    data: parseBuffer(reqLen, buffer)
  }
}

const nslookupByNode = ({ hostName, dnsServer = "114.114.114.114", timeout = 5000 }) => {
  return new Promise((reslove, reject) => {
    let reqBuffer = null;
    let resBuffer = null;
    let timer = null;
    const randomID = random(1, 65536)
    reqBuffer = createReqBuffer(hostName, randomID)
    const dgram = require("dgram");
    const client = dgram.createSocket("udp4");
    client.on("error", (errMsg) => {
      console.log(`nslookup error:` + errMsg.stack);
      client.close();
      reject('nslookup error: ' + errMsg.stack)
      if (timer) {
        clearTimeout(timer)
      }
    });
    client.on("message", (message, remoteInfo) => {
      resBuffer = JSON.parse(JSON.stringify(message)).data
      let { code, msg, data } = verifyResBuffer(randomID, reqBuffer.length, resBuffer)
      if (code) {
        reslove(data)
      } else {
        reject(msg)
      }
      client.close();
      reslove([])
      if (timer) {
        clearTimeout(timer)
      }
    });
    client.send(reqBuffer, 53, dnsServer, (err) => {
      if (err) {
        console.log(err);
        client.close();
        reject('nslookup error: send' + err.stack)
        if (timer) {
          clearTimeout(timer)
        }
      }
    });
    timer = setTimeout(() => {
      if (!resBuffer) {
        client.close();
        reject('nslookup error: timeout')
      }
    }, timeout)
  })
}

const nslookupByMiniProgram = ({ hostName, dnsServer = "114.114.114.114", timeout = 5000 }) => {
  return new Promise((reslove, reject) => {
    let reqBuffer = null;
    let resBuffer = null;
    let timer = null;
    const randomID = random(1, 65536)
    reqBuffer = createReqBuffer(hostName, randomID)
    const client = wx.createUDPSocket()
    client.onError(({ errMsg }) => {
      console.log(`nslookup error:` + errMsg);
      client.close();
      reject('nslookup error: ' + errMsg)
      if (timer) {
        clearTimeout(timer)
      }
    });
    client.onMessage(({ message, remoteInfo }) => {
      resBuffer = Array.from(new Uint8Array(message))
      console.log(resBuffer)
      let { code, msg, data } = verifyResBuffer(randomID, reqBuffer.length, resBuffer)
      if (code) {
        reslove(data)
      } else {
        reject(msg)
      }
      client.close();
      reslove([])
      if (timer) {
        clearTimeout(timer)
      }
    });
    client.bind()
    client.send({
      address: dnsServer,
      port: 53,
      message: reqBuffer
    })
    timer = setTimeout(() => {
      if (!resBuffer) {
        client.close();
        reject('nslookup error: timeout')
      }
    }, timeout)
  })
}

// nslookupByNode({ hostName: "m.baidu.com" }).then(res => console.log(res), err => console.log(err));

module.exports = {
  nslookupByNode,
  nslookupByMiniProgram
}
