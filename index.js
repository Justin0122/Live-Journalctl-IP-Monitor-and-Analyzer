require('dotenv').config();
const {exec} = require('child_process');

const {size, processData} = require("./utils/processData");
const {lastFetchTime} = require("./utils/fetchIPData");

const journalctlProcess = exec('/bin/journalctl -u ssh.service --follow');


// Start journalctl process
journalctlProcess.stdout.on('data', processData);

journalctlProcess.stderr.on('data', (data) => {
    console.error('Error running journalctl:', data);
});

const runScript = () => {
    // Check if there are at least 2 IPs collected
    if (size >= 2 || (size && Date.now() - lastFetchTime >= 60000)) {
        processData('');
    }
};


// Set interval to run the script every minute
setInterval(runScript, 60000);
