const {exec} = require('child_process');
const db = require('../db/database');
const insertOrUpdateIPData = require("./insertOrUpdate");
const {excludeIPs} = require("./config");
const {lastFetchTime, fetchIPData} = require("./fetchIPData");

let buffer = '';
let ipsSet = new Set(); // Set to store unique IPs

const isKnown = async (table, conditions) => {
    const result = await db(table).where(conditions).first();
    return !!result;
};

const isKnownIp = (ip) => isKnown('ip_locations', { ip });
const isKnownCommand = (command) => isKnown('commands', { command });
const isKnownUsername = (username) => isKnown('users', { username });
const isKnownPassword = (password) => isKnown('passwords', { password });

const processData = async (data) => {
    buffer += data; // Append data to buffer
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Store the incomplete line in buffer

    for (const line of lines) {
        const ipMatches = line.match(/(\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)/);
        const commandMatches = line.match(/input: "(.+?)"/);
        const usernameMatches = line.match(/user "(.+?)" /);
        const passwordMatches = line.match(/password "(.+?)"/);

        if (ipMatches) {
            const ip = ipMatches[1];
            if (excludeIPs.includes(ip)) {
                continue;
            }
            let ip_id = null; // Initialize ip_id
            const isIPKnown = await isKnownIp(ip);
            if (!isIPKnown) {
                ipsSet.add(ip); // Add IP to set
                const [newIp] = await db('ip_locations').insert({ ip: ip, count: 1 }, ['id']);
                ip_id = newIp.id;
            } else {
                const knownIP = await db('ip_locations').where('ip', ip).first();
                ip_id = knownIP.id;
                if (!ip_id) {
                    console.error(`Error: IP ID not found for IP ${ip}`);
                    continue; // Skip processing this line
                }
                await db('ip_locations')
                    .where('ip', ip)
                    .update({
                        count: db.raw('count + 1'),
                        updated_at: db.fn.now()
                    });

                // Check if IP count exceeds threshold
                const {count} = await db('ip_locations').select('count').where('ip', ip).first();
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


            // Log the command, username, and password if they exist
            if (commandMatches) {
                console.log(`Command: ${commandMatches[1]}`);
                const isCommandKnown = await isKnownCommand(commandMatches[1]);
                if (!isCommandKnown) {
                    // Insert command into the database
                    await db('commands').insert({
                        command: commandMatches[1],
                        ip_id: ip_id
                    });
                } else {
                    // Update command count
                    await db('commands')
                        .where('command', commandMatches[1])
                        .update({
                            count: db.raw('count + 1'),
                            updated_at: db.fn.now()
                        });
                }
            }
            if (usernameMatches) {
                console.log(`Username: ${usernameMatches[1]}`);
                console.log(`IP ID: ${ip_id}`);
                const isUsernameKnown = await isKnownUsername(usernameMatches[1]);
                if (!isUsernameKnown) {
                    // Insert username into the database
                    await db('users').insert({
                        username: usernameMatches[1],
                        ip_id: ip_id
                    });
                } else {
                    // Update username count
                    await db('users')
                        .where('username', usernameMatches[1])
                        .update({
                            count: db.raw('count + 1'),
                            updated_at: db.fn.now()
                        });
                }
            }
            if (passwordMatches) {
                console.log(`Password: ${passwordMatches[1]}`);
                const isPasswordKnown = await isKnownPassword(passwordMatches[1]);
                if (!isPasswordKnown) {
                    // Insert password into the database
                    await db('passwords').insert({
                        password: passwordMatches[1],
                        ip_id: ip_id
                    });
                } else {
                    // Update password count
                    await db('passwords')
                        .where('password', passwordMatches[1])
                        .update({
                            count: db.raw('count + 1'),
                            updated_at: db.fn.now()
                        });
                }
            }
        }
    }

    if (ipsSet.size >= 5 || (ipsSet.size && Date.now() - lastFetchTime >= 60000)) {
        const uniqueIPs = Array.from(ipsSet);
        const unknownIPs = uniqueIPs.filter(async ip => !(await isKnownIp(ip)));
        fetchIPData(unknownIPs)
            .then((data) => data.forEach(insertOrUpdateIPData))
            .catch(console.error);
        ipsSet.clear();
    }
};

module.exports = {
    processData,
    ipsSet
};
