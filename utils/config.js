require('dotenv').config();
const excludeIPs = process.env.EXCLUDE_IPS.split(',').map(ip => ip.trim());

module.exports = {
    excludeIPs
};