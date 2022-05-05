const got = require('got');
const { ts } = require('./common');
const { readConfigs } = require('./file');

async function notify(title, url, description, color) {
    if (!title) {
        throw new Error('Missing title');
    }
    const { webhook } = await readConfigs();
    const payload = {
        embeds: [{
            title,
            description: description || undefined,
            url: url || undefined,
            footer: {
                text: ts()
            },
            color: 0x008BDB
        }]
    };

    await got.post(webhook, {
        json: payload,
        timeout: 5000,
        retry: {
            calculateDelay: ({ attemptCount, error }) => {
                if (attemptCount >= 2) return 0; // max attempts
                else if (error.response != null && error.response.statusCode === 429) return JSON.parse(error.response.body).retry_after; // rate limit
                else if (error instanceof got.TimeoutError) return 100; // timeout
                else return 0; // stop
            }
        }
    });
}

module.exports = {
    notify
};