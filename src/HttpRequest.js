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
                // the parsed error body, e.g. the conflicts of a 409, when the response has one
                let body = null;
                try {
                    body = xhr.response.length > 0 ? JSON.parse(xhr.response) : null;
                } catch (e) {
                    body = null;
                }
                reject({
                    status: this.status,
                    statusText: xhr.statusText,
                    body: body
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