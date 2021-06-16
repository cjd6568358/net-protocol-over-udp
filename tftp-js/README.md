## dhcp-js

JavaScript 实现的 TFTP 客户端，支持 Node、微信小程序。

### 用法

    let client = new NodeClient({
    SERVER_ADDRESS: "192.168.50.221",
    });

    sendFile = (filePath) => {
    const fs = require("fs");
    const path = require("path");
    if (!filePath.length) {
        return;
    }
    console.log(path.resolve(filePath));
    if (!fs.existsSync(path.resolve(filePath))) {
        return;
    }
    let file = fs.readFileSync(path.resolve(filePath));
    client
        .sendFile({
        fileName: path.basename(path.resolve(filePath)),
        fileArray: file,
        })
        .then(
        () => {
            console.log("done");
        },
        (error) => {
            console.log("error", error);
        }
        );
    };
    sendFile("./tftp-js/6.jpg");

    getFile = (fileName, savePath) => {
    const fs = require("fs");
    const path = require("path");
    client
        .receiveFile({
        fileName,
        })
        .then(
        (arrayBuffer) => {
            // console.log("done", arrayBuffer);
            fs.writeFileSync(path.resolve(savePath, fileName), arrayBuffer);
        },
        (error) => {
            console.log("error", error);
        }
        );
    };
    getFile("6.jpg", "./");
