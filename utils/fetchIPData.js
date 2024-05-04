const insertOrUpdateIPData = require('./insertOrUpdate');
let lastFetchTime = Date.now();
const fetchIPData = async (ips) => {
    try {
        lastFetchTime = Date.now();
        const response = await fetch('http://ip-api.com/batch', {
            method: 'POST', headers: {
                'Content-Type': 'application/json'
            }, body: JSON.stringify(ips)
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch IP data. Status: ${response.status}`);
        }
        const responseData = await response.json();

        // Map IP data to original IPs based on request order
        const ipDataMap = new Map();
        responseData.forEach((data, index) => {
            const ip = ips[index];
            ipDataMap.set(ip, data);
        });

        ipDataMap.forEach((data, ip) => {
            if (data.status === 'success') {
                data.ip = ip;
                insertOrUpdateIPData(data);
            } else {
                console.warn(`Failed to fetch IP data for IP: ${ip}. Reason: ${data.message}`);
            }
        });

        return responseData;
    } catch (error) {
        console.error('Error fetching IP data:', error);
        return null; // Return null on error
    }
};

module.exports = {
    fetchIPData,
    lastFetchTime
}