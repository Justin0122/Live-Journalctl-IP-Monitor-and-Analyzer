const fetchIPData = require("./fetchIPData");
const insertOrUpdateIPData = require("./insertOrUpdate");
const {excludeIPs} = require("./config");

let buffer = ''; // Buffer to store partial lines
let ipsSet = new Set(); // Set to store unique IPs


const processData = (data) => {
    buffer += data; // Append data to buffer
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Store the incomplete line in buffer

    lines.forEach((line) => {
        const matches = line.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g);
        if (matches) {
            matches.forEach((ip) => {
                if (excludeIPs.includes(ip)) {
                    return;
                }
                ipsSet.add(ip); // Add IP to set
            });
        }
    });

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