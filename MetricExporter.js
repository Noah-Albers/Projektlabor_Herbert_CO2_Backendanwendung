// Imports
const { METRICS_CODES } = require("./Config");

// Holds the metrics
var metrics = {};

module.exports.setValue = (key,value,args)=>{
    // Formatting
    if(typeof value === "boolean")
        value=value?1:0;
    if(args===undefined)
        args={};

    // The final key
    var finalKey = METRICS_CODES[key];

    // Checks if any arguments are given
    if(Object.keys(args).length > 0){
        // Appends the starting charcter
        finalKey+="{";

        // Appends all arguments to the key
        for(let param in args){
            finalKey+=param+"=";
    
            // Escaptes the character
            let argument =JSON.stringify(args[param]);
            if(argument.startsWith("\""))
                argument=argument.substring(1,argument.length-1);
            finalKey+=`"${argument}",`;
        }

        // Removes the last comma
        finalKey=finalKey.substring(0,finalKey.length-1);

        // Appends the end character
        finalKey+="}";
    }

    // Inserts the value
    metrics[finalKey]=value;

}

module.exports.sendMetrics=(res)=>{
    // Writes all metrics with a herbert_ to indicate that these metrics are from this program
    for(let met in metrics)
        res.write("herbert_"+met+" "+metrics[met]+"\n");
}