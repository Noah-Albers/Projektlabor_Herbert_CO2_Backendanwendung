function time(){
    var d = new Date();
    return `[${d.getMinutes()}:${d.getSeconds()}:${d.getMilliseconds()}]\t`;
}

module.exports.debug=(msg)=>{
    console.log(time()+"\t\t[DEBUG] "+msg);
}
module.exports.warning=(msg)=>{
    console.log(time()+"[\x1b[33mWARNING\x1b[0m] "+msg);
}
module.exports.error=(msg)=>{
    console.log(time()+"[\x1b[31mERROR\x1b[0m] "+msg);
}
module.exports.info=(msg)=>{
    console.log(time()+"[\x1b[36mINFO\x1b[0m] "+msg);
}