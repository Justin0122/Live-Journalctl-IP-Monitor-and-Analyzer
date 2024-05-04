const { exec } = require('child_process');
const db = require('../db/database');
const insertOrUpdateIPData = require("./insertOrUpdate");
const { excludeIPs } = require("./config");
const { lastFetchTime, fetchIPData } = require("./fetchIPData");

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

                    // Check if IP count exceeds threshold
                    const { count } = await db('ip_locations').select('count').where('ip', ip).first();
                    if (count >= 5000) {
                        // Add firewall rule to block the IP address
                        exec(`sudo iptables -A INPUT -s ${ip} -j DROP`, (error, stdout, stderr) => {
                            if (error) {
                                console.error(`Error blocking IP ${ip}: ${error.message}`);
                                return;
                            }
                            if (stderr) {
                                console.error(`Error blocking IP ${ip}: ${stderr}`);
                                return;
                            }
                            console.log(`Blocked IP ${ip}`);
                        });
                    }
                }
            }
        }
    }

    if (ipsSet.size >= 2 || (ipsSet.size && Date.now() - lastFetchTime >= 60000)) {
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
