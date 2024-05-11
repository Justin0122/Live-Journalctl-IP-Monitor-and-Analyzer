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

const isKnownIp = (ip) => isKnown('ip_locations', {ip});
const isKnownCommand = (command) => isKnown('commands', {command});
const isKnownUsername = (username) => isKnown('users', {username});
const isKnownPassword = (password) => isKnown('passwords', {password});

let tempLogs = {}; // Temporary storage for logs

const processData = async (data) => {
    buffer += data;
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
        console.log("Line:", line);
        const ipMatches = line.match(/(\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)/);
        const commandMatches = line.match(/input: "(.+?)"/);
        const usernameMatches = line.match(/user "(.+?)" /);
        const passwordMatches = line.match(/password "(.+?)"/);

        if (ipMatches) {
            const ip = ipMatches[1];
            if (excludeIPs.includes(ip)) {
                continue;
            }

            // Always add IP to set
            ipsSet.add(ip);

            const isIPKnown = await isKnownIp(ip);
            if (!isIPKnown) {
                console.log("IP:", ip);
                // Store the log in tempLogs
                tempLogs[ip] = tempLogs[ip] || [];
                tempLogs[ip].push({commandMatches, usernameMatches, passwordMatches});
            } else {
                const knownIP = await db('ip_locations').where('ip', ip).first();
                console.log("Known IP:", knownIP);
                if (!knownIP || !knownIP.latitude || !knownIP.longitude) {
                    console.error(`Error: IP ID or location data not found for IP ${ip}`);
                    continue;
                }
                await updateIP(ip);
                // Process the stored logs for this IP
                if (tempLogs[ip]) {
                    console.log("Temp logs for IP:", ip, tempLogs[ip]);
                    for (const log of tempLogs[ip]) {
                        // Add logging for processing each log entry
                        console.log("Processing log entry:", log);
                        if (log.commandMatches) {
                            console.log("Command matches:", log.commandMatches);
                            await handleCommand(log.commandMatches[1], knownIP.id);
                        }
                        if (log.usernameMatches) {
                            await handleUsername(log.usernameMatches[1], knownIP.id);
                        }
                        if (log.passwordMatches) {
                            await handlePassword(log.passwordMatches[1], knownIP.id);
                        }
                    }
                    delete tempLogs[ip]; // Remove the processed logs
                } else {
                    console.log("No temp logs for IP:", ip);
                }
            }
        }
    }

    // Fetch data for all IPs when conditions are met
    if (ipsSet.size >= 1 || (ipsSet.size && Date.now() - lastFetchTime >= 60000)) {
        const allIPs = Array.from(ipsSet);
        fetchIPData(allIPs)
            .then((data) => data.forEach(insertOrUpdateIPData))
            .catch(console.error);
        ipsSet.clear();
    }
};
const handleCommand = async (command, ip_id) => {
    console.log("Command:", command);
    const isCommandKnown = await isKnownCommand(command);
    if (!isCommandKnown) {
        await db('commands').insert({command, ip_id});
    } else {
        await db('commands').where('command', command).update({count: db.raw('count + 1'), updated_at: db.fn.now()});
    }
};

const handleUsername = async (username, ip_id) => {
    const isUsernameKnown = await isKnownUsername(username);
    if (!isUsernameKnown) {
        await db('users').insert({username, ip_id});
    } else {
        await db('users').where('username', username).update({count: db.raw('count + 1'), updated_at: db.fn.now()});
    }
};

const handlePassword = async (password, ip_id) => {
    const isPasswordKnown = await isKnownPassword(password);
    if (!isPasswordKnown) {
        await db('passwords').insert({password, ip_id});
    } else {
        await db('passwords').where('password', password).update({count: db.raw('count + 1'), updated_at: db.fn.now()});
    }
};

const updateIP = async (ip) => {
    await db('ip_locations').where('ip', ip).update({count: db.raw('count + 1'), updated_at: db.fn.now()});
    const {count} = await db('ip_locations').select('count').where('ip', ip).first();
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
