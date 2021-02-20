// Imports
const mysql = require("mysql");
const config = require("./Config");
const metricexporter = require("./MetricExporter");
const debug = require("./debug");

// Connection pool
const pool = mysql.createPool(config.MYSQL_SETTINGS);

// Holds the amount of connections currently running
var openConnections=0;

/**
 * Function to safly call any query for a database.
 * Ensures that the connection gets established and resolves only if the query was
 * Successful
 * @param {String} sql 
 * @param {Array} values 
 */
module.exports.query = (sql,values)=>new Promise((resolve,reject)=>{
    // Checks if too many connection are open
    if(openConnections >= config.MYSQL_SETTINGS.connectionLimit){
        // Updates the metric
        metricexporter.setValue("database.active",false);

        debug.warning("Database connection pool has reached the limit of "+config.MYSQL_SETTINGS.connectionLimit);

        // Rejects because of the connectionlimit
        reject("connectionlimit");
        return;
    }

    // Gets the connection
    pool.getConnection((err,con)=>{
        // Checks if the connection failed
        if(err){
            debug.error("Could not connect to the database with error: "+err);

            // Updates the metric
            metricexporter.setValue("database.active",false);
            // Rejects with the connection error
            reject(err);
            return;
        }

        // Querys the query
        con.query(sql,values,(ex,rows)=>{
            // Releases the connection
            con.release();
            
            // Checks if the query failed
            if(ex){
                // Rejects with the error
                reject(ex);
                return;
            }

            // Updates the metric
            metricexporter.setValue("database.active",true);

            // Resolves with the returned rows
            resolve(rows);
        });
    });
});