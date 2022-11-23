const fs = require('fs');
const { argv } = require('process');
const { register, listen } = require('push-receiver');
const requestGoogleAuthToken = require('./token');

function storeCredentials(credentials) {
    fs.writeFileSync('credentials.json', JSON.stringify(credentials));
}
function readCredentials() {
    const credentials = JSON.parse(fs.readFileSync('credentials.json'));
    return credentials;
}
const google_voice_pkg = {
    sha1: '24bb24c05e47e0aefa68a58a766179d9b613a600',
    bundleId: 'com.google.android.apps.googlevoice',
    service: 'oauth2:https://www.googleapis.com/auth/googlevoice https://www.googleapis.com/auth/peopleapi.readonly',
    override: {
        body: {},
        headers: {}
    }
};

(async () => {
    const op = process.argv[2];
    const aas_et = process.argv[3];

    switch (op) {
        case 'generate_fcm_token': {
            if (!aas_et || aas_et.length === 0 || !aas_et.startsWith('aas_et')) {
                console.log(`Usage: ${process.argv[0]} ${process.argv[1]} register <aas_et>`);
                return;
            }
            const credentials = await register(301778431048); // google voice app id
            storeCredentials({
                ...credentials,
                aas_et
            })
            console.log(`FCM Token generated`, credentials);
            break;
        }
        case 'listen': {
            const credentials = readCredentials();
            const persistentIds = []
            await listen({ ...credentials }, onNotification);
            break;
        }
        case 'get_user_info': {
            const credentials = readCredentials();
            const google_api_token = await requestGoogleAuthToken(credentials.aas_et, google_voice_pkg).then(res => res.Auth);
            const google_voice_user_info = await getGoogleVoiceUserInfo(google_api_token);
            const balance = google_voice_user_info.account.billing.credit;
            console.log(`Phone Number: ${google_voice_user_info.account.primaryDid}`)
            console.log(`Balance: ${parseFloat(balance.units) + parseFloat('0.' + balance.nanos)} ${balance.currencyCode}`)
            break;
        }
        case 'set_fcm_token': {
            const credentials = readCredentials();
            const google_api_token = await requestGoogleAuthToken(credentials.aas_et, google_voice_pkg).then(res => res.Auth);
            const fcm_protobuf_buffer = generatePayload(credentials.fcm.token);
            const res = await setGoogleVoiceNotificationToken(google_api_token, fcm_protobuf_buffer);
            if (res) {
                console.log(`FCM Token`, credentials.fcm.token);
                console.log(`FCM Protobuf Buffer: ${fcm_protobuf_buffer.toString('hex')}`);
                console.log(`Set FCM token successfully!`);
            }
        }
        default: {
            console.log(`Unknown operation: ${op}`);
        }
    }
})();

function onNotification({ notification, persistentId }) {
    console.log(`Got notification`, notification);
}
function generatePayload(fcmToken) {
    const token_length = fcmToken.length;
    const buf_size = 8 + token_length + 1
    const buf = Buffer.alloc(buf_size)
    const prefix_buffer = Buffer.from([0x12, 0xA9, 0x01, 0x6A, 0xA6, 0x01, 0x0A])
    prefix_buffer.copy(buf, 0) // prefix
    buf.writeUInt8(token_length, 7) // token length
    buf.writeUint8(0x01, 8) //unknown byte
    buf.write(fcmToken, 9) // token
    return buf
}
async function setGoogleVoiceNotificationToken(token, protobuf_buffer) {
    const headers = new Headers({
        'authorization': `Bearer ${token}`,
        'x-auth-time': Date.now(),
        'accept-language': 'zh-Hans-CN',
        'content-type': 'application/x-protobuf',
        'user-agent': 'com.google.android.apps.googlevoice/3416025 (Linux; U; Android 12; zh_CN_#Hans; MT2111; Build/RKQ1.211119.001; Cronet/108.0.5340.9)',
    });
    return await fetch("https://www.googleapis.com/voice/v1/voiceclient/api2notifications/registerdestination?alt=json", {
        method: 'POST',
        headers,
        body: protobuf_buffer,
        redirect: 'follow'
    }).then(response => response.json()).then(result => {
        if (result.error) {
            throw result.error;
        }
        return result;
    })
}
async function getGoogleVoiceUserInfo(token) {
    const headers = new Headers({
        'origin': 'https://clients6.google.com',
        'authorization': `Bearer ${token}`,
        'x-auth-time': Date.now(),
        'accept-language': 'zh-Hans-CN',
        'content-type': 'application/json+protobuf',
        'user-agent': 'com.google.android.apps.googlevoice/3416025 (Linux; U; Android 12; zh_CN_#Hans; MT2111; Build/RKQ1.211119.001; Cronet/108.0.5340.9)',
        'X-referrer': 'https://voice.google.com',
        'X-Origin': 'https://voice.google.com',
        'referer': 'https://clients6.google.com/static/proxy.html',
    });

    return await fetch(`https://clients6.google.com/voice/v1/voiceclient/account/get?alt=json&key=AIzaSyDTYc1N4xiODyrQYK0Kl6g_y279LjYkrBg`, {
        method: 'POST',
        headers,
        body: JSON.stringify([
            null, 1
        ]),
    }).then(res => res.json()).then(res => {
        if (res.error) {
            throw res.error;
        }
        return res;
    })
}