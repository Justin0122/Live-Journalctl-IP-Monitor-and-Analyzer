const db = require('../db/database');

const insertOrUpdateIPData = async (data) => {
    let city_id = null;
    let country_id = null;
    let region_id = null;

    try {
        await db.transaction(async (trx) => {
            if (data.city) {
                const [city] = await trx('cities').where('name', data.city);
                if (!city) {
                    [city_id] = await trx('cities').insert({name: data.city});
                } else {
                    city_id = city.id;
                }
            }

            if (data.country) {
                const [country] = await trx('countries').where('name', data.country);
                if (!country) {
                    [country_id] = await trx('countries').insert({
                        name: data.country,
                        code: data.region,
                        code_iso3: data.countryCode,
                        capital: ''
                    });
                } else {
                    country_id = country.id;
                }
            }

            if (data.regionName) {
                const [region] = await trx('regions').where('name', data.regionName);
                if (!region) {
                    [region_id] = await trx('regions').insert({
                        name: data.regionName,
                        code: data.region,
                    });
                } else {
                    region_id = region.id;
                }
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
                    INSERT INTO ip_locations (ip, city_id, country_id, region_id, latitude, longitude, count)
                    VALUES (:ip, :city_id, :country_id, :region_id, :latitude, :longitude, 1) ON DUPLICATE KEY
                    UPDATE
                        city_id =
                    VALUES (city_id), country_id =
                    VALUES (country_id), region_id =
                    VALUES (region_id), latitude =
                    VALUES (latitude), longitude =
                    VALUES (longitude), count = count + 1, updated_at = NOW()
                `, insertData);
            }
        });
    } catch (error) {
        console.error('Error inserting or updating IP data:', error);
    }
};

module.exports = insertOrUpdateIPData;


module.exports = insertOrUpdateIPData;