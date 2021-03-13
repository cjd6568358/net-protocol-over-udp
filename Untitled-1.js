let msg = [115,109,97,114,116,112,108,117,103,99,111,110,110,101,99,116]
// let buf = new Uint8Array(new ArrayBuffer(msg.length))
// for (let i = 0; i < msg.length; i++) {
//     buf[i] = msg[i]
// }
String.fromCharCode.apply(null, new Uint8Array(msg));



// msg======================== <Buffer 3e 49 01 00 00 01 00 00 00 00 00 00 10 73 6d 61 72 74 70 6c 75 67 63 6f 6e 6e 65 63 74 07 70 68 69 63 6f 6d 6d 03 63 6f 6d 00 00 01 00 01> { address: '10.0.1.109', family: 'IPv4', port: 52157, size: 46 }
// host:smartplugconnect.phicomm.com {"type":"Buffer","data":[62,173,1,0,0,1,0,0,0,0,0,0,16,115,109,97,114,116,112,108,117,103,99,111,110,110,101,99,116,7,112,104,105,99,111,109,109,3,99,111,109,0,0,1,0,1]}


73 6d 61 72 74 70 6c 75 67 63
115 109 97 114 116 112 108 117 103 99