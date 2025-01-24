const { Client } = require('@elastic/elasticsearch');

// Read environment variables or provide default values
const client = new Client({
    node:  'http://elastic.sproutsai.com:9200',
    auth: {
        username: 'elastic',
        password: 'Wc4DXGpiGxUqOk1iBsE3',
    },
});

module.exports = client;
