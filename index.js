
// Imports
const config = require("./Config");
const uconfig = require("./UserConfig");
const http = require("http");
const requestIp = require('request-ip');
const database = require("./Database");
const debug = require("./debug");
const utils = require("./Utils");
const metricsexporter = require("./MetricExporter");

/**
 * Webserver handler for a web-request
 * @param {Request} req 
 * @param {Response} res 
 */
function onWebServerRequest(req,res){
    // Gets the url to check
    var url = req.url.toLowerCase();
    
    // Gets the ip
    ip = requestIp.getClientIp(req);
    ip=ip.substring(7,ip.length);
    // Appends the ip to the request
    req.ip=ip;
    
    debug.debug("Received webrequest from "+req.ip+" on url "+req.url);
    
    // Checks what type of request got made and therefore which handler should be used
    if(url.startsWith("/post/"))
        webrequestHandlerPostData(req,res);
    else if(url==="/metrics/")
        webrequestHandlerMetrics(req,res);
    else{
        // Unknown request type
        res.writeHead(404,{"Content-Type": "text/plain"});
        res.write(config.STATUS_CODES["not_found"]);
    }

    // Ends the request
    res.end();
}

/**
 * Webhandler for the metrics page
 * @param {Request} req 
 * @param {Response} res 
 */
function webrequestHandlerMetrics(req,res){
    // Sends all metrics
    res.writeHead(200,{"Content-Type":"text/plain"});
    metricsexporter.sendMetrics(res);
}

/**
 * Webhandler for the middle node data posting
 * @param {Request} req 
 * @param {Response} res 
 */
