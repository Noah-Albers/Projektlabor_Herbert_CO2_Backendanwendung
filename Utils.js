// Imports
const config = require("./Config");
const uconfig = require("./UserConfig");
const database = require("./Database");
const metricexporter = require("./MetricExporter");
const debug = require("./debug");

/**
 * Takes an object and checks if the key is on that project.
 * If that is the case and the given test function returns trie when called with the value it returns
 * the given value; otherwise throws the given exception
 * @param {Object} obj 
 * @param {String} key 
 * @param {Function} test 
 * @param {Exception} exception 
 */
module.exports.getValueOrError = (obj,key,test,exception)=>{
    if(obj.hasOwnProperty(key) && test(obj[key]))
        return obj[key];
    throw exception;
}

/**
 * Returns if the middlenode is master of the enddevice with the deviceId
 * @param {String} middlenode ip of the middle node 
 * @param {} deviceId id of the device
 */
module.exports.isMiddlenodeOwnerOf = (middlenode,deviceId)=>{
    // Iterates over all enddevices of the middlenode
    for(var device of uconfig.END_DEVICES[middlenode])
        // Checks if the id matches
        if(device===deviceId)
            return true;
    return false;
}

/**
 * Updates the middle node and all of its end devices as timeouted and marks them in them metrics as such
 * @param {String} middlenode ip of the middle node 
 */
module.exports.updateMiddlenodeUnreachable = (middlenode)=>{
    // Current time
    var time = new Date();

    // Updates the metrics
    metricexporter.setValue("middlenode.status",false,{
        "ip": middlenode
    });

    // Creates the query
    var query = "INSERT INTO `timeout` (`recordtime`,`deviceid`) VALUES ";
    var values = [];

    // Updates all end-devices
    for(var id of uconfig.END_DEVICES[middlenode]){
        // Updates the metric
        metricexporter.setValue("enddevice.status",false,{
            "deviceid": id
        });

        // Updates the query
        query+="(?,?),";
        // Appends the values
        values.push(time,id);
    }

    // Removes the last comma and adds the semicolon
    query=query.substring(0,query.length-1)+";";

    // Updates the database
    return database.query(query,values);
}