var express = require('express');
var fs = require('fs');
var http = require('http');
var mongoose = require('mongoose');
var needle = require('needle');
var Tracks = mongoose.model('Track');

// Devuelve una lista de las canciones disponibles y sus metadatos
exports.list = function (req, res) {
	// Busca las canciones existentes en la base de datos para mostrarlas en la lista
	Tracks.find(function (err, tracks) {
		if (err) res.send(500, err.message);
		res.render('tracks/index', { tracks: tracks });
	});
}

// Devuelve la vista del formulario para subir una nueva canción
exports.new = function (req, res) {
	res.render('tracks/new');
}

// Devuelve la vista de reproducción de una canción
// El campo track.url contiene la url donde se encuentra el fichero de audio
exports.show = function (req, res) {
	console.log(req.params);
	Tracks.findOne({ name: req.params.trackId }, function(err, track) {
		if (err) return res.send(500, err.message);
		res.render('tracks/show', { track: track });
	});
}

// Escribe una nueva canción en el registro de canciones
// Escribe en tracks.cdpsfy.es el fichero de audio contenido en req.files.track.buffer
// Escribe en la base de datos la verdadera url generada al añadir el fichero en el servidor tracks.cdpsfy.es
exports.create = function (req, res) {
	var track = req.files.track;
	var url = 'http://tracks.cdpsfy.es/cancion/' + track.originalname;
	var imgname = undefined;
	var urlImg = 'http://tracks.cdpsfy.es/imagen/default_cover.png';
	if (!track) {
		console.log('ERROR: Please select the track to be uploaded \n');
		res.redirect('/tracks');
	} else if (['mp3', 'ogg', 'wav'].indexOf(track.extension) < 0) {
		console.log('ERROR: Please upload .mp3, .ogg or .wav tracks \n');
		res.redirect('/tracks');
	} else {
		console.log('INFO: New track being uploaded: \n', track);
		var image = req.files.image;
		if (!image) {
			var data = {
				track: {
					buffer      : track.buffer,
					filename    : track.originalname,
					content_type: track.mimetype
				}
			}
		} else if (['bmp', 'gif', 'jpg', 'jpeg', 'png'].indexOf(image.extension) < 0) {
			return console.log('ERROR: Please upload .gif, .bmp, .jpg (.jpeg) or .png images \n');
		} else {
			console.log('INFO: New cover being uploaded: \n', image);
			imgname = image.originalname;
			urlImg = 'http://tracks.cdpsfy.es/imagen/' + image.originalname;
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
		var new_track = new Tracks({
			name: track.originalname.split('.')[0],
			url: url,
			imgname: imgname,
			urlImg: urlImg
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
// Borra en tracks.cdpsfy.es el fichero de audio correspondiente a trackId
exports.destroy = function (req, res) {
	console.log('\nINFO: Track being deleted');
	Tracks.findOne({ name: req.params.trackId }, function (err, track) {
		// Borra el fichero de audio en tracks.cdpsfy.es
		needle.request('delete', track.url, null, function(err, res) {
			if (err) return console.error('ERROR: ' + err + '\n');
			console.log('OK: Track deleted successfully');
		});
		// Borra la carátula (si se subió una) en tracks.cdpsfy.es
		if (track.imgname) {
			console.log('INFO: Cover being deleted');
			needle.request('delete', track.urlImg, null, function(err, res) {
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