function webrequestHandlerPostData(req,res){

    // Checks if the device is a well known middle node
    if(uconfig.END_DEVICES[req.ip] === undefined){
        // Wrong device requested
        res.writeHead(403,{"Content-Type":"Text/plain"});
        res.write(config.STATUS_CODES["forbidden_unknown"]);
        
        debug.warning("A device that is not a well known middle node has send data: "+req.ip);
        return;
    }

    // Clears the timeout timer
    clearTimeout(timeoutHandlers[req.ip]);
    debug.debug("Cleared timeout: "+req.ip);

    // Updates the metrics
    metricsexporter.setValue("middlenode.status",true,{
        ip: req.ip
    });

    // Decodes the b64 given value
    let buff = Buffer.from(req.url.substring("/post/".length,req.url.length),"base64");
    let rawData = buff.toString("utf-8");

    try {
        // Tries to parse the json value
        var json = JSON.parse(rawData);
        
        debug.debug("Received valid json data:");
        debug.debug(JSON.stringify(json));
    
        // The querys to build
        var dataquery = "INSERT INTO `dataset` (`recordtime`,`dhumitity`,`dco2`,`dtemperature`,`dlight`,`deviceid`) VALUES ";
        var timeoutquery = "INSERT INTO `timeout` (`recordtime`,`deviceid`) VALUES ";
    
        // The values to escape with the querys
        var dataValues = [];
        var timeoutValues = [];
    
        // Receivetime
        var time = new Date();
    
        // Iterates over all devices
        for(var deviceid in json){
            // Gets the object
            let obj = json[deviceid];

            // Gets the deviceid as an int
            let id = parseInt(deviceid);

            // Checks if the deviceid is invalid
            if(isNaN(id))
                throw "Invalid device id: "+deviceid;
    
            // Checks if the current middle node is owner of the given device
            if(!utils.isMiddlenodeOwnerOf(req.ip,id))
                throw "Middle node "+req.ip+" is not owner of "+id;

            // Checks if the data timeouted
            if(obj === false){
                // Updates the metrics
                metricsexporter.setValue("enddevice.status",false,{
                    deviceid: id
                });

                debug.warning("Device "+deviceid+" is down.");

                // Appends a timeout for the query
                timeoutquery+="(?,?),";
                timeoutValues.push(time,parseInt(deviceid));
            // Checks if 
            }else if(typeof obj === "object"){
                // Updates the metrics
                metricsexporter.setValue("enddevice.status",true,{
                    deviceid: id
                });

                // Appends a dataset for the query
                dataquery+="(?,?,?,?,?,?),";

                // Checks if all values are valid and pushes them
                dataValues.push(
                    time,
                    utils.getValueOrError(obj,"humidity",x=>typeof x === "number","Humidity is not given or not a float"),
                    utils.getValueOrError(obj,"co2",Number.isInteger,"CO2 is not given or not an int"),
                    utils.getValueOrError(obj,"temperature",x=>typeof x === "number","Temperature is not given or not a float"),
                    utils.getValueOrError(obj,"light",x=>typeof x === "number","Light is not given or not a float"),
                    id
                );
            }else
                // Invalid json data has been transfered
                throw "Unknown value on json object "+deviceid+": "+typeof obj;
        }

        // Sends back the successful execution
        res.write(config.STATUS_CODES["post_valid"]);

        // Formats the querys
        dataquery=dataquery.substring(0,dataquery.length-1)+";";
        timeoutquery=timeoutquery.substring(0,timeoutquery.length-1)+";";
    
        // Holds all promises with insert querys
        promList = [];
    
        // Checks if data got parsed
        if(dataValues.length > 0){
            debug.debug("Executing query with values: "+dataquery);
            
            // Inserts the data
            promList.push(database.query(dataquery,dataValues));
        }
    
        // Checks if a device timed out
        if(timeoutValues.length > 0){
            debug.debug("Executing query with values: "+timeoutquery);
            
            // Inserts the timeout
            promList.push(database.query(timeoutquery,timeoutValues));
        }

        debug.info("Device with ip "+req.ip+" send data");
    
        // Waits for all database insertions to end
        Promise.all(promList)
        // On success of all
        .then(()=>{
            debug.debug("Successfully executed all insert querys.");
            resetTimeoutFor(req.ip); // Resets the timeout
        })
        // On error of one
        .catch(err=>{
            debug.debug("Failed to execute all insert querys.");
            resetTimeoutFor(req.ip); // Resets the timeout
        });

    } catch (error) {
        debug.error("Error with received json from middle node.");
        debug.error(error);

        // Send back that the post was invalid
        res.write(config.STATUS_CODES["post_invalid"]);

        // Resets the timeout
        resetTimeoutFor(req.ip);
        return;
    }
}

// Creates the server
var server = http.createServer(onWebServerRequest);
// Starts the rest-server
server.listen(config.SERVER_PORT);

// Holds the device-timeout callers
const timeoutHandlers = {};

/**
 * Executes when the time has run out for a middle-node to respond
 * 
 * @param {String} device the ip-address of the middle node that failed to respond in time 
 */
function onDeviceTimeout(device){
    // Marks the middle node unreachable
    utils.updateMiddlenodeUnreachable(device)
    .then(()=>debug.debug("Successfully inserted timeout of middlenode into database."))
    .catch(()=>debug.debug("Failed to insert timeout of middlenode into database."));

    debug.error("Middlenode timed out: "+device);
}

/**
 * Resets the timeout and restarts the waiting for a device timeout
 * @param {String} device the ip of the device
 */
function resetTimeoutFor(device){
    // The max time the device can take until an answer is required
    let timeUtilTimeout = uconfig.END_DEVICES[device].length*config.DELAY_PER_DEVICE*config.REQUESTS_PER_DEVICE+config.DELAY_GLOBAL+config.MAX_RANDOM_DELAY;
    
    // Starts the time
    timeout=setTimeout(()=>onDeviceTimeout(device),timeUtilTimeout);
    
    debug.debug("Registered timeout for "+device+" with "+timeUtilTimeout+"ms");

    // Registers the timeout
    timeoutHandlers[device] = timeout;
}

// Sets the timeout for every device
for(let middleNode in uconfig.END_DEVICES)
    resetTimeoutFor(middleNode);