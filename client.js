const dgram = require("dgram");
const fbSer = "119.29.29.29"; //默认DNS服务器

/**
 * 获取随机数
 * @param {Number} min
 * @param {Number} max
 * @returns Number
 */
let random = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * 解析域名
 * @param {String} hostname
 * @returns Array
 */
const parseHost = (hostname = "") => {
  // 因为域名是可变的,所以需要先将域名以.拆分成数组域
  let arr = hostname.split(".");
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
  // 打平返回
  return arr.join();
};

const createHeaderPart = () => {
  // 会话标识(2字节)
  let ID = random(1, 65536).toString(16).split("");
  ID.splice(2, 0, ",");
  ID = ID.join("");

  // FLAGS(2字节)
  const QR = 0; //0表示查询报文，1表示响应报文;
  const opcode = 0; // 通常值为0（标准查询），其他值为1（反向查询）和2（服务器状态请求）,[3,15]保留值;
  const AA = 0; //表示授权回答（authoritative answer）-- 这个比特位在应答的时候才有意义，指出给出应答的服务器是查询域名的授权解析服务器;
  const TC = 0; //表示可截断的（truncated）--用来指出报文比允许的长度还要长，导致被截断;
  const RD = 1; //表示期望递归(Recursion Desired) -- 这个比特位被请求设置，应答的时候使用的相同的值返回。如果设置了RD，就建议域名服务器进行递归解析，递归查询的支持是可选的;
  const RA = 0; //表示支持递归(Recursion Available) -- 这个比特位在应答中设置或取消，用来代表服务器是否支持递归查询;
  const Z = 0; // 保留值，暂未使用;
  const RCODE = 0;
  // RCODE字典
  // 0 : 没有错误。
  // 1 : 报文格式错误(Format error) - 服务器不能理解请求的报文;
  // 2 : 服务器失败(Server failure) - 因为服务器的原因导致没办法处理这个请求;
  // 3 : 名字错误(Name Error) - 只有对授权域名解析服务器有意义，指出解析的域名不存在;
  // 4 : 没有实现(Not Implemented) - 域名服务器不支持查询类型;
  // 5 : 拒绝(Refused) - 服务器由于设置的策略拒绝给出应答.比如，服务器不希望对某些请求者给出应答，或者服务器不希望进行某些操作（比如区域传送zone transfer）;
  // [6,15] : 保留值，暂未使用。
  const QDCOUNT = 0; // 无符号16bit整数表示报文请求段中的问题记录数。
  const ANCOUNT = 0; // 无符号16bit整数表示报文回答段中的回答记录数。
  const NSCOUNT = 0; // 无符号16bit整数表示报文授权段中的授权记录数。
  const ARCOUNT = 0; // 无符号16bit整数表示报文附加段中的附加记录数。
  
};

const buildDNSRequestPackage = (hostname) => {
  // 解析域名
  let questionsPart = parseHost(hostname);
  let headerPart = createHeaderPart();
  console.log(headerPart, questionsPart);
};

buildDNSRequestPackage("cjd6568358.3322.org");
