import fetch from 'node-fetch';
const res = await fetch('https://api.cobalt.tools/api/json', {
    method: 'OPTIONS',
    headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'POST'
    }
});
console.log(res.status);
console.log(res.headers.raw());
