// Imports
const mysql = require("sqlite3").verbose();
const config = require("./Config");
const metricexporter = require("./MetricExporter");
const debug = require("./debug");

const db = new mysql.Database("db.sqlite", err=>{
    if(err){
        debug.error("Failed to open sqlite-database: "+err);
        return;
    }

    debug.info("Database opened");
});

/**
 * Function to safly call any query for a database.
 * Ensures that the connection gets established and resolves only if the query was
 * Successful
 * @param {String} sql 
 * @param {Array} values 
 */
module.exports.query = (sql,values)=>new Promise((resolve,reject)=>{
    db.run(sql,values,err=>{
        if(err){
            debug.error("Failed to insert query into database: "+err);
            reject(err);
            return;
        }
        resolve();
    });
});