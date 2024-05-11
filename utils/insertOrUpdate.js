const db = require('../db/database');

const insertOrUpdateIPData = async (data) => {
    let city_id = null;
    let country_id = null;
    let region_id = null;

    try {
        await db.transaction(async (trx) => {
            if (data.city) {
                await trx.raw(`
                    INSERT INTO cities (name) VALUES (:name)
                    ON DUPLICATE KEY UPDATE name = VALUES(name)
                `, { name: data.city });
                const [city] = await trx('cities').where('name', data.city);
                city_id = city.id;
            }

            if (data.country) {
                await trx.raw(`
                    INSERT INTO countries (name, code, code_iso3, capital) 
                    VALUES (:name, :code, :code_iso3, :capital)
                    ON DUPLICATE KEY UPDATE name = VALUES(name)
                `, {
                    name: data.country,
                    code: data.region,
                    code_iso3: data.countryCode,
                    capital: ''
                });
                const [country] = await trx('countries').where('name', data.country);
                country_id = country.id;
            }

            if (data.regionName) {
                await trx.raw(`
                    INSERT INTO regions (name, code) 
                    VALUES (:name, :code)
                    ON DUPLICATE KEY UPDATE name = VALUES(name)
                `, {
                    name: data.regionName,
                    code: data.region
                });
                const [region] = await trx('regions').where('name', data.regionName);
                region_id = region.id;
            }

            if (data.ip) {
                const insertData = {
                    ip: data.ip,
                    city_id: city_id,
                    country_id: country_id,
                    region_id: region_id,
                    latitude: data.lat,
                    longitude: data.lon
                };

                await trx.raw(`
                    INSERT INTO ip_locations (ip, city_id, country_id, region_id, latitude, longitude, count, updated_at)
                    VALUES (:ip, :city_id, :country_id, :region_id, :latitude, :longitude, 1, NOW())
                    ON DUPLICATE KEY UPDATE count = count + 1, updated_at = NOW()
                `, insertData);
            }
        });
    } catch (error) {
        console.error('Error inserting or updating IP data:', error);
    }
};

module.exports = insertOrUpdateIPData;