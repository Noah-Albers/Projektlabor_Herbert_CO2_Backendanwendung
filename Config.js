// For auto configuration
const userconfig = require("./UserConfig");

// All return codes for the rest-webserver
module.exports.STATUS_CODES = {
    "not_found": "error.not_found",
    "post_invalid": "invalid.parse",
    "post_valid":"post.success",
    "forbidden":"post.forbidden",
    "forbidden_unknown":"post.forbidden_unknown_device"
};

// All metric export codes
module.exports.METRICS_CODES = {
    "database.active":"database_reachable",
    "middlenode.status":"middlenode_status",
    "enddevice.status":"enddevice_status"
}

// How long to wait until the next request gets send
// to the next device
module.exports.DELAY_PER_DEVICE = 1200; //ms

module.exports.REQUESTS_PER_DEVICE = 6;

// How long to wait extra because of the max random delay that can
// be used to desync the single middlenodes
module.exports.MAX_RANDOM_DELAY = 5000; //ms

// How long to wait extra for every middle node to space thing out
module.exports.DELAY_GLOBAL = 20000; //ms

// The port on which the rest-api server runs
module.exports.SERVER_PORT = 5000;

/*
* Autogeneration
*/
// The middle nodes as array
module.exports.MIDDLE_NODES = Object.keys(userconfig.END_DEVICES);

// The database-settings
module.exports.MYSQL_SETTINGS = {
    connectionLimit: 3,
    host: userconfig.SQL_HOST,
    user: userconfig.SQL_USER,
    password: userconfig.SQL_PASSWORD,
    database: userconfig.SQL_DATABASE,
    debug: false
}