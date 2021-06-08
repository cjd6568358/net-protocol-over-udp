## dnsjs

JavaScript 实现的 DNS 客户端和服务端，支持 Node、微信小程序，目前只支持 IPV4。常见使用场景为在小程序中判断域名是否被劫持

### 用法

    import { nslookupByMiniProgram } from './client';
    nslookupByMiniProgram({ hostName: "m.baidu.com" }).then(res => {
        console.log(res)
        // [
        //    {"QType":"CNAME","data":"wap.n.shifen.baidu.com"},
        //    {"QType":"A","data":"180.101.49.19"},
        //    {"QType":"A","data":"180.101.49.20"}
        // ]
    }, err => {
        console.log(err)
    });

### OSI 所在层

DNS 属于应用层协议,通常在传输层使用 UDP 协议实现(DNS 协议包超出 512byte 需要截断分包时,可能是为了完整性改用 TCP 实现)

### 格式

#### DNS 报文格式，不论是请求报文，还是 DNS 服务器返回的应答报文，都使用统一的格式。

1.  Header 报文头
2.  Question 查询的问题
3.  Answer 应答
4.  Authority 授权应答
5.  Additional 附加信息

#### Header 包含 ID/QR/opcode/AA/TC/RD/RA/Z/RCODE/QDCOUNT/ANCOUNT/NSCOUNT/ARCOUNT,每个部分使用 2 进制拼接,统一转换成Uint8格式

#### Question 需要转换成ASCII码,由于每个ASCII码都不超过Uint8格式表示范围,所以不需要转换可以直接用

因为域名是可变的,所以需要先将域名(www.baidu.com)以.拆分成www/baidu/com,根据每个部分字母长度拼成以下格式 3www5baidu3com,通过 charCodeAt 获取对应的 ASCII 码

#### 协议的每个部分最后合并Uint8Array发送

#### 参考

JavaScript 中各进制数字表示方法
//二进制 0b 开头
//八进制 0 开头
//十六进制 0x 开头
使用 number.toString(2,8,10,16)可以转换进制

[DNS 请求报文详解](https://juejin.cn/post/6844903582441963527)
服务端实现基本参考下面这篇文章
[NodeJS 编写简单的 DNS 服务器](https://www.jianshu.com/p/8cdcbae986a8)
