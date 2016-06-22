var fs = require('fs');
var needle = require('needle');
var Music = require('mongoose').model('Music');

// Devuelve una lista de las canciones disponibles y sus metadatos
exports.list = function (req, res) {
	// Busca las canciones existentes en la base de datos para mostrarlas en la lista
	Music.find(function (err, tracks) {
		if (err) res.send(500, err.message);
		res.render('tracks/index', { tracks: tracks });
	});
}

// Devuelve la vista del formulario para subir una nueva canción
exports.new = function (req, res) {
	res.render('tracks/new');
}

// Devuelve la vista de reproducción de una canción
exports.show = function (req, res) {
	console.log(req.params);
	Music.findOne({ name: req.params.trackId }, function(err, track) {
		if (err) return res.send(500, err.message);
		res.render('tracks/show', { track: track });
	});
}

// Escribe una nueva canción en el registro de canciones
// Escribe en tracks.cdpsfy.es el fichero de audio (y el de su carátula si se sube una) contenido en req.files.track.buffer
// Escribe en la base de datos las verdaderas url generada al añadir los ficheros en el servidor tracks.cdpsfy.es
exports.create = function (req, res) {
	var track = req.files.track;
	if (!track) {
		res.render('/tracks/new', { error: "cagada" });
		return console.log('ERROR: Please select the track to be uploaded \n');
	} else if (['mp3', 'ogg', 'wav'].indexOf(track.extension) < 0) return console.log('ERROR: Please upload .mp3, .ogg or .wav tracks \n');
	else {
		console.log('INFO: New track being uploaded: \n', track);
		var url = 'http://tracks.cdpsfy.es/cancion/' + track.originalname;
		var image = req.files.image;
		if (!image) {
			var name_cover = undefined;
			var url_cover = 'http://tracks.cdpsfy.es/imagen/default_cover.png';
			var data = {
				track: {
					buffer      : track.buffer,
					filename    : track.originalname,
					content_type: track.mimetype
				}
			}
		} else if (['bmp', 'gif', 'jpg', 'jpeg', 'png'].indexOf(image.extension) < 0) return console.log('ERROR: Please upload .gif, .bmp, .jpg (.jpeg) or .png images \n');
		else {
			console.log('INFO: New cover being uploaded: \n', image);
			var name_cover = image.originalname;
			var url_cover = 'http://tracks.cdpsfy.es/imagen/' + image.originalname;
			var data = {
				track: {
					buffer      : track.buffer,
					filename    : track.originalname,
					content_type: track.mimetype
				},
				image: {
					buffer      : image.buffer,
					filename    : image.originalname,
					content_type: image.mimetype
				}
			}
		}
		// Escribe los metadatos de la nueva canción en el registro
		var new_track = new Music({
			name: track.originalname.split('.')[0],
			url: url,
			name_cover: name_cover,
			url_cover: url_cover
		});
		new_track.save(function(err, new_track) {
			if (err) console.log('ERROR: ' + err);
		});
		// Petición POST al servidor para guardar la canción y la imagen
		needle.post('http://tracks.cdpsfy.es', data, { multipart: true }, function (err, httpResponse) {
			if (err) return console.error('ERROR: ' + err + '\n');
			console.log('OK: Upload successful \n');
			res.redirect('/tracks');
		});
	}
}

// Borra una canción (trackId) de la base de datos 
// Borra en tracks.cdpsfy.es el fichero de audio correspondiente a trackId y su carátula (si se subió una)
exports.destroy = function (req, res) {
	console.log('\nINFO: Track being deleted');
	Music.findOne({ name: req.params.trackId }, function (err, track) {
		// Borra el fichero de audio en tracks.cdpsfy.es
		needle.delete(track.url, null, function(err, res) {
			if (err) return console.error('ERROR: ' + err + '\n');
			console.log('OK: Track deleted successfully');
		});
		// Borra la carátula (si se subió una) en tracks.cdpsfy.es
		if (track.name_cover) {
			console.log('INFO: Cover being deleted');
			needle.delete(track.url_cover, null, function(err, res) {
				if (err) return console.error('ERROR: ' + err + '\n');
				console.log('OK: Cover deleted successfully');
			});
		}
		// Borra la canción de la base de datos
		track.remove(function (err, track) {
			if (err) console.log('ERROR deleting track from database: ' + err);
		});
	});
	res.redirect('/tracks');
}
