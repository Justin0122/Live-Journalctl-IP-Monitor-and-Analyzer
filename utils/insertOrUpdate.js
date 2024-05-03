const db = require('../db/database');

const insertOrUpdateIPData = async (data) => {
    let city_id = null;
    let country_id = null;
    let region_id = null;

    if (data.city) {
        await db.transaction(async trx => {
            const city = await trx('cities').where('name', data.city).first();
            if (!city) {
                [city_id] = await trx('cities').insert({name: data.city});
            } else if (city.id) {
                city_id = city.id;
            }
        });
    }

    if (data.country) {
        await db.transaction(async trx => {
            const country = await db('countries').where('name', data.country).first();
            if (!country) {
                [country_id] = await db('countries').insert({
                    name: data.country,
                    code: data.region,
                    code_iso3: data.countryCode,
                    capital: ''
                });
            } else if (country.id) {
                country_id = country.id;
            }
        });
    }

    if (data.regionName) {
        await db.transaction(async trx => {
            const region = await db('regions').where('name', data.regionName).first();
            if (!region) {
                [region_id] = await db('regions').insert({
                    name: data.regionName,
                    code: data.region,
                });
            } else if (region.id) {
                region_id = region.id;
            }
        });
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

        await db.raw(`
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
}


module.exports = insertOrUpdateIPData;