const { exec } = require('child_process');
const db = require('../db/database');
const insertOrUpdateIPData = require("./insertOrUpdate");
const { excludeIPs } = require("./config");
const { lastFetchTime, fetchIPData } = require("./fetchIPData");

let buffer = '';
const ipsSet = new Set(); // Set to store IPs to fetch location data
let ipsLogs = {}; // Object to store temporary logs for each IP

const isKnown = async (table, conditions) => {
    const result = await db(table).where(conditions).first();
    return !!result;
};

const isKnownIp = (ip) => isKnown('ip_locations', { ip });
const isKnownCommand = (command) => isKnown('commands', { command });
const isKnownUsername = (username) => isKnown('users', { username });
const isKnownPassword = (password) => isKnown('passwords', { password });

const processData = async (data) => {
    buffer += data;
    const lines = buffer.split('\n');
    buffer = lines.pop();

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

            // Initialize a log entry for the IP if it doesn't exist
            ipsLogs[ip] = ipsLogs[ip] || { commands: [], usernames: [], passwords: [] };

            if (commandMatches) {
                ipsLogs[ip].commands.push(commandMatches[1]);
            }
            if (usernameMatches) {
                ipsLogs[ip].usernames.push(usernameMatches[1]);
            }
            if (passwordMatches) {
                ipsLogs[ip].passwords.push(passwordMatches[1]);
            }

            const isIPKnown = await isKnownIp(ip);
            if (!isIPKnown) {
                // If IP is not known, add it to the set to fetch its location data later
                ipsSet.add(ip);
            }
        }
    }

    if (ipsSet.size >= 5 || (ipsSet.size && Date.now() - lastFetchTime >= 60000)) {
        const unknownIPs = Array.from(ipsSet).filter(async ip => !(await isKnownIp(ip)));
        fetchIPData(unknownIPs)
            .then((data) => data.forEach(insertOrUpdateIPData))
            .catch(console.error);
        ipsSet.clear();
    }

    // Once location data is fetched, process the temporary logs
    await processTempLogs();
};

const processTempLogs = async () => {
    for (const ip in ipsLogs) {
        const { commands, usernames, passwords } = ipsLogs[ip];
        const knownIP = await db('ip_locations').where('ip', ip).first();
        if (knownIP) {
            const ip_id = knownIP.id;
            for (const command of commands) {
                await handleCommand(command, ip_id);
            }
            for (const username of usernames) {
                await handleUsername(username, ip_id);
            }
            for (const password of passwords) {
                await handlePassword(password, ip_id);
            }
            delete ipsLogs[ip]; // Remove processed logs
        }
    }
};

const handleCommand = async (command, ip_id) => {
    const isCommandKnown = await isKnownCommand(command);
    if (!isCommandKnown) {
        await db('commands').insert({ command, ip_id });
    } else {
        await db('commands').where('command', command).update({ count: db.raw('count + 1'), updated_at: db.fn.now() });
    }
};

const handleUsername = async (username, ip_id) => {
    const isUsernameKnown = await isKnownUsername(username);
    if (!isUsernameKnown) {
        await db('users').insert({ username, ip_id });
    } else {
        await db('users').where('username', username).update({ count: db.raw('count + 1'), updated_at: db.fn.now() });
    }
};

const handlePassword = async (password, ip_id) => {
    const isPasswordKnown = await isKnownPassword(password);
    if (!isPasswordKnown) {
        await db('passwords').insert({ password, ip_id });
    } else {
        await db('passwords').where('password', password).update({ count: db.raw('count + 1'), updated_at: db.fn.now() });
    }
};

const updateIP = async (ip) => {
    await db('ip_locations').where('ip', ip).update({ count: db.raw('count + 1'), updated_at: db.fn.now() });
    const { count } = await db('ip_locations').select('count').where('ip', ip).first();
    if (count >= 5000) {
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
};

module.exports = {
    processData,
    ipsSet
};
