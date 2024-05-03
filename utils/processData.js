const db = require('../db/database');
const fetchIPData = require("./fetchIPData");
const insertOrUpdateIPData = require("./insertOrUpdate");
const {excludeIPs} = require("./config");

let buffer = ''; // Buffer to store partial lines
let ipsSet = new Set(); // Set to store unique IPs

const isIPKnown = async (ip) => {
    const result = await db('ip_locations').where('ip', ip).first();
    return !!result;
};

const processData = async (data) => {
    buffer += data; // Append data to buffer
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Store the incomplete line in buffer

    for (const line of lines) {
        const matches = line.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g);
        if (matches) {
            for (const ip of matches) {
                if (excludeIPs.includes(ip)) {
                    continue;
                }
                const known = await isIPKnown(ip);
                if (!known) {
                    ipsSet.add(ip); // Add IP to set
                } else {
                    await db('ip_locations')
                        .where('ip', ip)
                        .update({
                            count: db.raw('count + 1'),
                            updated_at: db.fn.now()
                        });
                }
            }
        }
    }

    if (ipsSet.size >= 2) {
        fetchIPData(Array.from(ipsSet).slice(0, 2))
            .then((data) => data.forEach(insertOrUpdateIPData))
            .catch(console.error);
        ipsSet.clear();
    }
};

module.exports = {
    processData,
    ipsSet
};