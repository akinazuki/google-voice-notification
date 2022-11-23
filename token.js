const crypto = require('crypto');

const androidId = crypto.randomBytes(8).toString('hex');

module.exports = async function requestGoogleAuthToken(aas_et, pkg) {
    const headers = new Headers({
        "device": androidId,
        "app": pkg.bundleId,
        "gmsversion": "224417045",
        "gmscoreFlow": "16",
        "User-Agent": "GoogleAuth/1.4 (OP5155L1 RKQ1.211119.001); gzip",
        "content-type": "application/x-www-form-urlencoded",
        "Host": "android.googleapis.com",
        ...pkg.override.headers
    });
    const body = {
        androidId,
        lang: 'zh-Hans-CN',
        google_play_services_version: '224417045',
        sdk_version: '31',
        device_country: 'cn',
        it_caveat_types: '2',
        app: pkg.bundleId,
        check_email: '1',
        oauth2_foreground: '1',
        // Email: 'xxx@gmail.com', // necessary ?
        has_permission: '1',
        token_request_options: 'CAA4AVAB',
        service: pkg.service,
        client_sig: pkg.sha1,
        callerPkg: pkg.bundleId,
        Token: aas_et,
        callerSig: pkg.sha1,
        ...pkg.override.body
    }
    const query = new URLSearchParams(body).toString();
    return await fetch("https://android.googleapis.com/auth", {
        method: 'POST',
        headers: headers,
        body: query,
        redirect: 'follow'
    }).then(response => response.text()).then(result => {
        const res = result.split('\n').map(line => line.split('=')).reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
        }, {});
        if (res.Error) {
            throw new Error(res.Error);
        }
        return res;
    })
}