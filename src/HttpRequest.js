let httpRequest = function (method, url, payload, headers) {
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.open(method, url, true);

        if (headers) {
            for(var headerName in headers) {
                xhr.setRequestHeader(headerName, headers[headerName]);
            }        
        }
        xhr.onload = function () {
            if (this.readyState == 4 && this.status >= 200 && this.status < 300) {
                resolve(xhr.response.length > 0 ? JSON.parse(xhr.response): {} );
            } else {
                reject({
                    status: this.status,
                    statusText: xhr.statusText
                });
            }
        };
        xhr.onerror = function () {
            reject({
                status: this.status,
                statusText: xhr.statusText
            });
        };
        if (method === 'POST') { 
            xhr.send(JSON.stringify(payload));
        }
        else if (method === 'GET') {
            xhr.send();
        }
    });
}

export { httpRequest }