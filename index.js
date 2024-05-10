require('dotenv').config();
const {exec} = require('child_process');

const {size, processData} = require("./utils/processData");
const {lastFetchTime} = require("./utils/fetchIPData");

const sshesameProcess = exec(process.env.EXEC);

// Start sshesame process
sshesameProcess.stdout.on('data', processData);

sshesameProcess.stderr.on('data', (data) => {
    console.error('Error running sshesame:', data);
});

const runScript = () => {
    // Check if there are at least 2 IPs collected
    if (size >= 2 || (size && Date.now() - lastFetchTime >= 60000)) {
        processData('');
    }
};


// Set interval to run the script every minute
setInterval(runScript, 60000);
