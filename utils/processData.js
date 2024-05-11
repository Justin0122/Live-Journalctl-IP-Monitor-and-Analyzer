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

const processData = async (data) => {
    buffer += data;
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
        const ipMatches = line.match(/(\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)/);
        const commandMatches = line.match(/input: "(.+?)"/);
        console.log(commandMatches);
        const usernameMatches = line.match(/user "(.+?)" /);
        const passwordMatches = line.match(/password "(.+?)"/);

        if (ipMatches) {
            const ip = ipMatches[1];
            if (excludeIPs.includes(ip)) {
                continue;
            }
            let ip_id = null;
            const isIPKnown = await isKnownIp(ip);
            if (!isIPKnown) {
                ipsSet.add(ip);
            } else {
                const knownIP = await db('ip_locations').where('ip', ip).first();
                ip_id = knownIP.id;
                if (!ip_id) {
                    console.error(`Error: IP ID not found for IP ${ip}`);
                    continue;
                }
                await updateIP(ip);
            }

            if (commandMatches && ip_id) {
                await handleCommand(commandMatches[1], ip_id);
            }
            if (usernameMatches && ip_id) {
                await handleUsername(usernameMatches[1], ip_id);
            }
            if (passwordMatches && ip_id) {
                await handlePassword(passwordMatches[1], ip_id);
            }
        }
    }

    if (ipsSet.size >= 1 || (ipsSet.size && Date.now() - lastFetchTime >= 60000)) {
        const unknownIPs = Array.from(ipsSet).filter(async ip => !(await isKnownIp(ip)));
        fetchIPData(unknownIPs)
            .then((data) => data.forEach(insertOrUpdateIPData))
            .catch(console.error);
        ipsSet.clear();
    }
};

const handleCommand = async (command, ip_id) => {
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
