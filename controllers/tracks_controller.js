const express = require('express');
const router = express.Router();
var formidable = require('formidable');
var http = require('http');
var util = require('util');

const {Pool} = require('pg')

let db;
if (process.env.PRODUCTION) {
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  })
} else {
  db = new Pool({
    database: 'drum_beats',
    password: process.env.PG_PASSWORD
  })
}

const cloudinary = require('cloudinary').v2;
const { createSecretKey } = require('crypto');
const { response } = require('express');
const { NONAME } = require('dns');

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

db.connect()

router.get('/', (req, res) => {
  db.query('SELECT id, author_id, track_name, cloudinary_url, genres, user_name FROM tracks as T INNER JOIN users as U ON T.author_id = U.user_id ORDER BY id DESC;')
  .then(dbRes => {
      dbRes.rows.forEach(track => {
        const url = track.cloudinary_url.split('/').pop().split('.');
        url[1] = 'png'
        const waveURL = url.join('.');
        track.waveform_image = cloudinary.image(`${waveURL}`, {
          flags: "waveform",
          resource_type: "video",
          background: "none"
          })
      }) 
      res.json(dbRes.rows)
    }) 
})

router.get('/:genre', (req, res) => {
  const genre = req.params.genre.split('-')[0];
  db.query(`SELECT id, author_id, track_name, cloudinary_url, genres, user_name FROM tracks as T INNER JOIN users as U ON T.author_id = U.user_id WHERE genres ILIKE '${genre}%';`)
    .then(dbRes => {
      dbRes.rows.forEach(track => {
        const url = track.cloudinary_url.split('/').pop().split('.');
        url[1] = 'png'
        const waveURL = url.join('.');
        track.waveform_image = cloudinary.image(`${waveURL}`, {
          flags: "waveform",
          resource_type: "video",
          background: "none"
          })
        })
      res.json(dbRes.rows)
    })
})
  
router.post('/', (req, res) => {
  const form = formidable({ multiples: true });

  form.parse(req, (err, fields, files) => {
      if (err) {
        next(err);
        return;
      }

      cloudinary
                .uploader
                .upload(files.track.path,{resource_type: 'video'})
                .then(track => {
                    console.log(track);

                    sql = `INSERT INTO tracks 
                    (track_name, author_id, cloudinary_url, genres)
                    VALUES ($1, 1, $2, $3)`
                    db.query(sql, [fields.title.toLowerCase(), track.url, fields.genre.toLowerCase()])
                      .then(dbRes => {
                        res.json({upload: true})
                      })
                })
                .catch(err => {
                  console.log();
                  console.log("** File Upload (Promise)");
                  if (err) { console.warn(err); }
                });
      // cloudinary.uploader.upload(waveformurl,{resource_type: 'image'}).then
      return files;
  });
})

router.delete('/:id', (req, res) => {
  db.query(`DELETE FROM tracks WHERE ID = ${req.params.id};`)
  .then(dbRes => {
    res.json({deleted: true})
  })
})

router.put('/:id', (req, res) => {
  let sql = `UPDATE tracks SET track_name = $1, genres = $2 WHERE id=$3;`
  db.query(sql, [req.body.trackName, req.body.trackGenre.toLowerCase(), req.params.id])
  .then(dbRes => {
    res.json({updated: true})
  })
})

router.get('/update/:id', (req, res) => {
  console.log('about to do a query')
  db.query(`SELECT * FROM tracks WHERE id = ${req.params.id};`)
    .then(dbRes => {
      res.json(dbRes.rows)
    })

})

module.exports = router
