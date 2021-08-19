## dhcp-js

JavaScript 实现的 DHCP 客户端，支持 Node、微信小程序。服务端参考bak目录

### 用法

    let client = new NodeClient({ mac: "8C:AB:8E:3B:31:70",onSuccess:(state)=>console.log(state) });
    client.sendDiscover();
